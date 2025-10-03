/**
 * Test script for nhentai search and metadata fetching flow
 * Usage: node test-nhentai-flow.js
 */

const https = require('https');
const http = require('http');

// Test title
const testTitle = 'シュッポになれば先生の理性も崩壊するかもしれない！';
console.log('=== Testing nhentai Flow ===');
console.log('Test title:', testTitle);
console.log('');

// Step 1: Test search
async function testSearch(title) {
  console.log('--- Step 1: Testing Search ---');
  const encodedTitle = encodeURIComponent(title);
  const searchUrl = `https://nhentai.net/search/?q=${encodedTitle}`;
  console.log('Search URL:', searchUrl);
  
  return new Promise((resolve, reject) => {
    https.get(searchUrl, (res) => {
      console.log('Response status:', res.statusCode, res.statusMessage);
      console.log('Response headers:', JSON.stringify(res.headers, null, 2));
      
      let html = '';
      res.on('data', (chunk) => {
        html += chunk;
      });
      
      res.on('end', () => {
        console.log('Received HTML length:', html.length);
        resolve(html);
      });
    }).on('error', (err) => {
      console.error('Search request failed:', err.message);
      reject(err);
    });
  });
}

// Step 2: Parse search results
function parseSearchResults(html) {
  console.log('');
  console.log('--- Step 2: Parsing Search Results ---');
  
  // Simple regex-based parsing (since we don't have DOMParser in Node.js)
  const galleryRegex = /<a href="(\/g\/\d+\/)"/g;
  const captionRegex = /<div class="caption">([^<]+)<\/div>/g;
  
  const urls = [];
  const titles = [];
  
  let match;
  while ((match = galleryRegex.exec(html)) !== null) {
    urls.push(match[1]);
  }
  
  while ((match = captionRegex.exec(html)) !== null) {
    titles.push(match[1].trim());
  }
  
  console.log('Found URLs:', urls.length);
  console.log('Found titles:', titles.length);
  
  const results = [];
  for (let i = 0; i < Math.min(urls.length, titles.length); i++) {
    results.push({
      url: `https://nhentai.net${urls[i]}`,
      title: titles[i]
    });
  }
  
  console.log('Parsed results:');
  results.slice(0, 5).forEach((r, i) => {
    console.log(`  ${i + 1}. ${r.title}`);
    console.log(`     ${r.url}`);
  });
  
  return results;
}

// Step 3: Fetch metadata from gallery page
async function fetchMetadata(galleryUrl) {
  console.log('');
  console.log('--- Step 3: Fetching Metadata ---');
  console.log('Gallery URL:', galleryUrl);
  
  return new Promise((resolve, reject) => {
    https.get(galleryUrl, (res) => {
      console.log('Response status:', res.statusCode, res.statusMessage);
      
      let html = '';
      res.on('data', (chunk) => {
        html += chunk;
      });
      
      res.on('end', () => {
        console.log('Received HTML length:', html.length);
        resolve(html);
      });
    }).on('error', (err) => {
      console.error('Metadata request failed:', err.message);
      reject(err);
    });
  });
}

// Step 4: Parse metadata
function parseMetadata(html) {
  console.log('');
  console.log('--- Step 4: Parsing Metadata ---');
  
  // Extract title
  const titleMatch = html.match(/<h1[^>]*class="title"[^>]*>(?:<span[^>]*>)?([^<]+)/);
  const title = titleMatch ? titleMatch[1].trim() : 'Not found';
  
  // Extract Japanese title
  const titleJpnMatch = html.match(/<h2[^>]*class="title"[^>]*>(?:<span[^>]*>)?([^<]+)/);
  const title_jpn = titleJpnMatch ? titleJpnMatch[1].trim() : 'Not found';
  
  // Extract category
  const categoryMatch = html.match(/Categories:<\/div>[\s\S]*?<span class="name">([^<]+)<\/span>/);
  const category = categoryMatch ? categoryMatch[1].trim() : 'Not found';
  
  // Extract pages
  const pagesMatch = html.match(/Pages:<\/div>[\s\S]*?<span class="name">(\d+)<\/span>/);
  const pages = pagesMatch ? parseInt(pagesMatch[1], 10) : 0;
  
  // Extract tags by type
  const extractTags = (label) => {
    const regex = new RegExp(`${label}:<\\/div>[\\s\\S]*?<span class="tags"[^>]*>([\\s\\S]*?)<\\/span>`, 'i');
    const match = html.match(regex);
    if (!match) return [];
    
    const tagRegex = /<span class="name">([^<]+)<\/span>/g;
    const tags = [];
    let tagMatch;
    while ((tagMatch = tagRegex.exec(match[1])) !== null) {
      tags.push(tagMatch[1].trim());
    }
    return tags;
  };
  
  const artists = extractTags('Artists?');
  const groups = extractTags('Groups?');
  const languages = extractTags('Languages?');
  const parodies = extractTags('Parodies?');
  const characters = extractTags('Characters?');
  const tags = extractTags('Tags');
  
  const metadata = {
    title,
    title_jpn,
    category,
    pages,
    artists,
    groups,
    languages,
    parodies,
    characters,
    tags: tags.slice(0, 10) // Show first 10 tags
  };
  
  console.log('Parsed metadata:');
  console.log(JSON.stringify(metadata, null, 2));
  
  return metadata;
}

// Main test flow
async function runTest() {
  try {
    // Step 1: Search
    const searchHtml = await testSearch(testTitle);
    
    // Step 2: Parse results
    const results = parseSearchResults(searchHtml);
    
    if (results.length === 0) {
      console.log('');
      console.log('❌ No search results found!');
      console.log('This could be due to:');
      console.log('  1. Network issues (cannot access nhentai.net)');
      console.log('  2. HTML structure changed');
      console.log('  3. No matching results for this title');
      return;
    }
    
    console.log('');
    console.log(`✅ Found ${results.length} results`);
    
    // Step 3 & 4: Fetch and parse metadata for first result
    const firstResult = results[0];
    console.log('');
    console.log(`Using first result: ${firstResult.title}`);
    
    const galleryHtml = await fetchMetadata(firstResult.url);
    const metadata = parseMetadata(galleryHtml);
    
    console.log('');
    console.log('=== Test Summary ===');
    console.log('✅ Search: OK');
    console.log(`✅ Results parsed: ${results.length} items`);
    console.log('✅ Metadata fetched: OK');
    console.log('✅ Metadata parsed: OK');
    console.log('');
    console.log('Full flow completed successfully! 🎉');
    
  } catch (error) {
    console.error('');
    console.error('❌ Test failed:', error.message);
    console.error('Stack:', error.stack);
    
    if (error.code === 'ENOTFOUND') {
      console.error('');
      console.error('Network error: Cannot resolve nhentai.net');
      console.error('This usually means:');
      console.error('  1. No internet connection');
      console.error('  2. DNS issues');
      console.error('  3. Need proxy/VPN to access nhentai');
    } else if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
      console.error('');
      console.error('Connection timeout');
      console.error('This usually means:');
      console.error('  1. nhentai.net is blocked');
      console.error('  2. Network is too slow');
      console.error('  3. Need proxy/VPN');
    }
  }
}

// Run the test
runTest();
