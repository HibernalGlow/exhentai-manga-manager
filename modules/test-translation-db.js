/**
 * Test script for translation database
 * 翻译数据库测试脚本
 */

const path = require('path')
const os = require('os')

// Mock STORE_PATH for testing
const STORE_PATH = path.join(os.tmpdir(), 'emm-translation-test')
const fs = require('fs')
if (!fs.existsSync(STORE_PATH)) {
  fs.mkdirSync(STORE_PATH, { recursive: true })
}

// Override STORE_PATH before requiring translation_db
const initFolderSetting = require.resolve('./init_folder_setting.js')
delete require.cache[initFolderSetting]
require.cache[initFolderSetting] = {
  exports: { STORE_PATH },
  loaded: true
}

const {
  initTranslationDatabase,
  getTranslation,
  saveTranslation,
  hasTranslation,
  getAllTranslations,
  getTranslationsBatch,
  deleteTranslation,
  getTranslationStats,
  exportToJSON,
  TRANSLATION_DB_PATH
} = require('./translation_db.js')

async function runTests() {
  console.log('\n========================================')
  console.log('Translation Database Test')
  console.log('========================================\n')
  
  console.log(`Database Path: ${TRANSLATION_DB_PATH}\n`)
  
  try {
    // Test 1: Initialize database
    console.log('Test 1: Initialize database...')
    const { sequelize, Translation } = initTranslationDatabase()
    await sequelize.sync()
    console.log('✅ Database initialized\n')
    
    // Test 2: Save translations
    console.log('Test 2: Save sample translations...')
    const testData = [
      {
        hash: 'test_hash_001',
        chinese_title: '测试漫画标题1',
        original_english: 'Test Manga Title 1',
        original_japanese: 'テスト漫画タイトル1',
        filename: 'test_file_1.zip',
        fallback: false
      },
      {
        hash: 'test_hash_002',
        chinese_title: '测试漫画标题2',
        original_english: 'Test Manga Title 2',
        original_japanese: 'テスト漫画タイトル2',
        filename: 'test_file_2.zip',
        fallback: false
      },
      {
        hash: 'test_hash_003',
        chinese_title: '翻译失败',
        original_english: 'Failed Translation',
        original_japanese: null,
        filename: 'test_file_3.zip',
        fallback: true
      }
    ]
    
    for (const data of testData) {
      await saveTranslation(data.hash, data)
    }
    console.log(`✅ Saved ${testData.length} translations\n`)
    
    // Test 3: Get single translation
    console.log('Test 3: Get single translation...')
    const translation1 = await getTranslation('test_hash_001')
    console.log('Retrieved:', translation1)
    console.log('✅ Get single translation works\n')
    
    // Test 4: Check if translation exists
    console.log('Test 4: Check translation existence...')
    const exists1 = await hasTranslation('test_hash_001')
    const exists2 = await hasTranslation('nonexistent_hash')
    console.log(`test_hash_001 exists: ${exists1}`)
    console.log(`nonexistent_hash exists: ${exists2}`)
    console.log('✅ Check existence works\n')
    
    // Test 5: Batch get translations
    console.log('Test 5: Batch get translations...')
    const batchHashes = ['test_hash_001', 'test_hash_002', 'test_hash_003']
    const batchResults = await getTranslationsBatch(batchHashes)
    console.log(`Retrieved ${Object.keys(batchResults).length} translations in batch`)
    console.log('Hashes:', Object.keys(batchResults))
    console.log('✅ Batch get works\n')
    
    // Test 6: Get all translations
    console.log('Test 6: Get all translations...')
    const allTranslations = await getAllTranslations()
    console.log(`Total translations: ${allTranslations.length}`)
    console.log('✅ Get all translations works\n')
    
    // Test 7: Get statistics
    console.log('Test 7: Get statistics...')
    const stats = await getTranslationStats()
    console.log('Statistics:', stats)
    console.log('✅ Get statistics works\n')
    
    // Test 8: Update translation (upsert)
    console.log('Test 8: Update existing translation...')
    await saveTranslation('test_hash_001', {
      chinese_title: '更新后的标题1',
      original_english: 'Updated Title 1',
      original_japanese: '更新されたタイトル1',
      filename: 'updated_file_1.zip',
      fallback: false
    })
    const updatedTranslation = await getTranslation('test_hash_001')
    console.log('Updated translation:', updatedTranslation.chinese_title)
    console.log('✅ Update translation works\n')
    
    // Test 9: Export to JSON
    console.log('Test 9: Export to JSON...')
    const exportPath = path.join(STORE_PATH, 'translations_export_test.json')
    await exportToJSON(exportPath)
    console.log(`✅ Exported to: ${exportPath}\n`)
    
    // Test 10: Delete translation
    console.log('Test 10: Delete translation...')
    await deleteTranslation('test_hash_003')
    const deletedExists = await hasTranslation('test_hash_003')
    console.log(`test_hash_003 exists after deletion: ${deletedExists}`)
    console.log('✅ Delete translation works\n')
    
    // Final statistics
    console.log('Final statistics:')
    const finalStats = await getTranslationStats()
    console.log(finalStats)
    
    console.log('\n========================================')
    console.log('All tests passed! ✅')
    console.log('========================================\n')
    
    console.log('Note: Test data has been saved to:')
    console.log(`      ${STORE_PATH}`)
    console.log('Test database will be cleaned up after closing connection.')
    
    // Close database connection before cleanup
    if (sequelize) {
      await sequelize.close()
      console.log('✅ Database connection closed.')
    }
    
    // Cleanup test database
    const fs = require('fs')
    setTimeout(() => {
      try {
        if (fs.existsSync(TRANSLATION_DB_PATH)) {
          fs.unlinkSync(TRANSLATION_DB_PATH)
          console.log('✅ Test database cleaned up.')
        }
      } catch (e) {
        console.log('⚠️  Could not clean up test database:', e.message)
        console.log('   You can manually delete:', TRANSLATION_DB_PATH)
      }
    }, 100)
    
  } catch (error) {
    console.error('\n❌ Test failed:', error)
    console.error(error.stack)
  }
}

// Run tests
runTests().then(() => {
  console.log('\nTest script completed.')
  process.exit(0)
}).catch(error => {
  console.error('\nTest script error:', error)
  process.exit(1)
})
