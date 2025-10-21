/**
 * SHA1 Archive Matcher Module
 * 用于从7z压缩包中读取SHA1记录并进行匹配
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 缓存已读取的SHA1映射，避免重复读取同一压缩包
const sha1Cache = new Map();
const CACHE_MAX_SIZE = 50; // 最大缓存50个压缩包
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10分钟过期

/**
 * 清理过期缓存
 */
function cleanExpiredCache() {
  const now = Date.now();
  let cleanedCount = 0;

  for (const [key, value] of sha1Cache) {
    if (now - value.timestamp > CACHE_EXPIRY_MS) {
      sha1Cache.delete(key);
      cleanedCount++;
    }
  }

  if (cleanedCount > 0) {
    console.log(`[SHA1] 🧹 Cleaned ${cleanedCount} expired cache entries`);
  }
}

/**
 * 获取缓存的SHA1映射
 */
function getCachedSha1Map(archivePath) {
  const cached = sha1Cache.get(archivePath);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
    console.log(`[SHA1] 💾 Cache hit for ${path.basename(archivePath)} (${cached.sha1Map.size} entries, age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    return cached.sha1Map;
  }

  if (cached) {
    console.log(`[SHA1] ⏰ Cache expired for ${path.basename(archivePath)} (age: ${Math.round((Date.now() - cached.timestamp) / 1000)}s)`);
    sha1Cache.delete(archivePath);
  }

  return null;
}

/**
 * 设置缓存的SHA1映射
 */
function setCachedSha1Map(archivePath, sha1Map) {
  // 清理过期缓存
  cleanExpiredCache();

  // 如果缓存过大，删除最旧的条目
  if (sha1Cache.size >= CACHE_MAX_SIZE) {
    let oldestKey = null;
    let oldestTime = Date.now();
    for (const [key, value] of sha1Cache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      console.log(`[SHA1] 🗑️ Cache full (${CACHE_MAX_SIZE}), evicting oldest: ${path.basename(oldestKey)}`);
      sha1Cache.delete(oldestKey);
    }
  }

  sha1Cache.set(archivePath, {
    sha1Map,
    timestamp: Date.now()
  });

  console.log(`[SHA1] 💾 Cached SHA1 map for ${path.basename(archivePath)} (${sha1Map.size} entries, cache size: ${sha1Cache.size}/${CACHE_MAX_SIZE})`);
}

/**
 * 从7z压缩包中提取SHA1记录文件（支持多个.sha1文件）
 * @param {string} archivePath - 7z压缩包路径
 * @returns {Promise<string>} SHA1记录文件内容（合并所有.sha1文件）
 */
async function extractSha1Records(archivePath) {
  return new Promise((resolve, reject) => {
    const sevenZipPath = path.join(__dirname, '..', 'resources', 'extraResources', '7z.exe');

    console.log(`[SHA1] 🔍 Starting SHA1 extraction from archive: ${path.basename(archivePath)}`);

    // 设置超时（30秒）
    const timeout = setTimeout(() => {
      console.error(`[SHA1] ⏰ Timeout: 7z operation exceeded 30 seconds for ${path.basename(archivePath)}`);
      reject(new Error('7z extract timeout after 30 seconds'));
    }, 30000);

    // 首先列出压缩包内容，查找.sha1文件
    console.log(`[SHA1] 📋 Listing archive contents...`);
    const listProcess = spawn(sevenZipPath, ['l', archivePath]);

    let listOutput = '';
    listProcess.stdout.on('data', (data) => {
      listOutput += data.toString();
    });

    listProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        console.error(`[SHA1] ❌ 7z list failed with exit code ${code} for ${path.basename(archivePath)}`);
        reject(new Error(`7z list failed with code ${code}`));
        return;
      }

      console.log(`[SHA1] ✅ Archive listing completed (${listOutput.length} bytes of output)`);

      // 解析输出，查找所有.sha1文件
      const lines = listOutput.split('\n');
      const sha1Files = [];

      // 查找所有.sha1文件
      for (const line of lines) {
        const match = line.match(/\s+(\S+\.sha1)\s*$/i);
        if (match) {
          sha1Files.push(match[1]);
        }
      }

      if (sha1Files.length === 0) {
        console.warn(`[SHA1] ⚠️ No .sha1 files found in archive: ${path.basename(archivePath)}`);
        reject(new Error('No .sha1 file found in archive'));
        return;
      }

      console.log(`[SHA1] 📁 Found ${sha1Files.length} .sha1 file(s) in archive: ${sha1Files.join(', ')}`);

      // 依次提取所有SHA1文件的内容
      extractAllSha1Files(sha1Files, archivePath, sevenZipPath, resolve, reject);
    });

    listProcess.on('error', (error) => {
      clearTimeout(timeout);
      console.error(`[SHA1] 💥 7z list process error for ${path.basename(archivePath)}:`, error.message);
      reject(error);
    });
  });
}

/**
 * 依次提取所有SHA1文件的内容
 * @param {string[]} sha1Files - SHA1文件名数组
 * @param {string} archivePath - 压缩包路径
 * @param {string} sevenZipPath - 7z.exe路径
 * @param {Function} resolve - Promise resolve函数
 * @param {Function} reject - Promise reject函数
 */
function extractAllSha1Files(sha1Files, archivePath, sevenZipPath, resolve, reject) {
  let combinedContent = '';
  let currentIndex = 0;
  const startTime = Date.now();

  console.log(`[SHA1] 🚀 Starting extraction of ${sha1Files.length} SHA1 file(s) from ${path.basename(archivePath)}`);

  function extractNext() {
    if (currentIndex >= sha1Files.length) {
      // 所有文件都已提取完成
      const totalTime = Date.now() - startTime;
      const totalSize = combinedContent.length;
      console.log(`[SHA1] ✅ All SHA1 files extracted successfully (${totalSize} bytes, ${totalTime}ms)`);
      resolve(combinedContent);
      return;
    }

    const sha1File = sha1Files[currentIndex];
    const fileStartTime = Date.now();
    console.log(`[SHA1] 📄 Extracting ${sha1File} (${currentIndex + 1}/${sha1Files.length})`);

    const extractProcess = spawn(sevenZipPath, ['e', archivePath, sha1File, '-so']);

    let fileContent = '';
    extractProcess.stdout.on('data', (data) => {
      fileContent += data.toString();
    });

    extractProcess.on('close', (code) => {
      if (code === 0) {
        const fileSize = fileContent.length;
        const fileTime = Date.now() - fileStartTime;

        // 合并内容，每个文件之间用换行符分隔
        if (combinedContent && fileContent) {
          combinedContent += '\n';
        }
        combinedContent += fileContent;

        console.log(`[SHA1] ✅ Extracted ${sha1File} (${fileSize} bytes, ${fileTime}ms)`);

        currentIndex++;
        extractNext(); // 处理下一个文件
      } else {
        console.error(`[SHA1] ❌ 7z extract failed for ${sha1File} with exit code ${code}`);
        reject(new Error(`7z extract failed for ${sha1File} with code ${code}`));
      }
    });

    extractProcess.on('error', (error) => {
      console.error(`[SHA1] 💥 7z extract process error for ${sha1File}:`, error.message);
      reject(new Error(`7z extract error for ${sha1File}: ${error.message}`));
    });
  }

  // 开始提取第一个文件
  extractNext();
}

/**
 * 解析SHA1记录内容（优化版）
 * @param {string} content - SHA1记录文件内容
 * @returns {Map<string, string>} 文件名到SHA1的映射
 */
function parseSha1Records(content) {
  const sha1Map = new Map();
  const lines = content.split('\n');

  console.log(`[SHA1] 🔍 Parsing SHA1 records (${lines.length} lines of content)`);

  // SHA1哈希验证正则表达式（预编译以提高性能）
  const sha1Regex = /^[a-f0-9]{40}$/i;
  let validRecords = 0;
  let invalidRecords = 0;
  let emptyLines = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      emptyLines++;
      continue;
    }

    if (!trimmed.includes('*')) {
      invalidRecords++;
      console.warn(`[SHA1] ⚠️ Invalid line format (no '*'): ${trimmed.substring(0, 50)}...`);
      continue;
    }

    // 使用indexOf优化分割
    const starIndex = trimmed.indexOf('*');
    if (starIndex === -1) {
      invalidRecords++;
      continue;
    }

    const filename = trimmed.substring(0, starIndex).trim();
    const hash = trimmed.substring(starIndex + 1).trim();

    // 验证SHA1格式（使用预编译正则表达式）
    if (sha1Regex.test(hash)) {
      sha1Map.set(filename, hash);
      validRecords++;
    } else {
      invalidRecords++;
      console.warn(`[SHA1] ⚠️ Invalid SHA1 hash format: ${hash} for file: ${filename}`);
    }
  }

  console.log(`[SHA1] 📊 Parse results: ${validRecords} valid records, ${invalidRecords} invalid, ${emptyLines} empty lines`);
  console.log(`[SHA1] 🗺️ Created SHA1 map with ${sha1Map.size} entries`);

  return sha1Map;
}

/**
 * 从压缩包中获取SHA1映射（带缓存）
 * @param {string} archivePath - 压缩包路径
 * @returns {Promise<Map<string, string>>} 文件名到SHA1的映射
 */
async function getSha1MapFromArchive(archivePath) {
  // 检查缓存
  const cached = getCachedSha1Map(archivePath);
  if (cached) {
    console.log(`[SHA1] 💾 Using cached SHA1 map for ${path.basename(archivePath)} (${cached.size} entries)`);
    return cached;
  }

  console.log(`[SHA1] 🔄 Processing archive: ${path.basename(archivePath)}`);

  try {
    const content = await extractSha1Records(archivePath);
    const sha1Map = parseSha1Records(content);

    // 缓存结果
    setCachedSha1Map(archivePath, sha1Map);

    console.log(`[SHA1] ✅ Successfully processed ${path.basename(archivePath)} (${sha1Map.size} SHA1 records)`);

    return sha1Map;
  } catch (error) {
    console.error(`[SHA1] ❌ Failed to get SHA1 map from archive ${path.basename(archivePath)}:`, error.message);
    // 返回空Map而不是抛出错误，保持系统稳定性
    return new Map();
  }
}

/**
 * 根据文件名匹配SHA1（支持路径和文件名）
 * @param {string} filename - 文件名或路径
 * @param {Map<string, string>} sha1Map - SHA1映射
 * @returns {string|null} 匹配的SHA1或null
 */
function matchSha1ByFilename(filename, sha1Map) {
  if (!filename || !sha1Map || sha1Map.size === 0) {
    console.log(`[SHA1] ⚠️ Invalid input for filename matching: filename=${!!filename}, mapSize=${sha1Map?.size || 0}`);
    return null;
  }

  // 直接匹配完整路径
  if (sha1Map.has(filename)) {
    const sha1 = sha1Map.get(filename);
    console.log(`[SHA1] ✅ Direct path match: "${filename}" -> ${sha1}`);
    return sha1;
  }

  // 提取纯文件名进行匹配
  const basename = path.basename(filename);

  // 总是尝试匹配basename，无论是否包含路径
  for (const [key, value] of sha1Map) {
    const keyBasename = path.basename(key);
    if (keyBasename === basename) {
      console.log(`[SHA1] ✅ Basename match: "${basename}" -> ${value} (from "${key}")`);
      return value;
    }
  }

  console.log(`[SHA1] ❌ No SHA1 match found for: "${filename}" (basename: "${basename}")`);
  return null;
}

/**
 * 数据库匹配函数 - 使用SHA1进行精确匹配
 * @param {string} sha1 - SHA1哈希值
 * @param {Object} db - 数据库连接
 * @returns {Promise<Object|null>} 匹配的元数据或null
 */
async function matchBySha1InDatabase(sha1, db) {
  if (!sha1 || !/^[a-f0-9]{40}$/i.test(sha1)) {
    console.log(`[SHA1] ⚠️ Invalid SHA1 hash format: ${sha1}`);
    return null;
  }

  try {
    console.log(`[SHA1] 🔍 Querying database for SHA1: ${sha1}`);
    const sql = 'SELECT * FROM Metadata WHERE hash = ?';
    const result = await db.get(sql, sha1);

    if (result) {
      console.log(`[SHA1] ✅ Database match found: gid=${result.gid}, token=${result.token}, title="${result.title}"`);
      return result;
    } else {
      console.log(`[SHA1] ❌ No database match found for SHA1: ${sha1}`);
      return null;
    }
  } catch (error) {
    console.error(`[SHA1] 💥 Database query error for SHA1 ${sha1}:`, error.message);
    return null;
  }
}

/**
 * 使用压缩包中的SHA1记录进行匹配
 * @param {string} archivePath - 压缩包路径
 * @param {string} filename - 文件名
 * @param {Object} db - 数据库连接
 * @returns {Promise<Object|null>} 匹配结果或null
 */
async function matchBySha1FromArchive(archivePath, filename, db) {
  try {
    // 从压缩包中获取SHA1映射
    const sha1Map = await getSha1MapFromArchive(archivePath);
    if (sha1Map.size === 0) {
      return null;
    }

    // 根据文件名匹配SHA1
    const sha1 = matchSha1ByFilename(filename, sha1Map);
    if (!sha1) {
      return null;
    }

    console.log(`[SHA1] "${filename}" -> Found SHA1: ${sha1}`);

    // 使用SHA1在数据库中匹配
    const metadata = await matchBySha1InDatabase(sha1, db);
    if (metadata) {
      console.log(`[SHA1] "${filename}" -> ✅ Database match found: gid=${metadata.gid}, token=${metadata.token}`);
      return {
        gid: metadata.gid,
        token: metadata.token,
        hash: sha1,
        source: 'sha1_archive'
      };
    }

    return null;
  } catch (error) {
    console.error('SHA1 archive matching error:', error);
    return null;
  }
}

/**
 * 清除SHA1缓存
 */
function clearSha1Cache() {
  sha1Cache.clear();
  console.log('🗑️ SHA1缓存已清除');
}

/**
 * 获取缓存统计信息
 */
function getCacheStats() {
  return {
    size: sha1Cache.size,
    maxSize: CACHE_MAX_SIZE,
    expiryMs: CACHE_EXPIRY_MS
  };
}

module.exports = {
  extractSha1Records,
  parseSha1Records,
  getSha1MapFromArchive,
  matchSha1ByFilename,
  matchBySha1InDatabase,
  matchBySha1FromArchive,
  clearSha1Cache,
  getCacheStats
};