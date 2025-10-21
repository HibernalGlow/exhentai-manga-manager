/**
 * SHA1匹配测试脚本
 * 用于测试指定的SHA1哈希值是否能在数据库中找到匹配
 */

const path = require('path');
const { open } = require('sqlite');
const sqlite3 = require('sqlite3');
const { matchBySha1InDatabase } = require('./modules/sha1_archive_matcher');

async function testSha1Matching() {
  const testSha1 = '142b429a78a88773031e50b18882f074cfdfffb4';

  console.log('🧪 开始SHA1匹配测试...');
  console.log(`📋 测试SHA1: ${testSha1}`);

  // 数据库路径 - 使用用户指定的数据库
  const dbPath = 'd:\\1VSCODE\\Projects\\ImageAll\\emm-tool\\sql\\api_dump_trimmed.sqlite';

  let db;
  try {
    // 打开数据库
    console.log('📂 打开数据库...');
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database
    });

    console.log('✅ 数据库已打开');

    // 检查数据库结构
    console.log('🔍 检查数据库结构...');
    const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('📋 数据库中的表:', tables.map(t => t.name));

    // 检查Metadata表结构
    const metadataColumns = await db.all("PRAGMA table_info(Metadata)");
    console.log('📋 Metadata表字段:', metadataColumns.map(c => c.name));

    // 检查是否有gallery表
    const hasGallery = tables.some(t => t.name === 'gallery');
    if (hasGallery) {
      console.log('✅ 找到gallery表');
      const galleryColumns = await db.all("PRAGMA table_info(gallery)");
      console.log('📋 Gallery表字段:', galleryColumns.map(c => c.name));

      // 检查gallery表是否有thumb字段
      const hasThumb = galleryColumns.some(c => c.name === 'thumb');
      if (hasThumb) {
        console.log('✅ Gallery表有thumb字段');
      } else {
        console.log('❌ Gallery表没有thumb字段');
      }
    } else {
      console.log('❌ 没有找到gallery表');
      console.log('💡 请先导入EhTagTranslation数据库或配置正确的SQLite数据库路径');
      return;
    }

    // 测试SHA1匹配
    console.log('🔍 开始SHA1匹配...');
    const result = await matchBySha1InDatabase(testSha1, db);

    if (result) {
      console.log('✅ 匹配成功！');
      console.log('📊 匹配结果:');
      console.log(`   GID: ${result.gid}`);
      console.log(`   Token: ${result.token}`);
      console.log(`   Title: ${result.title}`);
      console.log(`   Title_JPN: ${result.title_jpn}`);
      console.log(`   Hash: ${result.hash}`);
      console.log(`   Thumb: ${result.thumb}`);
      console.log(`   Category: ${result.category}`);
      console.log(`   Tags: ${JSON.stringify(result.tags)}`);
    } else {
      console.log('❌ 未找到匹配结果');

      // 尝试直接查询thumb字段看看数据库中有什么
      console.log('🔍 检查数据库中的thumb字段...');
      const thumbResults = await db.all('SELECT thumb, gid, title FROM gallery WHERE thumb LIKE ? LIMIT 5', [`%${testSha1.substring(0, 8)}%`]);
      console.log(`找到 ${thumbResults.length} 条相似记录:`);
      thumbResults.forEach((row, index) => {
        console.log(`   ${index + 1}. Thumb: ${row.thumb}, GID: ${row.gid}, Title: ${row.title}`);
      });
    }

  } catch (error) {
    console.error('💥 测试失败:', error.message);
    console.error(error.stack);
  } finally {
    if (db) {
      await db.close();
      console.log('🔒 数据库已关闭');
    }
  }
}

// 运行测试
testSha1Matching().then(() => {
  console.log('🏁 测试完成');
}).catch(error => {
  console.error('💥 测试过程中发生错误:', error);
});