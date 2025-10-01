# GitHub Release 发布指南

## 📋 配置说明

项目已配置自动化GitHub Actions工作流，可以自动构建并发布Windows便携版EXE压缩包。

## 🚀 发布方式

### 方式1: 通过Git Tag触发（推荐）

1. **更新版本号**
   ```bash
   # 已在package.json中更新为1.6.10.1
   ```

2. **提交更改**
   ```bash
   git add .
   git commit -m "chore: bump version to 1.6.10.1"
   ```

3. **创建并推送标签**
   ```bash
   # 创建版本标签
   git tag v1.6.10.1
   
   # 推送代码和标签
   git push origin dev
   git push origin v1.6.10.1
   ```

4. **自动构建**
   - GitHub Actions会自动触发构建
   - 构建完成后自动创建Release
   - Release中包含便携版压缩包

### 方式2: 手动触发（适合测试）

1. 访问GitHub仓库的 **Actions** 标签页
2. 选择 **Build and Release** 工作流
3. 点击 **Run workflow** 按钮
4. 输入版本号（如：`v1.6.10.1`）
5. 点击 **Run workflow** 确认
6. 构建完成后会创建草稿Release（需要手动发布）

## 📦 构建产物

工作流会生成以下文件：

```
exhentai-manga-manager-1.6.10.1-win-x64-portable.zip
```

**包含内容：**
- `exhentai-manga-manager.exe` - 主程序
- 所有必需的依赖文件
- 资源文件和DLL

**使用方式：**
1. 下载zip压缩包
2. 解压到任意目录
3. 双击运行 `exhentai-manga-manager.exe`
4. 所有数据保存在程序目录（便携模式）

## 🔧 工作流程

```
推送Tag → 触发工作流 → 安装依赖 → 构建前端 → 打包Electron → 压缩文件 → 创建Release
```

## ⚙️ 本地构建测试

在推送之前，建议先本地测试构建：

```bash
# 安装依赖
npm install

# 构建前端
npm run build

# 打包Electron
npm run dist
```

构建产物位于 `out/win-unpacked/` 目录。

## 📝 Release说明

- **正式版本**: 标签格式 `v1.6.10.1` → 自动发布正式Release
- **预发布版**: 标签包含 `beta`/`alpha` → 标记为预发布
- **草稿版**: 通过手动触发 → 创建草稿（需手动发布）

## 🔑 权限要求

工作流需要以下权限（已在配置中设置）：
- `contents: write` - 创建Release和上传文件

## 🐛 故障排查

### 构建失败

1. **检查依赖安装**
   - 确保 `package.json` 中所有依赖都已正确列出
   - Sharp和SQLite3等原生模块可能需要重新编译

2. **检查构建脚本**
   ```bash
   npm run build  # 应该成功
   npm run dist   # 应该成功
   ```

3. **查看Actions日志**
   - 访问GitHub仓库的Actions标签页
   - 点击失败的工作流查看详细日志

### Release创建失败

1. **检查GITHUB_TOKEN权限**
   - 默认的 `GITHUB_TOKEN` 应该有足够权限
   - 如果不行，需要创建Personal Access Token

2. **检查标签格式**
   - 必须以 `v` 开头，如 `v1.6.10.1`
   - 版本号格式：`v主版本.次版本.修订号[.构建号]`

## 📋 下次发布清单

- [ ] 更新 `package.json` 中的版本号
- [ ] 更新 `CHANGELOG.md`（如有）
- [ ] 提交所有更改
- [ ] 创建并推送Git标签
- [ ] 等待GitHub Actions完成构建
- [ ] 检查Release页面，编辑说明（如需要）
- [ ] 公开发布Release

## 🌟 最佳实践

1. **版本号规范**: 遵循语义化版本（Semantic Versioning）
2. **提交信息**: 使用清晰的commit message
3. **测试**: 发布前在本地充分测试
4. **文档**: 更新README和CHANGELOG
5. **备份**: 重要更新前备份数据库

## 📞 支持

如遇问题，请查看：
- GitHub Actions运行日志
- electron-builder文档
- 项目Issues页面
