/**
 * 测试流式翻译功能
 */

const OpenAI = require('openai')
const fs = require('fs')
const path = require('path')

// 读取配置
const configPath = path.join(
  process.env.APPDATA || path.join(process.env.USERPROFILE, 'AppData', 'Roaming'),
  'exhentai-manga-manager',
  'ai_api_config.json'
)

console.log('📂 Reading config from:', configPath)

if (!fs.existsSync(configPath)) {
  console.error('❌ Config file not found!')
  process.exit(1)
}

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'))
const activeProvider = config.providers[config.activeIndex || 0]

console.log('✅ Using provider:', activeProvider.name)
console.log('🔧 Model:', activeProvider.model)
console.log('🌐 Base URL:', activeProvider.baseUrl)
console.log('')

// 测试书籍
const testBooks = [
  {
    hash: 'test1',
    title: '[Example] Black Dog: The Holy Maiden is Defiled',
    title_jpn: '黒犬 聖女は汚される',
    filename: '[Example] Black Dog - The Holy Maiden is Defiled'
  },
  {
    hash: 'test2',
    title: '[C97] Summer Love Story',
    title_jpn: '夏の恋物語',
    filename: '[C97][Author] Summer Love Story'
  },
  {
    hash: 'test3',
    title: 'Forbidden Romance Chapter 5',
    title_jpn: '禁断の恋 第5章',
    filename: 'Forbidden Romance Ch5'
  }
]

console.log('🚀 Starting streaming translation test...\n')
console.log('📚 Test books:')
testBooks.forEach((book, i) => {
  console.log(`  ${i + 1}. ${book.filename}`)
})
console.log('\n' + '='.repeat(80))
console.log('📡 Streaming output:\n')

async function test() {
  try {
    // 构建提示词
    const booksInfo = testBooks.map((book, index) => {
      return `${index + 1}. 
   英文标题: ${book.title || '无'}
   日文标题: ${book.title_jpn || '无'}
   文件名: ${book.filename || '无'}`
    }).join('\n\n')

    const prompt = `请将以下${testBooks.length}个漫画标题翻译成简洁的中文作品名。

${booksInfo}

要求：
1. 每个标题单独翻译，保持编号 给你的可能是罗马音日文中文英文混杂的作品名 翻译的时候不要只翻译为中文就好了 应该贴合原作二次元的人名用语
2. 只返回作品名，不包含展会信息、翻译者、汉化组等 但是不能过少 不能只翻译前面第一段的内容 翻译完整的作品名
3. 保持简洁自然的中文表达
4. 去除所有方括号、圆括号内的附加信息
5. 严格按照 "编号. 中文译名" 的格式返回

返回格式示例：
1. 某作品名
2. 另一作品名
3. 第三个作品名

请直接返回翻译结果，每行一个，不要任何额外解释：`
    
    // 创建 OpenAI 客户端
    const openai = new OpenAI({
      apiKey: activeProvider.apiKey,
      baseURL: activeProvider.baseUrl,
      timeout: 30000
    })
    
    // 流式调用
    const stream = await openai.chat.completions.create({
      model: activeProvider.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
      stream: true
    })
    
    let responseText = ''
    let currentLine = ''
    const translations = []
    
    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content || ''
      if (content) {
        responseText += content
        currentLine += content
        
        // 实时输出到控制台
        process.stdout.write(content)
        
        // 检查完整行
        const lines = currentLine.split('\n')
        if (lines.length > 1) {
          for (let i = 0; i < lines.length - 1; i++) {
            const line = lines[i].trim()
            const match = line.match(/^(\d+)\.\s*(.+)$/)
            if (match) {
              const index = parseInt(match[1]) - 1
              const translation = match[2].trim().replace(/^["'《]|["'》]$/g, '')
              
              if (index < testBooks.length) {
                translations[index] = translation
                console.log(`\n\n✅ [Parsed] #${index + 1}: ${testBooks[index].filename}`)
                console.log(`   -> ${translation}`)
                console.log('   ' + '-'.repeat(70))
              }
            }
          }
          currentLine = lines[lines.length - 1]
        }
      }
    }
    
    console.log('\n\n' + '='.repeat(80))
    console.log('\n✅ Final results:')
    translations.forEach((translation, i) => {
      console.log(`  ${i + 1}. ${testBooks[i].filename}`)
      console.log(`     -> ${translation || '❌ 解析失败'}`)
    })
    
  } catch (error) {
    console.error('\n❌ Test failed:', error.message)
    console.error(error.stack)
  }
}

test()
