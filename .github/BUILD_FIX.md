# 构建问题修复记录

## 问题描述
GitHub Actions构建失败，错误信息：
```
Could not resolve "../../secret_key.json" from "src/components/Setting.vue"
```

## 原因分析
- `secret_key.json` 文件被 `.gitignore` 排除，不会提交到Git仓库
- 该文件包含GitHub API的访问令牌（用于检查更新）
- CI环境中没有这个文件，导致Vite构建失败

## 解决方案

### 1. 创建模板文件
创建了 `secret_key.json.template` 文件：
```json
{
  "gh_token": ""
}
```

### 2. 修改GitHub Actions工作流
在构建前添加步骤，从模板复制文件：
```yaml
- name: Create secret_key.json for build
  shell: powershell
  run: |
    Copy-Item "secret_key.json.template" "secret_key.json"
    Write-Host "Created secret_key.json from template"
```

### 3. 提交并重新发布
```bash
# 添加修复
git add .
git commit -m "fix: 添加secret_key.json.template以支持CI构建"
git push origin dev

# 删除旧标签
git tag -d v1.6.10.1
git push origin :refs/tags/v1.6.10.1

# 重新创建标签
git tag v1.6.10.1
git push origin v1.6.10.1
```

## 本地开发说明

### 首次设置
如果你是首次克隆项目，需要创建 `secret_key.json`：

```bash
# 从模板复制
cp secret_key.json.template secret_key.json

# 如果需要GitHub API访问（可选），编辑文件添加token
# 不添加token的话，GitHub API会受到速率限制，但不影响基本功能
```

### 获取GitHub Token（可选）
1. 访问 https://github.com/settings/tokens
2. 生成新的Personal Access Token
3. 权限选择：`public_repo`（只读公共仓库）
4. 复制token到 `secret_key.json`：
   ```json
   {
     "gh_token": "ghp_xxxxxxxxxxxxxxxxxxxx"
   }
   ```

**注意**：
- ⚠️ 永远不要提交实际的 `secret_key.json` 文件
- ⚠️ Token是敏感信息，仅保存在本地
- ✅ CI构建会使用空token（功能正常，只是API速率受限）

## 验证构建

### 本地测试
```bash
npm run build  # 应该成功构建
```

### GitHub Actions
访问：https://github.com/你的用户名/exhentai-manga-manager/actions

查看最新的 "Build and Release" 工作流状态。

## 相关文件
- `secret_key.json.template` - 模板文件（已提交到Git）
- `secret_key.json` - 实际配置文件（被.gitignore忽略）
- `.github/workflows/release.yml` - CI工作流配置
- `src/components/Setting.vue` - 使用token的组件
