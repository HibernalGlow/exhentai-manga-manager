import TAG_DICT from './tag-dict.json'

// 1) Canonical options from pinia.js
const CATEGORY_OPTIONS = [
  'Doujinshi',
  'Manga',
  'Artist CG',
  'Game CG',
  'Non-H',
  'Image Set',
  'Western',
  'Cosplay',
  'Asian Porn',
  'Misc',
]

function normKey(s) {
  // fold accents, lowercase, collapse non-alnum
  const base = s.normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

function classifyMiscTags(misc) {
  const out = { female: [], male: [], mixed: [], cosplayer: [], other: [], rest: [] }
  const seen = {
    female: new Set(), male: new Set(), mixed: new Set(), other: new Set(),
  }

  for (const raw of misc ?? []) {
    const t = raw?.trim()
    if (!t) continue

    // Try direct, then normalized key
    const direct = (TAG_DICT)[t]
    let cat = direct ?? (TAG_DICT)[normKey(t)] ?? 'other'
    if (!(cat in seen)) cat = 'other'

    if (!seen[cat].has(t)) {
      seen[cat].add(t)
      out[cat].push(t)
    }
  }
  return out
}

// --- helpers  ---
function buildFacetDict(meta) {
  const out = {}

  const add = (k, arr) => {
    const cleaned = Array.from(new Set((arr ?? []).map(s => s.trim()).filter(Boolean)))
    if (cleaned.length) out[k] = cleaned
  }

  add('artist', meta.artists)
  add('group', meta.groups)
  add('language', meta.languages)
  add('parody', meta.parodies)
  add('character', meta.characters)

  const cats = classifyMiscTags(meta.misc ?? [])
  for (const k of ['female', 'male', 'mixed', 'cosplayer', 'rest', 'other']) {
    if (cats[k].length) out[k] = cats[k]
  }

  return out
}

function findContainer(boxes, label) {
  const wanted = label.toLowerCase()
  for (const el of Array.from(boxes)) {
    let labelText = ''
    for (const n of Array.from(el.childNodes)) {
      if (n.nodeType === Node.TEXT_NODE) labelText += n.textContent || ''
      else break
    }
    const norm = labelText.trim().replace(/:$/, '').toLowerCase()
    if (norm === wanted) return el
  }
  return null
}

function extractList(boxes, label) {
  const box = findContainer(boxes, label)
  if (!box) return []
  const out = new Set()
  box.querySelectorAll('span.tags a .name').forEach((n) => {
    const v = (n.textContent || '').trim()
    if (v) out.add(v)
  })
  return Array.from(out)
}

// 2) Category enforcement
const toKey = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const CATEGORY_MAP = CATEGORY_OPTIONS.reduce((acc, c) => {
  acc[toKey(c)] = c
  return acc
}, {})

/** Pick the first recognized category; fallback to "Misc" */
function pickCategory(candidates) {
  for (const raw of candidates) {
    const key = toKey(raw)
    if (CATEGORY_MAP[key]) return CATEGORY_MAP[key]
  }
  return 'Misc'
}

function parseNhentaiApiResponse(apiData) {
  console.log('[NH Parser] Parsing API response')
  
  // Extract title information
  const title = apiData.title?.english || apiData.title?.pretty || ''
  const title_jpn = apiData.title?.japanese || ''
  
  console.log('[NH Parser] Extracted title:', title)
  console.log('[NH Parser] Extracted title_jpn:', title_jpn)
  
  // Parse tags array - tags contain type information
  const artists = []
  const groups = []
  const languages = []
  const parodies = []
  const characters = []
  const misc = []
  const categories = []
  
  if (apiData.tags && Array.isArray(apiData.tags)) {
    console.log('[NH Parser] Processing', apiData.tags.length, 'tags')
    
    for (const tag of apiData.tags) {
      const tagName = tag.name
      const tagType = tag.type
      
      switch (tagType) {
        case 'artist':
          artists.push(tagName)
          break
        case 'group':
          groups.push(tagName)
          break
        case 'language':
          languages.push(tagName)
          break
        case 'parody':
          parodies.push(tagName)
          break
        case 'character':
          characters.push(tagName)
          break
        case 'category':
          categories.push(tagName)
          break
        case 'tag':
          misc.push(tagName)
          break
        default:
          console.warn('[NH Parser] Unknown tag type:', tagType, 'for tag:', tagName)
          misc.push(tagName)
      }
    }
  }
  
  console.log('[NH Parser] Tag counts:', {
    artists: artists.length,
    groups: groups.length,
    languages: languages.length,
    parodies: parodies.length,
    characters: characters.length,
    categories: categories.length,
    misc: misc.length
  })
  
  // Pick category
  const category = pickCategory(categories)
  
  // Get page count
  const pages = apiData.num_pages || 0
  
  let tags = {} // to be filled by buildFacetDict
  return { title, title_jpn, category, artists, groups, languages, pages, parodies, characters, misc, tags }
}

function parseNhentaiInfo(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const boxes = doc.querySelectorAll('#info-block #tags .tag-container.field-name')
  const getText = (sel) => (doc.querySelector(sel)?.textContent || '').trim()
  
  console.log('[NH Parser] Found tag containers:', boxes.length)
  console.log('[NH Parser] Document title:', doc.title)

  // there are two title lines;
  const title = getText('#info-block h1.title .pretty') || getText('#info-block h1.title') || ''
  const title_jpn = getText('#info-block h2.title .pretty') || getText('#info-block h2.title') || ''
  
  console.log('[NH Parser] Extracted title:', title)
  console.log('[NH Parser] Extracted title_jpn:', title_jpn)

  const categoriesList = extractList(boxes, 'Categories')
  const category = pickCategory(categoriesList)
  const artists = extractList(boxes, 'Artists')
  const groups = extractList(boxes, 'Groups')
  const languages = extractList(boxes, 'Languages')
  const parodies = extractList(boxes, 'Parodies')
  const characters = extractList(boxes, 'Characters')
  const misc = extractList(boxes, 'Tags')

  let pages = 0
  const pagesBox = findContainer(boxes, 'Pages')
  if (pagesBox) {
    const raw = (pagesBox.querySelector('.tags .name')?.textContent || '').trim()
    const n = parseInt(raw, 10)
    pages = Number.isFinite(n) ? n : 0
  }
  let tags = {} // to be filled
  return { title, title_jpn, category, artists, groups, languages, pages, parodies, characters, misc, tags }
}

export async function fetchNhentaiMeta(url, wcId) {
  console.log('[NH Scraper] fetchNhentaiMeta called with:', { url, wcId })
  
  // Extract gallery ID from URL
  // URL format: https://nhentai.net/g/426159/ or https://nhentai.net/g/426159
  const match = url.match(/\/g\/(\d+)/)
  if (!match) {
    throw new Error('Invalid nhentai URL format. Expected: https://nhentai.net/g/[id]/')
  }
  const galleryId = match[1]
  console.log('[NH Scraper] Extracted gallery ID:', galleryId)
  
  // Use nhentai's JSON API instead of parsing HTML
  const apiUrl = `https://nhentai.net/api/gallery/${galleryId}`
  console.log('[NH Scraper] Fetching from API:', apiUrl)
  
  let jsonData
  if (wcId) {
    // Use search session when wcId is provided (from browser dialog)
    console.log('[NH Scraper] Using searchSessionFetchUrl with wcId')
    const jsonText = await window.ipcRenderer.invoke('searchSessionFetchUrl', { url: apiUrl, wcId })
    jsonData = JSON.parse(jsonText)
  } else {
    // Use get-ex-webpage when no wcId (from main window/batch operation)
    console.log('[NH Scraper] Using get-ex-webpage (no wcId)')
    const jsonText = await window.ipcRenderer.invoke('get-ex-webpage', {
      url: apiUrl,
      cookie: '' // nhentai doesn't need cookies
    })
    
    if (!jsonText) {
      throw new Error('Empty response from API')
    }
    
    console.log('[NH Scraper] Received JSON from API, length:', jsonText.length)
    
    try {
      jsonData = JSON.parse(jsonText)
    } catch (e) {
      console.error('[NH Scraper] Failed to parse JSON:', e)
      console.log('[NH Scraper] Response preview:', jsonText.substring(0, 500))
      throw new Error('Failed to parse API response: ' + e.message)
    }
  }
  
  console.log('[NH Scraper] Parsing API data...')
  const data = parseNhentaiApiResponse(jsonData)
  console.log('[NH Scraper] Parsed data:', {
    title: data.title?.substring(0, 50),
    category: data.category,
    artists: data.artists?.length,
    groups: data.groups?.length,
    misc: data.misc?.length,
    pages: data.pages
  })
  
  console.log('[NH Scraper] Building facet dict...')
  data.tags = buildFacetDict(data)
  console.log('[NH Scraper] Tags built:', Object.keys(data.tags))
  
  return data
}

export async function fetchNhentaiPartialMeta(url, wcId) {
  const data = await fetchNhentaiMeta(url, wcId)
  // Include all available tags, not just groups and artists
  const tags = Object.fromEntries(
    Object.entries(data.tags).filter(([, v]) =>
      Array.isArray(v) ? v.length > 0 : Boolean(v),
    ),
  )
  return { category: data.category, tags }
}