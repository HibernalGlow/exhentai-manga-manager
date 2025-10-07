/**
 * Migration tool: JSON to SQLite database
 * 迁移工具：从JSON文件迁移到SQLite数据库
 */

const path = require('path')
const { STORE_PATH } = require('./init_folder_setting.js')
const { migrateFromJSON, getTranslationStats } = require('./translation_db.js')

const TRANSLATIONS_FILE = path.join(STORE_PATH, 'translations.json')

async function migrate() {
  console.log('\n========================================')
  console.log('Translation Data Migration Tool')
  console.log('JSON → SQLite Database')
  console.log('========================================\n')
  
  console.log(`Source: ${TRANSLATIONS_FILE}`)
  console.log(`Target: ${path.join(STORE_PATH, 'translations.db')}\n`)
  
  try {
    console.log('Starting migration...\n')
    
    const fs = require('fs')
    
    // Check if JSON file exists
    if (!fs.existsSync(TRANSLATIONS_FILE)) {
      console.log('❌ No JSON file found, nothing to migrate.')
      console.log('If you already migrated, the original file has been backed up to:')
      console.log(`   ${TRANSLATIONS_FILE}.backup\n`)
      return
    }
    
    // Show JSON file size
    const stats = fs.statSync(TRANSLATIONS_FILE)
    console.log(`JSON file size: ${(stats.size / 1024).toFixed(2)} KB`)
    
    // Count entries
    const data = fs.readFileSync(TRANSLATIONS_FILE, 'utf8')
    const translations = JSON.parse(data)
    const entryCount = Object.keys(translations).length
    console.log(`Total entries: ${entryCount}\n`)
    
    if (entryCount === 0) {
      console.log('⚠️  JSON file is empty, skipping migration.')
      return
    }
    
    // Confirm migration
    console.log('This will:')
    console.log('  1. Migrate all translations to SQLite database')
    console.log('  2. Backup original JSON file to translations.json.backup')
    console.log('  3. Remove the original JSON file\n')
    
    // Auto-confirm in script mode
    console.log('Proceeding with migration...\n')
    
    const result = await migrateFromJSON(TRANSLATIONS_FILE)
    
    console.log('\n========================================')
    console.log('Migration Results:')
    console.log(`  ✅ Success: ${result.success}`)
    console.log(`  ❌ Failed:  ${result.failed}`)
    console.log('========================================\n')
    
    // Show database statistics
    const dbStats = await getTranslationStats()
    console.log('Database Statistics:')
    console.log(`  Total:      ${dbStats.total}`)
    console.log(`  Successful: ${dbStats.successful}`)
    console.log(`  Fallback:   ${dbStats.fallback}\n`)
    
    console.log('✅ Migration completed successfully!')
    console.log('\nBackup file location:')
    console.log(`   ${TRANSLATIONS_FILE}.backup\n`)
    
    console.log('Note: You can safely delete the backup file after verifying the migration.')
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error)
    console.error(error.stack)
    console.log('\nThe original JSON file has NOT been modified.')
  }
}

// Run migration
migrate().then(() => {
  console.log('\nMigration script completed.')
  process.exit(0)
}).catch(error => {
  console.error('\nMigration script error:', error)
  process.exit(1)
})
