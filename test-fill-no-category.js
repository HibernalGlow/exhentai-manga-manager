/**
 * Test script for fill-no-category-metadata feature
 * 测试补全无分类元数据功能
 */

const { 
  buildTitleIndex, 
  findMatchesByTitle,
  refineMatchesWithJapaneseTitle,
  matchByHash
} = require('./modules/sqlite_import')

async function testTitleMatching() {
  console.log('=== Testing Title Matching ===\n')
  
  // Mock data - 模拟数据库标题
  const mockTitles = [
    { gid: 3284417, token: 'e0b29e74f6', title: '温泉 [AI Generated]', title_jpn: '', hash: null },
    { gid: 1234567, token: 'abc123def4', title: '博士の研究 2 上 巫女たちの堕落', title_jpn: '博士の研究', hash: null },
    { gid: 7654321, token: 'fed321cba9', title: '[Artist Name] Sample Title', title_jpn: 'サンプルタイトル', hash: 'test_hash_123' }
  ]
  
  // Build index
  console.log('Building title index...')
  const { titleMap, titleArray, hashIndex } = buildTitleIndex(mockTitles, true)
  console.log(`Index built: ${titleMap.size} unique titles\n`)
  
  // Test Case 1: 精确标题匹配
  console.log('Test 1: Exact title match')
  const test1 = await findMatchesByTitle('温泉 [AI Generated]', '温泉 [AI Generated]', titleMap, titleArray)
  console.log('Result:', test1)
  console.log('Expected: Should match gid 3284417\n')
  
  // Test Case 2: 部分标题匹配
  console.log('Test 2: Partial title match')
  const test2 = await findMatchesByTitle('温泉', '温泉', titleMap, titleArray)
  console.log('Result:', test2)
  console.log('Expected: Should match gid 3284417\n')
  
  // Test Case 3: 日文标题匹配
  console.log('Test 3: Japanese title match')
  const test3 = await findMatchesByTitle('博士の研究', '博士の研究 2 上 巫女たちの堕落', titleMap, titleArray)
  console.log('Result:', test3)
  console.log('Expected: Should match gid 1234567\n')
  
  // Test Case 4: Hash 匹配
  console.log('Test 4: Hash match')
  const mockBook = { hash: 'test_hash_123' }
  const test4 = matchByHash(mockBook, hashIndex)
  console.log('Result:', test4)
  console.log('Expected: Should match gid 7654321\n')
}

async function testUrlTokenExtraction() {
  console.log('=== Testing URL Token Extraction ===\n')
  
  const testUrls = [
    'https://exhentai.org/g/3284417/e0b29e74f6/',
    'https://exhentai.org/g/1234567/abc123def4/',
    'https://e-hentai.org/g/9876543/fedcba9876/'
  ]
  
  for (const url of testUrls) {
    const match = url.match(/\/g\/(\d+)\/([a-f0-9]+)/)
    if (match) {
      const [, gid, token] = match
      console.log(`URL: ${url}`)
      console.log(`  GID: ${gid}`)
      console.log(`  Token: ${token}\n`)
    }
  }
}

// Run tests
async function runTests() {
  try {
    await testUrlTokenExtraction()
    console.log('\n' + '='.repeat(50) + '\n')
    await testTitleMatching()
    console.log('\n✅ All tests completed')
  } catch (error) {
    console.error('❌ Test failed:', error)
  }
}

runTests()
