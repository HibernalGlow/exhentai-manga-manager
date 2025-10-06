/**
 * Test script for string similarity algorithms
 * 相似度算法测试脚本
 */

const {
  normalizeString,
  calculateSimilarity,
  levenshteinDistance,
  jaccardSimilarity,
  getLCSLength,
  generateVariants
} = require('./modules/string_utils.js');

// Test cases for similarity algorithms
// 相似度算法测试用例
const testCases = [
  // Exact matches - 完全匹配
  { str1: "hello world", str2: "hello world", expected: 1.0, description: "完全相同的字符串" },

  // Similar strings - 相似字符串
  { str1: "hello world", str2: "hello wrld", expected: 0.5, description: "单个字符差异" },
  { str1: "test string", str2: "test string!", expected: 1.0, description: "标点符号差异" },
  { str1: "hello", str2: "helo", expected: 0.8, description: "插入字符" },
  { str1: "world", str2: "word", expected: 0.8, description: "删除字符" },

  // Chinese text tests - 中文文本测试
  { str1: "你好世界", str2: "你好世界", expected: 1.0, description: "中文完全匹配" },
  { str1: "你好世界", str2: "你好", expected: 0.5, description: "中文部分匹配" },
  { str1: "第一卷", str2: "第1卷", expected: 0.9, description: "中英文数字转换" },

  // Normalization tests - 归一化测试
  { str1: "Hello　World", str2: "Hello World", expected: 1.0, description: "全角空格归一化" },
  { str1: "Ｈｅｌｌｏ", str2: "Hello", expected: 1.0, description: "全角字母归一化" },

  // Edge cases - 边界情况
  { str1: "", str2: "", expected: 0, description: "空字符串" },
  { str1: "a", str2: "", expected: 0, description: "一个空字符串" },
  { str1: "abc", str2: "def", expected: 0.1, description: "完全不同字符串" },

  // Special cases - 特殊情况
  { str1: "test + bonus", str2: "test", expected: 1.0, description: "移除附加内容" },
  { str1: "島さん xi", str2: "島さん", expected: 0.9, description: "移除拼音错误" },
  { str1: "第一话", str2: "第一话", expected: 1.0, description: "中文数字" },
  { str1: "第1话", str2: "第一话", expected: 0.95, description: "数字转换相似" },
];

// Function to run tests
// 运行测试函数
function runSimilarityTests() {
  console.log("=== 相似度算法测试 ===\n");

  let passed = 0;
  let total = testCases.length;

  testCases.forEach((testCase, index) => {
    const { str1, str2, expected, description } = testCase;
    const similarity = calculateSimilarity(str1, str2);
    const testPassed = Math.abs(similarity - expected) < 0.15; // Allow 15% tolerance

    console.log(`测试 ${index + 1}: ${description}`);
    console.log(`  输入: "${str1}" vs "${str2}"`);
    console.log(`  相似度: ${similarity.toFixed(3)} (期望: ${expected.toFixed(3)})`);
    console.log(`  结果: ${testPassed ? '✓ 通过' : '✗ 失败'}`);
    console.log();

    if (testPassed) passed++;
  });

  console.log(`=== 测试结果: ${passed}/${total} 通过 ===\n`);
}

// Test individual algorithm components
// 测试单个算法组件
function testAlgorithmComponents() {
  console.log("=== 算法组件测试 ===\n");

  const testStrings = [
    ["hello", "hello"],
    ["hello", "helo"],
    ["abc", "def"],
    ["你好", "你好世界"]
  ];

  testStrings.forEach(([str1, str2], index) => {
    console.log(`测试对 ${index + 1}: "${str1}" vs "${str2}"`);

    const lev = levenshteinDistance(str1, str2);
    const jaccard = jaccardSimilarity(str1, str2);
    const lcs = getLCSLength(str1, str2);
    const combined = calculateSimilarity(str1, str2);

    console.log(`  编辑距离: ${lev}`);
    console.log(`  Jaccard相似度: ${jaccard.toFixed(3)}`);
    console.log(`  LCS长度: ${lcs}`);
    console.log(`  综合相似度: ${combined.toFixed(3)}`);
    console.log();
  });
}

// Test variant generation
// 测试变体生成
function testVariantGeneration() {
  console.log("=== 变体生成测试 ===\n");

  const testStrings = [
    "Hello World",
    "第一卷 + おまけ本",
    "島さん xi",
    "第1话"
  ];

  testStrings.forEach((str, index) => {
    console.log(`变体 ${index + 1}: "${str}"`);
    const variants = generateVariants(str);
    console.log(`  生成变体数量: ${variants.length}`);
    variants.slice(0, 5).forEach((variant, i) => {
      console.log(`    变体 ${i + 1}: "${variant}"`);
    });
    if (variants.length > 5) {
      console.log(`    ... 还有 ${variants.length - 5} 个变体`);
    }
    console.log();
  });
}

// Test normalization
// 测试归一化
function testNormalization() {
  console.log("=== 归一化测试 ===\n");

  const testStrings = [
    "Ｈｅｌｌｏ　Ｗｏｒｌｄ",
    "Hello　World　　",
    "你好　世界",
    "①②③"
  ];

  testStrings.forEach((str, index) => {
    const normalized = normalizeString(str);
    console.log(`归一化 ${index + 1}:`);
    console.log(`  原始: "${str}"`);
    console.log(`  归一化: "${normalized}"`);
    console.log();
  });

  // 测试标点符号移除
  console.log("=== 标点符号移除测试 ===\n");
  const punctuationTests = [
    "test string!",
    "test, string.",
    "test? string!"
  ];

  punctuationTests.forEach((str, index) => {
    const { removePunctuation } = require('./modules/string_utils.js');
    const withoutPunct = removePunctuation(str);
    console.log(`标点测试 ${index + 1}:`);
    console.log(`  原始: "${str}"`);
    console.log(`  移除标点: "${withoutPunct}"`);
    console.log();
  });
}

// Run all tests
// 运行所有测试
function runAllTests() {
  testNormalization();
  testAlgorithmComponents();
  testVariantGeneration();
  runSimilarityTests();
}

// Export for use in other files
// 导出供其他文件使用
if (require.main === module) {
  runAllTests();
}

module.exports = {
  runSimilarityTests,
  testAlgorithmComponents,
  testVariantGeneration,
  testNormalization,
  runAllTests
};