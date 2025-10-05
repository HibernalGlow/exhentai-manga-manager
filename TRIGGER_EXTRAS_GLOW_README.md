# 自动触发Extras-Glow Workflow

## 配置说明

在打包新版本后，release.yml会显示触发Extras-Glow workflow所需的信息。

## GitHub Web界面操作步骤

### 方法1：自动触发（推荐，需要配置Token）

1. **添加GitHub Token**：
   - 进入仓库 Settings > Secrets and variables > Actions
   - 点击 "New repository secret"
   - Name: `extrasglow`
   - Value: 你的Personal Access Token（需要repo权限）

2. **配置Extras-Glow仓库**：
   在Extras-Glow的`.github/workflows/schedule.yml`中添加：

   ```yaml
   on:
     repository_dispatch:
       types: [emm-release]
     # 保留其他触发器...
   ```

### 方法2：手动触发（无需Secrets）

如果不想配置secrets，可以手动在GitHub web界面触发：

1. **等待release完成**：
   - 当新版本发布时，workflow会显示触发信息
   - 复制显示的版本信息

2. **手动触发Extras-Glow workflow**：
   - 打开 https://github.com/HibernalGlow/Extras-Glow/actions/workflows/schedule.yml
   - 点击 "Run workflow" 按钮
   - 在输入框中填写从EMM release workflow复制的信息

3. **或者使用workflow_dispatch**：
   如果Extras-Glow配置了workflow_dispatch，可以直接在web界面触发

## Workflow输出信息

每次发布时，workflow会输出类似信息：

```
New EMM version released: 1.6.11.6
To trigger Extras-Glow workflow manually, go to:
https://github.com/HibernalGlow/Extras-Glow/actions/workflows/schedule.yml
And dispatch workflow with the following inputs:
event_type: emm-release
version: 1.6.11.6
repository: HibernalGlow/exhentai-manga-manager
ref: refs/tags/v1.6.11.6
sha: abc123...
```

## 配置Extras-Glow仓库

在Extras-Glow的workflow文件中添加处理job：

```yaml
jobs:
  handle-emm-release:
    if: github.event.action == 'emm-release' || github.event_name == 'workflow_dispatch'
    runs-on: ubuntu-latest
    steps:
      - name: Get version from payload
        run: |
          echo "EMM Version: ${{ github.event.client_payload.version }}"
          echo "Repository: ${{ github.event.client_payload.repository }}"
          echo "Ref: ${{ github.event.client_payload.ref }}"
          echo "SHA: ${{ github.event.client_payload.sha }}"

      # 添加你需要的处理步骤，比如更新版本信息、重新打包等
```