const assert = require('assert');
const { findMatchesByTitle, buildTitleIndex } = require('./sqlite_import.js');

async function runTests() {
    // 1. Setup mock data
    const mockDbData = [
        { gid: 1, token: 'a', title: '崩铁 布朗尼尔', title_jpn: '崩坏：星穹铁道 布洛妮娅' },
        { gid: 2, token: 'b', title: '桜井宁宁 nikke 拉毗 71p', title_jpn: '' },
        { gid: 3, token: 'c', title: 'fgo 妖兰满破', title_jpn: 'fgo メリュジーヌ' },
        { gid: 4, token: 'd', title: 'no', title_jpn: '' },
        { gid: 5, token: 'e', title: 'some other title', title_jpn: '' },
        { gid: 6, token: 'f', title: '碧蓝航线 英仙座护士', title_jpn: 'Azur lane HMS Perseus Nurse' },
        { gid: 7, token: 'g', title: '碧蓝航线 安克雷奇旗袍', title_jpn: 'Azur lane Anchorage Cheongsam' },
        { gid: 8, token: 'h', title: 'fgo 术呆女仆', title_jpn: 'fgo Artoria Caster Maid' },
    ];

    const { titleMap, titleArray } = buildTitleIndex(mockDbData, false);

    // 2. Define test cases
    const testCases = [
        {
            description: 'Should match CJK title with spaces and hyphens',
            searchTerm: '崩铁 - 布朗尼尔',
            originalFilename: '崩铁 - 布朗尼尔.zip',
            expectedGid: 1,
        },
        {
            description: 'Should use CJK part as keyword and find a match',
            searchTerm: 'nikke - 拉毗',
            originalFilename: 'nikke - 拉毗 [14P-13.2MB][屿鱼 Yukako].zip',
            expectedGid: 2,
        },
        {
            description: 'Should match based on CJK keyword, ignoring noise',
            searchTerm: 'NO.006 妖兰满破',
            originalFilename: 'NO.006 妖兰满破 [17P-151MB][小野寺地瓜].zip',
            expectedGid: 3,
        },
        {
            description: 'Should match the correct "术呆" book and not "no"',
            searchTerm: 'NO.010 术呆女仆',
            originalFilename: 'NO.010 术呆女仆 [12P-129MB][小野寺地瓜].zip',
            expectedGid: 8,
        },
        {
            description: 'Should match the exact title, not a different one from the same series',
            searchTerm: '碧蓝航线 安克雷奇旗袍',
            originalFilename: '碧蓝航线 安克雷奇旗袍 [30P-41.8MB][屿鱼 Yukako].zip',
            expectedGid: 7,
        },
    ];

    // 3. Run tests
    for (const tc of testCases) {
        console.log(`\nRunning test: ${tc.description}`);
        const results = await findMatchesByTitle(tc.searchTerm, tc.originalFilename, titleMap, titleArray, 'test');
        
        if (tc.expectedGid) {
            assert(results && results.length > 0, `Expected a match for "${tc.searchTerm}" but got none.`);
            const foundGid = results[0].gid;
            assert.strictEqual(foundGid, tc.expectedGid, `Expected GID ${tc.expectedGid} but found ${foundGid} for "${tc.searchTerm}"`);
            console.log(`✅ PASSED: "${tc.searchTerm}" matched GID ${foundGid}`);
        } else {
            if (results && results.length > 0) {
                 assert.fail(`Expected no match for "${tc.searchTerm}" but it matched GID ${results[0].gid}`);
            } else {
                console.log(`✅ PASSED: "${tc.searchTerm}" was correctly not matched.`);
            }
        }
    }

    console.log('\nAll tests passed!');
}

runTests().catch(err => {
    console.error('\n❌ Test failed:', err.message);
    process.exit(1);
});
