# 开发工具

## 版本更新脚本

项目使用Python脚本 `update-version.py` 来更新版本号，该脚本使用 [Rich](https://github.com/Textualize/rich) 库提供美化的终端界面。

### 安装依赖

```bash
pip install -r requirements.txt
```

### 使用方法

```bash
python update-version.py
```

脚本会：
1. 显示当前版本号
2. 提示输入新版本号
3. 验证版本号格式
4. 确认更新操作
5. 更新 `package.json` 和 `package-lock.json`
6. 执行Git操作（add, commit, tag, push）

### 版本号格式

支持以下格式：
- `x.y.z` (如: 1.6.11)
- `x.y.z.w` (如: 1.6.11.9)

### Git操作

脚本会自动执行以下Git操作：
- `git add .`
- `git commit -m "version x.y.z.w"`
- `git tag vx.y.z.w` (如果标签已存在会先删除)
- `git push origin`
- `git push origin --tags`

## GitHub Actions 配置

### Extras-Glow 自动触发

Release工作流支持在发布新版本时自动触发 [Extras-Glow](https://github.com/HibernalGlow/Extras-Glow) 仓库的工作流。

#### 配置方法

1. 在GitHub仓库设置中添加 `extrasglow` secret
2. 该secret应包含有权限访问Extras-Glow仓库的Personal Access Token
3. Token需要以下权限：
   - `repo` (Full control of private repositories)
   - `workflow` (Update GitHub Action workflows)

#### Token创建步骤

1. 访问 [GitHub Personal Access Tokens](https://github.com/settings/tokens)
2. 点击 "Generate new token (classic)"
3. 选择适当的权限
4. 将生成的token添加到仓库的 `extrasglow` secret中

#### 工作流程

当配置了有效的token后：
- 发布新版本时会自动触发Extras-Glow工作流
- 如果自动触发失败，会显示手动触发的说明
- 如果没有配置token，只显示手动触发的说明