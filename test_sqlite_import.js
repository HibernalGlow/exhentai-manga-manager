/**
 * Test script for sqlite_import matching optimization
 * 测试脚本：用于测试 sqlite_import 匹配优化效果
 */

const { buildTitleIndex, findMatchesByTitle } = require('./modules/sqlite_import')
const { normalizeString } = require('./modules/string_utils')

// Mock database records for testing
const mockTitles = [
  { gid: 1001, token: 'token1', title: 'Marked-girls Vol.1', title_jpn: 'Marked-girls Vol.1' },
  { gid: 1002, token: 'token2', title: 'Marked-girls Vol.2', title_jpn: 'Marked-girls Vol.2' },
  { gid: 1003, token: 'token3', title: 'Marked-girls Vol.14', title_jpn: 'Marked-girls Vol.14' },
  { gid: 1004, token: 'token4', title: 'Marked-two Vol.1', title_jpn: 'Marked-two Vol.1' },
  { gid: 1005, token: 'token5', title: 'Marked-two code:3', title_jpn: 'Marked-two code:3' },
  { gid: 1006, token: 'token6', title: 'Marked-two code:4', title_jpn: 'Marked-two code:4' },
  { gid: 2001, token: 'token_sao1', title: 'Sword Art Online: Darkness 1.0', title_jpn: 'ソードアート・オンライン ダークネス 1.0' },
  { gid: 2002, token: 'token_sao2', title: 'Sword Art Online: Darkness 2.0', title_jpn: 'ソードアート・オンライン ダークネス 2.0' },
  { gid: 2003, token: 'token_sao3', title: 'SAO Darkness 1.0 ~ それいけ！最前線くん～', title_jpn: 'SAO Darkness 1.0 ~ それいけ！最前線くん～' },
  { gid: 2004, token: 'token_sao4', title: 'SAO Darkness 2.0 ~ それいけ！最前線くん～', title_jpn: 'SAO Darkness 2.0 ~ それいけ！最前線くん～' },
  { gid: 3001, token: 'token_series1', title: '本日のお宿', title_jpn: '本日のお宿' },
  { gid: 3002, token: 'token_series2', title: 'Different Title', title_jpn: 'Different Title' },
]

// Test cases - series works and long titles
const testCases = [
  'Marked-girls Vol.14',
  'Marked-two code：4',
  'SAO Darkness 2.0 ~ それいけ！最前線くん～',
  'SAO Darkness 1.0 ~ それいけ！最前線くん～',
  '本日のお宿',
  'Marked-girls Vol.1', // Test existing exact match
  'Sword Art Online: Darkness 1.0', // Test different format
  'サキちゃんのなつやすみ おじいちゃんといっしょ！', // Long Japanese title
  'エロマンガアカデミー', // Another long title
  '世界迷作官能童話劇場 三匹の子豚' // Very long title
]

async function runTests() {
  console.log('🏗️ Building title index...')
  const { titleMap, titleArray } = buildTitleIndex(mockTitles, false)

  console.log(`📊 Index built: ${titleArray.length} titles`)

  for (const testCase of testCases) {
    console.log(`\n🔍 Testing: "${testCase}"`)
    try {
      const result = await findMatchesByTitle(testCase, testCase, titleMap, titleArray, 'test')
      if (result && result.length > 0) {
        console.log(`✅ Matched: gid=${result[0].gid}, token=${result[0].token}`)
      } else {
        console.log('❌ No match found')
      }
    } catch (error) {
      console.error('❌ Error:', error.message)
    }
  }
}

// Run tests if this script is executed directly
if (require.main === module) {
  runTests().catch(console.error)
}

module.exports = { runTests }