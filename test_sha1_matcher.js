/**
 * SHA1 Archive Matcher Test Script
 * 测试SHA1压缩包匹配功能
 */

const path = require('path');
const { getSha1MapFromArchive, parseSha1Records, matchSha1ByFilename } = require('./modules/sha1_archive_matcher');

async function testSha1ArchiveMatcher() {
  console.log('🧪 开始测试SHA1压缩包匹配功能...\n');

  // 测试1: 解析SHA1记录字符串
  console.log('📝 测试1: 解析SHA1记录字符串');
  const testContent = `(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_000.jpg *87136935d1e581ebc7a59479608c6501f9d0a817
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_001.jpg *c5b5477bbf262c2ca0e2a4a9d2ebe584b69850fb
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_002.jpg *848a9025c3aafadb528848640b61e0eff839d1a1`;

  const sha1Map = parseSha1Records(testContent);
  console.log('✅ 解析结果:', Object.fromEntries(sha1Map));
  console.log('📊 记录数量:', sha1Map.size);

  // 测试2: 文件名匹配
  console.log('\n🔍 测试2: 文件名匹配');
  const testFilename = 'CE_947_000.jpg';
  const matchedSha1 = matchSha1ByFilename(testFilename, sha1Map);
  console.log(`文件名 "${testFilename}" 匹配到的SHA1:`, matchedSha1);

  // 测试3: 不存在的文件
  console.log('\n❌ 测试3: 不存在的文件');
  const nonExistentFile = 'nonexistent.jpg';
  const noMatch = matchSha1ByFilename(nonExistentFile, sha1Map);
  console.log(`不存在的文件 "${nonExistentFile}" 匹配结果:`, noMatch);

  // 测试5: 性能测试
  console.log('\n⚡ 测试5: 性能测试');
  const largeSha1Map = new Map();
  // 生成10000个测试记录
  for (let i = 0; i < 10000; i++) {
    const filename = `test_${i.toString().padStart(4, '0')}.jpg`;
    const sha1 = 'a'.repeat(40 - i.toString().length) + i.toString();
    largeSha1Map.set(filename, sha1);
  }

  console.log('📊 大数据集大小:', largeSha1Map.size);

  const startTime = Date.now();
  for (let i = 0; i < 1000; i++) {
    const testFile = `test_${(i % 10000).toString().padStart(4, '0')}.jpg`;
    matchSha1ByFilename(testFile, largeSha1Map);
  }
  const endTime = Date.now();
  const duration = endTime - startTime;

  console.log(`⏱️ 1000次匹配耗时: ${duration}ms`);
  console.log(`📈 平均每次匹配: ${(duration / 1000).toFixed(3)}ms`);

  console.log('\n🎉 所有测试完成!');
}

// 运行测试
if (require.main === module) {
  testSha1ArchiveMatcher().catch(console.error);
}

module.exports = { testSha1ArchiveMatcher };