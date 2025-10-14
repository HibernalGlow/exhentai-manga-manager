/**
 * SHA1 Archive Matcher 测试脚本
 */

const { parseSha1Records, matchSha1ByFilename } = require('./modules/sha1_archive_matcher')

// 测试SHA1记录解析
function testSha1Parsing() {
  console.log('🧪 测试SHA1记录解析功能')

  const testContent = `(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_000.jpg *87136935d1e581ebc7a59479608c6501f9d0a817
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_001.jpg *c5b5477bbf262c2ca0e2a4a9d2ebe584b69850fb
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_002.jpg *848a9025c3aafadb528848640b61e0eff839d1a1
invalid line without asterisk
*invalid line without filename
filename.txt *invalidhash
filename2.txt *a665a45920422f9d417e4867efdc4fb8a04a1f3f`

  const sha1Map = parseSha1Records(testContent)

  console.log('📊 解析结果:')
  console.log(`   总共解析到 ${sha1Map.size} 个有效SHA1记录`)

  for (const [filename, hash] of sha1Map) {
    console.log(`   ${filename} -> ${hash}`)
  }

  // 测试文件名匹配
  console.log('\n🔍 测试文件名匹配:')
  const testFilenames = [
    'CE_947_000.jpg',
    '(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_000.jpg',
    'ce_947_000.jpg', // 测试大小写不敏感
    'nonexistent.jpg'
  ]

  for (const filename of testFilenames) {
    const matchedSha1 = matchSha1ByFilename(filename, sha1Map)
    console.log(`   "${filename}" -> ${matchedSha1 || '未匹配'}`)
  }

  console.log('✅ SHA1解析测试完成\n')
}

// 验证SHA1哈希格式
function testSha1Validation() {
  console.log('🔍 测试SHA1哈希格式验证')

  const testHashes = [
    'a665a45920422f9d417e4867efdc4fb8a04a1f3f', // 有效
    'A665A45920422F9D417E4867EFDC4FB8A04A1F3F', // 有效（大写）
    '87136935d1e581ebc7a59479608c6501f9d0a817', // 有效
    'invalid', // 无效
    'a665a45920422f9d417e4867efdc4fb8a04a1f3ff', // 无效（41位）
    'a665a45920422f9d417e4867efdc4fb8a04a1f3', // 无效（39位）
    'g665a45920422f9d417e4867efdc4fb8a04a1f3f' // 无效（包含g）
  ]

  const sha1Regex = /^[a-f0-9]{40}$/i

  for (const hash of testHashes) {
    const isValid = sha1Regex.test(hash)
    console.log(`   ${hash} -> ${isValid ? '✅ 有效' : '❌ 无效'}`)
  }

  console.log('✅ SHA1格式验证测试完成\n')
}

// 运行所有测试
function runTests() {
  console.log('🚀 开始SHA1 Archive Matcher测试\n')

  testSha1Parsing()
  testSha1Validation()

  console.log('🎉 所有测试完成！')
}

// 如果直接运行此脚本，则执行测试
if (require.main === module) {
  runTests()
}

module.exports = { runTests }