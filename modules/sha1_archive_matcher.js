/**
 * SHA1 Archive Matcher Module
 * 用于从7z压缩包中读取SHA1记录并进行匹配
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// 缓存已读取的SHA1映射，避免重复读取同一压缩包
const sha1Cache = new Map();
const CACHE_MAX_SIZE = 50; // 最大缓存50个压缩包
const CACHE_EXPIRY_MS = 10 * 60 * 1000; // 10分钟过期

/**
 * 清理过期缓存
 */
function cleanExpiredCache() {
  const now = Date.now();
  for (const [key, value] of sha1Cache) {
    if (now - value.timestamp > CACHE_EXPIRY_MS) {
      sha1Cache.delete(key);
    }
  }
}

/**
 * 获取缓存的SHA1映射
 */
function getCachedSha1Map(archivePath) {
  const cached = sha1Cache.get(archivePath);
  if (cached && Date.now() - cached.timestamp < CACHE_EXPIRY_MS) {
    return cached.sha1Map;
  }
  return null;
}

/**
 * 设置缓存的SHA1映射
 */
function setCachedSha1Map(archivePath, sha1Map) {
  // 清理过期缓存
  cleanExpiredCache();

  // 如果缓存过大，删除最旧的条目
  if (sha1Cache.size >= CACHE_MAX_SIZE) {
    let oldestKey = null;
    let oldestTime = Date.now();
    for (const [key, value] of sha1Cache) {
      if (value.timestamp < oldestTime) {
        oldestTime = value.timestamp;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      sha1Cache.delete(oldestKey);
    }
  }

  sha1Cache.set(archivePath, {
    sha1Map,
    timestamp: Date.now()
  });
}

/**
 * 从7z压缩包中提取SHA1记录文件（优化版）
 * @param {string} archivePath - 7z压缩包路径
 * @returns {Promise<string>} SHA1记录文件内容
 */
async function extractSha1Records(archivePath) {
  return new Promise((resolve, reject) => {
    const sevenZipPath = path.join(__dirname, '..', 'resources', 'extraResources', '7z.exe');

    // 设置超时（30秒）
    const timeout = setTimeout(() => {
      reject(new Error('7z extract timeout after 30 seconds'));
    }, 30000);

    // 首先列出压缩包内容，查找.sha1文件
    const listProcess = spawn(sevenZipPath, ['l', archivePath]);

    let listOutput = '';
    listProcess.stdout.on('data', (data) => {
      listOutput += data.toString();
    });

    listProcess.on('close', (code) => {
      clearTimeout(timeout);
      if (code !== 0) {
        reject(new Error(`7z list failed with code ${code}`));
        return;
      }

      // 解析输出，查找.sha1文件
      const lines = listOutput.split('\n');
      let sha1File = null;

      // 查找.sha1文件
      for (const line of lines) {
        const match = line.match(/\s+(\S+\.sha1)\s*$/i);
        if (match) {
          sha1File = match[1];
          break;
        }
      }

      if (!sha1File) {
        reject(new Error('No .sha1 file found in archive'));
        return;
      }

      // 提取SHA1记录文件
      const extractProcess = spawn(sevenZipPath, ['e', archivePath, sha1File, '-so']);

      let content = '';
      extractProcess.stdout.on('data', (data) => {
        content += data.toString();
      });

      extractProcess.on('close', (code) => {
        if (code === 0) {
          resolve(content);
        } else {
          reject(new Error(`7z extract failed with code ${code}`));
        }
      });

      extractProcess.on('error', (error) => {
        reject(error);
      });
    });

    listProcess.on('error', (error) => {
      clearTimeout(timeout);
      reject(error);
    });
  });
}

/**
 * 解析SHA1记录内容（优化版）
 * @param {string} content - SHA1记录文件内容
 * @returns {Map<string, string>} 文件名到SHA1的映射
 */
function parseSha1Records(content) {
  const sha1Map = new Map();
  const lines = content.split('\n');

  // SHA1哈希验证正则表达式（预编译以提高性能）
  const sha1Regex = /^[a-f0-9]{40}$/i;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.includes('*')) {
      continue;
    }

    // 使用indexOf优化分割
    const starIndex = trimmed.indexOf('*');
    if (starIndex === -1) continue;

    const filename = trimmed.substring(0, starIndex).trim();
    const hash = trimmed.substring(starIndex + 1).trim();

    // 验证SHA1格式（使用预编译正则表达式）
    if (sha1Regex.test(hash)) {
      sha1Map.set(filename, hash);
    }
  }

  return sha1Map;
}

/**
 * 从压缩包中获取SHA1映射（带缓存）
 * @param {string} archivePath - 压缩包路径
 * @returns {Promise<Map<string, string>>} 文件名到SHA1的映射
 */
async function getSha1MapFromArchive(archivePath) {
  // 检查缓存
  const cached = getCachedSha1Map(archivePath);
  if (cached) {
    return cached;
  }

  try {
    const content = await extractSha1Records(archivePath);
    const sha1Map = parseSha1Records(content);

    // 缓存结果
    setCachedSha1Map(archivePath, sha1Map);

    return sha1Map;
  } catch (error) {
    console.error('Failed to get SHA1 map from archive:', error);
    // 返回空Map而不是抛出错误，保持系统稳定性
    return new Map();
  }
}

/**
 * 根据文件名匹配SHA1（支持路径和文件名）
 * @param {string} filename - 文件名或路径
 * @param {Map<string, string>} sha1Map - SHA1映射
 * @returns {string|null} 匹配的SHA1或null
 */
function matchSha1ByFilename(filename, sha1Map) {
  if (!filename || !sha1Map || sha1Map.size === 0) {
    return null;
  }

  // 直接匹配完整路径
  if (sha1Map.has(filename)) {
    return sha1Map.get(filename);
  }

  // 提取纯文件名进行匹配
  const basename = path.basename(filename);

  // 总是尝试匹配basename，无论是否包含路径
  for (const [key, value] of sha1Map) {
    const keyBasename = path.basename(key);
    if (keyBasename === basename) {
      return value;
    }
  }

  return null;
}

/**
 * 数据库匹配函数 - 使用SHA1进行精确匹配
 * @param {string} sha1 - SHA1哈希值
 * @param {Object} db - 数据库连接
 * @returns {Promise<Object|null>} 匹配的元数据或null
 */
async function matchBySha1InDatabase(sha1, db) {
  if (!sha1 || !/^[a-f0-9]{40}$/i.test(sha1)) {
    return null;
  }

  try {
    const sql = 'SELECT * FROM Metadata WHERE hash = ?';
    const result = await db.get(sql, sha1);
    return result || null;
  } catch (error) {
    console.error('Database SHA1 match error:', error);
    return null;
  }
}

/**
 * 使用压缩包中的SHA1记录进行匹配
 * @param {string} archivePath - 压缩包路径
 * @param {string} filename - 文件名
 * @param {Object} db - 数据库连接
 * @returns {Promise<Object|null>} 匹配结果或null
 */
async function matchBySha1FromArchive(archivePath, filename, db) {
  try {
    // 从压缩包中获取SHA1映射
    const sha1Map = await getSha1MapFromArchive(archivePath);
    if (sha1Map.size === 0) {
      return null;
    }

    // 根据文件名匹配SHA1
    const sha1 = matchSha1ByFilename(filename, sha1Map);
    if (!sha1) {
      return null;
    }

    console.log(`[SHA1] "${filename}" -> Found SHA1: ${sha1}`);

    // 使用SHA1在数据库中匹配
    const metadata = await matchBySha1InDatabase(sha1, db);
    if (metadata) {
      console.log(`[SHA1] "${filename}" -> ✅ Database match found: gid=${metadata.gid}, token=${metadata.token}`);
      return {
        gid: metadata.gid,
        token: metadata.token,
        hash: sha1,
        source: 'sha1_archive'
      };
    }

    return null;
  } catch (error) {
    console.error('SHA1 archive matching error:', error);
    return null;
  }
}

/**
 * 清除SHA1缓存
 */
function clearSha1Cache() {
  sha1Cache.clear();
  console.log('🗑️ SHA1缓存已清除');
}

/**
 * 获取缓存统计信息
 */
function getCacheStats() {
  return {
    size: sha1Cache.size,
    maxSize: CACHE_MAX_SIZE,
    expiryMs: CACHE_EXPIRY_MS
  };
}

module.exports = {
  extractSha1Records,
  parseSha1Records,
  getSha1MapFromArchive,
  matchSha1ByFilename,
  matchBySha1InDatabase,
  matchBySha1FromArchive,
  clearSha1Cache,
  getCacheStats
};