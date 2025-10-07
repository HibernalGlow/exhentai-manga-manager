/**
 * Test script for translation module
 * 翻译模块测试脚本
 */

const { translateTitleToChinese } = require('./translation.js')

async function testTranslation() {
  console.log('🧪 开始测试翻译功能...\n')

  // 测试用例 1: 日文标题
  try {
    console.log('测试 1: 日文标题翻译')
    console.log('输入:')
    console.log('  英文: Example Comic')
    console.log('  日文: [C97] サンプル漫画 (作者名) [中国翻訳]')
    console.log('  文件名: sample.zip')
    
    const result1 = await translateTitleToChinese(
      'Example Comic',
      '[C97] サンプル漫画 (作者名) [中国翻訳]',
      'sample.zip'
    )
    
    console.log('结果:')
    console.log('  中文译名:', result1.chinese_title)
    console.log('  后备方案:', result1.fallback ? '是' : '否')
    console.log('✅ 测试 1 通过\n')
  } catch (e) {
    console.error('❌ 测试 1 失败:', e.message, '\n')
  }

  // 测试用例 2: 纯英文标题
  try {
    console.log('测试 2: 英文标题翻译')
    console.log('输入:')
    console.log('  英文: [COMIC1☆15] Amazing Adventure Story [English]')
    console.log('  日文: (无)')
    console.log('  文件名: amazing-adventure.zip')
    
    const result2 = await translateTitleToChinese(
      '[COMIC1☆15] Amazing Adventure Story [English]',
      '',
      'amazing-adventure.zip'
    )
    
    console.log('结果:')
    console.log('  中文译名:', result2.chinese_title)
    console.log('  后备方案:', result2.fallback ? '是' : '否')
    console.log('✅ 测试 2 通过\n')
  } catch (e) {
    console.error('❌ 测试 2 失败:', e.message, '\n')
  }

  // 测试用例 3: 应该被排除的文件（纯数字）
  try {
    console.log('测试 3: 纯数字文件名（应被排除）')
    console.log('输入:')
    console.log('  英文: Some Title')
    console.log('  日文: タイトル')
    console.log('  文件名: 12345.zip')
    
    await translateTitleToChinese(
      'Some Title',
      'タイトル',
      '12345.zip'
    )
    
    console.error('❌ 测试 3 失败: 应该抛出异常但没有\n')
  } catch (e) {
    console.log('结果: 已正确排除')
    console.log('  错误信息:', e.message)
    console.log('✅ 测试 3 通过\n')
  }

  // 测试用例 4: 应该被排除的文件（纯中文）
  try {
    console.log('测试 4: 纯中文文件名（应被排除）')
    console.log('输入:')
    console.log('  英文: Some Title')
    console.log('  日文: タイトル')
    console.log('  文件名: 测试文件.zip')
    
    await translateTitleToChinese(
      'Some Title',
      'タイトル',
      '测试文件.zip'
    )
    
    console.error('❌ 测试 4 失败: 应该抛出异常但没有\n')
  } catch (e) {
    console.log('结果: 已正确排除')
    console.log('  错误信息:', e.message)
    console.log('✅ 测试 4 通过\n')
  }

  console.log('🎉 测试完成!')
}

// 运行测试
testTranslation().catch(console.error)
