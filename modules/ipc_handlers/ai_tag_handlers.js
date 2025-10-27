let reverseTranslationMap = null;

function buildReverseTranslationMap(translationData) {
  if (!translationData) return null;
  
  const reverseMap = {};
  for (const category in translationData) {
    reverseMap[category] = {};
    const bucket = translationData[category];
    for (const englishKey in bucket) {
      const translation = bucket[englishKey];
      if (translation && translation.name) {
        const normalizedTranslation = translation.name.trim().toLowerCase();
        if (normalizedTranslation) {
          reverseMap[category][normalizedTranslation] = englishKey;
        }
      }
    }
  }
  console.log('✅ 反向翻译地图构建完成。');
  return reverseMap;
}

/**
 * AI 自动标签功能
 * 通过 AI API 根据标题推断标签
 */

const { ipcMain, shell } = require('electron')
const fetch = require('node-fetch')
const fs = require('fs')
const path = require('path')

function registerAiTagHandlers(dependencies) {
  const { Manga: db, translationData, setting, saveBookToDatabase } = dependencies
  
  if (translationData && !reverseTranslationMap) {
    console.log('🤖 AI 处理器正在构建反向翻译地图...');
    reverseTranslationMap = buildReverseTranslationMap(translationData);
  }

  console.log('🤖 注册 AI 标签处理器...')
  
  // 获取数据库中现有的标签列表（用于 AI 参考）
  ipcMain.handle('get-existing-tags', async (event, category) => {
    try {
      console.log(`📋 获取 ${category || '所有'} 类别的现有标签`)
      
      const books = await db.findAll({
        attributes: ['tags'],
        where: {
          status: 'tagged'
        },
        raw: true
      })
      
      // 统计所有标签
      const tagsByCategory = {}
      
      for (const book of books) {
        let tags = book.tags
        if (typeof tags === 'string') {
          tags = JSON.parse(tags)
        }
        
        if (!tags || typeof tags !== 'object') continue
        
        for (const [cat, tagList] of Object.entries(tags)) {
          // 如果指定了类别，只返回该类别
          if (category && cat !== category) continue
          
          if (!tagsByCategory[cat]) {
            tagsByCategory[cat] = new Set()
          }
          
          if (Array.isArray(tagList)) {
            tagList.forEach(tag => {
              if (tag && typeof tag === 'string') {
                tagsByCategory[cat].add(tag.trim())
              }
            })
          }
        }
      }
      
      // 转换为数组并排序
      const result = {}
      for (const [cat, tagSet] of Object.entries(tagsByCategory)) {
        result[cat] = Array.from(tagSet).sort((a, b) => 
          a.localeCompare(b, 'ja', { sensitivity: 'base' })
        )
      }
      
      // 统计数量
      const counts = {}
      for (const [cat, tags] of Object.entries(result)) {
        counts[cat] = tags.length
      }
      
      console.log(`✅ 标签统计:`, counts)
      
      return {
        success: true,
        tags: result,
        counts
      }
    } catch (error) {
      console.error('❌ 获取标签列表失败:', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
  
  // AI 推断单本书的标签
  ipcMain.handle('ai-infer-tags', async (event, { bookId, title, apiConfig }) => {
    try {
      console.log(`🤖 AI 推断标签: ${title}`)
      
      // 获取现有标签列表（作为 AI 参考）
      const existingTags = await getExistingTagsForAI(db)
      
      // 调用 AI API
      const inferredTags = await callAiApi(title, existingTags, apiConfig, setting)
      
      // 匹配和规范化标签
      const normalizedTags = await matchAndNormalizeTags(db, inferredTags, apiConfig.keepUnknownTags)
      
      console.log(`✅ 推断结果:`, normalizedTags)
      
      // 如果不是测试，更新数据库
      if (bookId !== 'test') {
        const book = await db.findByPk(bookId, {
          attributes: ['id', 'tags', 'hash'], // Add hash
          raw: true
        });
        
        if (book) {
          const currentTags = typeof book.tags === 'string' ? JSON.parse(book.tags) : (book.tags || {});
          const mergedTags = mergeTags(currentTags, normalizedTags);

          // Add the 'ai-matched' tag for traceability
          if (!mergedTags.other) {
            mergedTags.other = [];
          }
          if (!mergedTags.other.includes('ai-matched')) {
            mergedTags.other.push('ai-matched');
          }

          await saveBookToDatabase({ // Use saveBookToDatabase
            id: bookId,
            hash: book.hash, // Pass hash
            title: book.title, // Pass title for logging
            tags: mergedTags, // Pass object directly
            status: 'tagged', 
            category: inferredTags.category 
});
        }
      }
      
      return {
        success: true,
        tags: normalizedTags,
        raw: inferredTags
      }
    } catch (error) {
      console.error('❌ AI 推断失败:', error)
      return {
        success: false,
        message: error.message
      }
    }
  })
  
  function buildBatchPrompt(books, existingTags, setting) {
    const bookPrompts = books.map(book => `  { "id": ${book.id}, "title": "${book.title.replace(/"/g, '\"')}" }`).join(',\n');
    
    const tagExamples = {};
    for (const [category, tags] of Object.entries(existingTags)) {
      tagExamples[category] = tags.slice(0, 50);
    }
  
  const categoryOptions = ["Doujinshi", "Manga", "Artist CG", "Game CG", "Non-H", "Image Set", "Western", "Cosplay", "Asian Porn", "Misc"];
  return `You are a professional manga tag classification assistant. For each manga in the JSON array below, infer its category and tags based on the title.

**CRITICAL INSTRUCTION**: Your task is to extract information ONLY from the manga TITLE provided for each item. DO NOT use any tags from the "Available tag examples" or "My Favorite Tags" lists unless the name is explicitly written in the title. For example, if the title is "[My Circle (My Artist)] My Title", you must extract "My Circle" and "My Artist". Do not invent or copy tags from the example lists.

**Instructions:**
1.  **Infer Category**: From the "Available Categories" list, choose the single most appropriate category for the manga.
2.  **Deeply analyze the title**: Strictly analyze the title content. Content in \`()\` and \`[]\` are usually the group and artist.
3.  **Enrich content tags**: For 'female' and 'male' categories, be bold in your inferences based on the title, e.g., 'sole female', 'schoolgirl uniform'.如果标题出现角色别名或简称  要正确识别角色和原作 比如红蒂->浊心斯卡蒂 C:skadi P:arknights F:Stocking 这样 同时打上角色本身的属性tag
4.  **Use original language**: Please use the original Japanese/English for tag names.

Available Categories:
${JSON.stringify(categoryOptions)}

Available tag examples (for spelling reference only):
${JSON.stringify(tagExamples, null, 2)}

My Favorite Tags (for spelling reference only):
${JSON.stringify((setting.collectTag || []).map(t => t.tag))}

Manga list:
[
${bookPrompts}
]

Your response MUST be a valid JSON array. Ensure your response contains an object for every single item in the input "Manga list", each with its original "id" and the inferred "tags". The "tags" object should follow this structure: { "category": "...", "parody": [], "character": [], "artist": [], "group": [], "female": [], "male": [] }.

Example Response:
[
  {
    "id": 1,
    "tags": { "category": "Doujinshi", "parody": ["original"], "artist": ["artist name"], "group": ["circle name"] }
  },
  {
    "id": 2,
    "tags": { "category": "Manga", "parody": ["some parody"], "character": ["some character"] }
  }
]`;
  }
  
  async function callAiApiBatch(books, existingTags, apiConfig) {
    const { apiUrl, apiKey, model } = apiConfig;
    const prompt = buildBatchPrompt(books, existingTags, setting);
    const isGoogleApi = apiUrl.includes('googleapis.com');
  
    if (isGoogleApi) {
      const fullUrl = `${apiUrl}/v1beta/models/${model}:generateContent`;
      const requestBody = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          response_mime_type: 'application/json',
          temperature: 0.3,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
        ],
      };
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body: JSON.stringify(requestBody),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      const data = await response.json();
      if (!data.candidates || data.candidates.length === 0 || data.candidates[0].finishReason === 'SAFETY') {
        throw new Error(`AI 因为安全原因返回了空响应。`);
      }
      const content = data.candidates[0].content.parts[0].text;
      return JSON.parse(content);
    } else {
      // OpenAI-compatible batch call
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.3,
          response_format: { type: 'json_object' },
        }),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorBody}`);
      }
      const data = await response.json();
      const content = data.choices[0].message.content;
      return JSON.parse(content);
    }
  }

  // 批量 AI 推断标签
  ipcMain.handle('ai-batch-infer-tags', async (event, { bookIds, apiConfig }) => {
    try {
      const batchSize = setting.aiTagBatchSize || 10;
      console.log(`🤖 批量 AI 推断，共 ${bookIds.length} 本书，批次大小: ${batchSize}`);
      
      const results = [];
      const errors = [];
      const existingTags = await getExistingTagsForAI(db);
      let processedCount = 0;

      for (let i = 0; i < bookIds.length; i += batchSize) {
        const chunkBookIds = bookIds.slice(i, i + batchSize);
        console.log(`🔄 处理批次: ${Math.floor(i / batchSize) + 1}, 书籍数量: ${chunkBookIds.length}`);

        try {
          const booksInChunk = await db.findAll({
            where: { id: chunkBookIds },
            attributes: ['id', 'title', 'tags', 'hash'],
            raw: true
          });

          if (booksInChunk.length === 0) continue;

          const inferredTagsArray = await callAiApiBatch(booksInChunk, existingTags, apiConfig);
          const resultMap = new Map((inferredTagsArray || []).map(item => [item.id, item.tags]));

          for (const book of booksInChunk) {
            const inferredTags = resultMap.get(book.id);

            if (inferredTags) {
              try {
                const normalizedTags = await matchAndNormalizeTags(db, inferredTags, apiConfig.keepUnknownTags);
                const currentTags = typeof book.tags === 'string' ? JSON.parse(book.tags) : (book.tags || {});
                const mergedTags = mergeTags(currentTags, normalizedTags);

                // Add the 'ai-matched' tag for traceability
                if (!mergedTags.other) {
                  mergedTags.other = [];
                }
                if (!mergedTags.other.includes('ai-matched')) {
                  mergedTags.other.push('ai-matched');
                }

                const bookToSave = { id: book.id, hash: book.hash, title: book.title, tags: mergedTags, status: 'tagged', category: inferredTags.category };
                await saveBookToDatabase(bookToSave);

                console.log(`  🏷️  Saved Tags: ${JSON.stringify(mergedTags)}`);

                const updatedBookForResult = { ...book, tags: mergedTags, status: 'tagged' };
                results.push(updatedBookForResult);
                console.log(`[${processedCount + 1}/${bookIds.length}] ✅ ${book.title}`);
              } catch (e) {
                console.error(`❌ Error processing book ${book.id} (${book.title}):`, e);
                errors.push({ bookId: book.id, error: e.message });
              }
            } else {
              console.error(`❌ AI response did not include tags for book ID ${book.id}`);
              errors.push({ bookId: book.id, error: 'AI did not return tags for this book in the batch.' });
            }
            processedCount++;
            event.sender.send('ai-batch-progress', { current: processedCount, total: bookIds.length });
          }
        } catch (error) {
          console.error(`❌ Batch ${Math.floor(i / batchSize) + 1} failed:`, error);
          for (const bookId of chunkBookIds) {
            if (!results.some(r => r.id === bookId) && !errors.some(e => e.bookId === bookId)) {
              errors.push({ bookId, error: error.message });
              processedCount++;
              event.sender.send('ai-batch-progress', { current: processedCount, total: bookIds.length });
            }
          }
        }

        if (i + batchSize < bookIds.length) {
          await sleep(setting.aiTagDelay || 1000);
        }
      }
      
      console.log('✅ 批量 AI 推断完成。');

      return {
        success: true,
        results,
        errors,
        total: bookIds.length,
        successCount: results.length,
        errorCount: errors.length
      };
    } catch (error) {
      console.error('❌ 批量推断失败:', error);
      return {
        success: false,
        message: error.message
      };
    }
  });
  
  console.log('✅ AI 标签处理器注册完成')
}

/**
 * 获取现有标签列表（优化版，用于 AI 参考）
 * 只返回常用标签，避免列表过长
 */
async function getExistingTagsForAI(db) {
  const books = await db.findAll({
    attributes: ['tags'],
    where: {
      status: 'tagged'
    },
    raw: true
  })
  
  // 统计标签出现次数
  const tagCounts = {}
  
  for (const book of books) {
    let tags = book.tags
    if (typeof tags === 'string') {
      tags = JSON.parse(tags)
    }
    
    if (!tags || typeof tags !== 'object') continue
    
    for (const [category, tagList] of Object.entries(tags)) {
      if (!tagCounts[category]) {
        tagCounts[category] = {}
      }
      
      if (Array.isArray(tagList)) {
        tagList.forEach(tag => {
          if (tag && typeof tag === 'string') {
            const normalized = tag.trim()
            tagCounts[category][normalized] = (tagCounts[category][normalized] || 0) + 1
          }
        })
      }
    }
  }
  
  // 只返回出现次数 >= 3 的标签（常用标签）
  const result = {}
  for (const [category, counts] of Object.entries(tagCounts)) {
    result[category] = Object.entries(counts)
      .filter(([tag, count]) => count >= 3)
      .sort((a, b) => b[1] - a[1]) // 按出现次数排序
      .slice(0, 200) // 每个类别最多 200 个
      .map(([tag]) => tag)
  }
  
  return result
}

/**
 * 调用 AI API 推断标签
 */
async function callAiApi(title, existingTags, apiConfig, setting) {
  const { apiUrl, apiKey, model } = apiConfig;

  console.log('🤖 AI API 配置:', {
    apiUrl,
    model,
    hasApiKey: !!apiKey,
    apiKeyLength: apiKey ? apiKey.length : 0,
  });

  // 构建提示词
  const prompt = buildPrompt(title, existingTags, setting);

  const isGoogleApi = apiUrl.includes('googleapis.com');

  if (isGoogleApi) {
    // Logic for Google Gemini API
    const fullUrl = `${apiUrl}/v1beta/models/${model}:generateContent`;
    console.log('📝 发送请求到 (Google API):', fullUrl);

    const systemPrompt = '你是一个专业的漫画标签分类助手。根据标题推断标签，只返回 JSON 格式。';
    const combinedPrompt = `${systemPrompt}\n\n${prompt}`;

    const requestBody = {
      contents: [
        {
          role: 'user',
          parts: [{ text: combinedPrompt }],
        },
      ],
      generationConfig: {
        response_mime_type: 'application/json',
        temperature: 0.3,
      },
      safetySettings: [
        {
          category: 'HARM_CATEGORY_HARASSMENT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_HATE_SPEECH',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
          threshold: 'BLOCK_NONE',
        },
        {
          category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
          threshold: 'BLOCK_NONE',
        },
      ],
    };

    const response = await fetch(fullUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const data = await response.json();
    
    if (!data.candidates || data.candidates.length === 0 || data.candidates[0].finishReason === 'SAFETY') {
      const safetyRatings = data.candidates?.[0]?.safetyRatings;
      throw new Error(`AI 因为安全原因返回了空响应。Safety Ratings: ${JSON.stringify(safetyRatings)}`);
    }
    
    if (!data.candidates[0].content || !data.candidates[0].content.parts || data.candidates[0].content.parts.length === 0) {
      throw new Error('AI 返回了空的内容。');
    }

    const content = data.candidates[0].content.parts[0].text;
    return JSON.parse(content);
  } else {
    // Existing OpenAI-compatible logic
    console.log('📝 发送请求到:', apiUrl);
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的漫画标签分类助手。根据标题推断标签，只返回 JSON 格式。',
          },
          {
            role: 'user',
            content: prompt,
          },
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`API 请求失败: ${response.status} ${response.statusText} - ${errorBody}`);
    }

    const contentType = response.headers.get('Content-Type');
    if (!contentType || !contentType.includes('application/json')) {
      const errorBody = await response.text();
      throw new Error(`API 返回了非JSON内容。Content-Type: ${contentType || '未知'}。响应体: ${errorBody.substring(0, 200)}...`);
    }

    const data = await response.json();
    const content = data.choices[0].message.content;
    return JSON.parse(content);
  }
}

/**
 * 构建 AI 提示词
 */
function buildPrompt(title, existingTags, setting) {
  const tagExamples = {}
  
  // 为每个类别提供示例（最多 50 个）
  for (const [category, tags] of Object.entries(existingTags)) {
    tagExamples[category] = tags.slice(0, 50)
  }
  
  const categoryOptions = ["Doujinshi", "Manga", "Artist CG", "Game CG", "Non-H", "Image Set", "Western", "Cosplay", "Asian Porn", "Misc"];

  return `**CRITICAL INSTRUCTION**: Your task is to extract information ONLY from the manga TITLE provided. DO NOT use any tags from the "Available tag examples" or "My Favorite Tags" lists unless the name is explicitly written in the title. For example, if the title is "[My Circle (My Artist)] My Title", you must extract "My Circle" and "My Artist". Do not invent or copy tags from the example lists.

请根据以下漫画标题推断标签和分类：

标题：${title}

可选标签列表（仅供参考拼写）：
${JSON.stringify(tagExamples, null, 2)}

我的收藏标签（仅供参考拼写）：
${JSON.stringify((setting.collectTag || []).map(t => t.tag))}

要求：
1. **推断类别**: 从可选类别列表中，为该漫画选择最合适的唯一一个分类。
   可选类别列表: ${JSON.stringify(categoryOptions)}
2. **深入分析标题**: 严格根据标题内容推断，特别是括号 \`[]\` 和 \`()\` 中的内容通常是社团和作者。
3. **丰富内容标签**: 对于 'female' 和 'male' 类别，请根据标题内容大胆推断。这包括但不限于：身体特征 (如 lolicon)、服装 (如 schoolgirl uniform, swimsuit)、情节或行为 (如 rape, netorare, masturbation)、以及角色关系 (如 teacher, sister)。
4. **返回 JSON 格式**: { "category": "...", "parody": [...], "character": [...], "artist": [...], "group": [...], "female": [...], "male": [...] }
5. **使用原文**: 标签名请使用日文/英文原文。

示例：
标题：(C96) [サークル名 (作者名)] キャラ名本 (原作名)
返回：{
  "category": "Doujinshi",
  "parody": ["原作名的英文/罗马音"],
  "character": ["キャラ名的英文/罗马音"],
  "artist": ["作者名的英文/罗马音"],
  "group": ["サークル名的英文/罗马音"],
  "female": [],
  "male": []
}`
}

/**
 * 匹配和规范化标签
 * 将 AI 返回的标签与数据库现有标签进行模糊匹配
 */
async function matchAndNormalizeTags(db, inferredTags, keepUnknownTags = true) {
  // 获取数据库中的所有标签
  const existingTags = await getExistingTagsForAI(db)
  
  const normalized = {}
  console.log('🔄 开始匹配和规范化 AI 标签...');

  for (const [category, tags] of Object.entries(inferredTags)) {
    if (!Array.isArray(tags)) continue
    
    normalized[category] = []
    
    for (const tag of tags) {
      if (!tag || typeof tag !== 'string') continue
      
      const trimmed = tag.trim()
      if (!trimmed) continue
      
      // 尝试在现有标签中找到匹配
      const existingList = existingTags[category] || []
      const matched = findBestMatch(trimmed, existingList, category)
      
      if (matched) {
        if (matched !== trimmed) {
          console.log(`  [匹配] AI 标签 "${trimmed}" 规范化为 "${matched}"`);
        }
        normalized[category].push(matched)
      } else if (keepUnknownTags) {
        console.log(`  [新增] 保留未匹配到的 AI 标签 "${trimmed}"`);
        normalized[category].push(trimmed)
      } else {
        console.log(`  [跳过] 丢弃未匹配到的 AI 标签 "${trimmed}"`);
      }
    }
  }
  
  return normalized
}

/**
 * 模糊匹配标签
 */
function findBestMatch(tag, existingTags, category) {
  const tagLower = tag.toLowerCase()
  
  // 1. 精确匹配（不区分大小写）
  for (const existing of existingTags) {
    if (existing.toLowerCase() === tagLower) {
      return existing
    }
  }
  
  // 2. 翻译匹配
  if (reverseTranslationMap && reverseTranslationMap[category] && reverseTranslationMap[category][tagLower]) {
    const originalTag = reverseTranslationMap[category][tagLower];
    const originalTagLower = originalTag.toLowerCase();
    
    // 优先返回用户数据库中已存在的、与翻译结果匹配的标签（用于大小写规范化）
    for (const existing of existingTags) {
      if (existing.toLowerCase() === originalTagLower) {
        console.log(`  [翻译匹配] AI 标签 "${tag}" -> 翻译库: "${originalTag}" -> 本地库: "${existing}"`);
        return existing;
      }
    }
    
    // 如果本地库不存在，则返回翻译库中的原始标签
    console.log(`  [翻译匹配] AI 标签 "${tag}" -> 翻译库: "${originalTag}" (本地库中无此标签)`);
    return originalTag;
  }

  // 3. 包含匹配
  for (const existing of existingTags) {
    if (existing.toLowerCase().includes(tagLower) || tagLower.includes(existing.toLowerCase())) {
      return existing
    }
  }
  
  // 4. 没有匹配
  return null
}

/**
 * 合并标签（保留现有标签，添加新标签）
 */
function mergeTags(currentTags, newTags) {
  const merged = { ...currentTags }
  
  for (const [category, tags] of Object.entries(newTags)) {
    if (!merged[category]) {
      merged[category] = []
    }
    
    // 去重合并
    const existingSet = new Set(merged[category])
    for (const tag of tags) {
      existingSet.add(tag)
    }
    
    merged[category] = Array.from(existingSet)
  }
  
  return merged
}

/**
 * 延迟函数
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

module.exports = {
  registerAiTagHandlers
}

