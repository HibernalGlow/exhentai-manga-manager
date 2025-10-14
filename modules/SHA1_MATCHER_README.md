# SHA1 Archive Matcher 使用说明

## 功能概述

SHA1 Archive Matcher 是一个用于从7z压缩包中读取SHA1记录并进行匹配的模块，支持以下场景：

1. **导入API数据库匹配**：从压缩包中提取SHA1记录，在本地数据库中查找匹配的漫画元数据
2. **在线搜索匹配**：使用SHA1哈希在ExHentai/E-Hentai网站上进行搜索匹配

## SHA1记录格式

压缩包中的SHA1记录文件应遵循以下格式：

```
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_000.jpg *87136935d1e581ebc7a59479608c6501f9d0a817
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_001.jpg *c5b5477bbf262c2ca0e2a4a9d2ebe584b69850fb
(C87) 第六駆逐隊は最高だぜ (艦隊これくしょん -艦これ-) [CE家族社]/CE_947_002.jpg *848a9025c3aafadb528848640b61e0eff839d1a1
```

- 每行格式：`文件名 *SHA1哈希`
- SHA1哈希为40位十六进制字符串
- 支持的文件名可以包含路径

## 使用方法

### 1. 压缩包准备

将SHA1记录文件放入7z压缩包中，文件名可以是：
- `sha1.txt`
- `hashes.txt`
- `checksums.txt`
- 或其他包含sha1/hash/checksum关键词的文件名

### 2. 文件夹结构

对于文件夹类型的漫画，将7z压缩包放在漫画文件夹的根目录下。

### 3. 自动匹配流程

系统会按以下优先级进行匹配：

1. **URL匹配**：从漫画URL中提取gid和token
2. **.ehviewer文件匹配**：读取.ehviewer文件
3. **Hash匹配**：使用文件的SHA1哈希进行数据库匹配
4. **SHA1压缩包匹配**：从7z文件中提取SHA1并进行数据库匹配
5. **SHA1在线搜索匹配**：使用SHA1在网站上搜索匹配
6. **标题匹配**：最后的备选方案

## API接口

### 主要函数

```javascript
// 从压缩包获取SHA1映射
const sha1Map = await getSha1MapFromArchive(archivePath)

// 根据文件名匹配SHA1
const sha1 = matchSha1ByFilename(filename, sha1Map)

// 数据库匹配
const metadata = await matchBySha1InDatabase(sha1, db)

// 在线搜索匹配
const result = await matchBySha1Online(sha1, searchType, wcId)
```

### 参数说明

- `archivePath`: 7z压缩包的完整路径
- `filename`: 要匹配的文件名
- `sha1`: 40位SHA1哈希字符串
- `db`: 数据库连接对象
- `searchType`: 搜索类型，'exhentai' 或 'e-hentai'
- `wcId`: WebContents ID，用于在线搜索

## 注意事项

1. SHA1哈希必须是完整的40位十六进制字符串
2. 压缩包必须是7z格式（支持.zip和.rar作为备选）
3. 在线搜索需要有效的登录会话和网络连接
4. 匹配失败时会自动降级到标题匹配

## 调试信息

系统会在匹配过程中输出详细的调试信息：

```
🔍 [SHA1] "filename.jpg" -> Found SHA1: a665a45920422f9d417e4867efdc4fb8a04a1f3f
✅ [SHA1] "filename.jpg" -> Database match found: gid=123456, token=abcdef123456
🔍 [SHA1在线] 尝试搜索: a665a45920422f9d417e4867efdc4fb8a04a1f3f
✅ [SHA1在线] 匹配成功: gid=123456
```