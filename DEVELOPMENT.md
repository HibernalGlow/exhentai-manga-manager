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