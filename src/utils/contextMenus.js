/**
 * 可复用的右键菜单配置和工具函数
 */

/**
 * 创建漫画标题右键菜单
 * @param {Object} params
 * @param {Event} params.e - 事件对象
 * @param {Object} params.book - 书籍对象
 * @param {Function} params.t - 翻译函数
 * @param {Object} params.ipcRenderer - IPC渲染器
 * @param {Object} params.ContextMenu - 右键菜单实例
 */
export function showMangaTitleContextMenu({ e, book, t, ipcRenderer, ContextMenu }) {
  e.preventDefault()
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: [
      {
        label: t('c.copyTitleToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', book.title_jpn || book.title)
        }
      },
      {
        label: t('c.copyLinkToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', book.url)
        }
      },
      {
        label: t('c.copyTitleAndLinkToClipboard'),
        onClick: () => {
          ipcRenderer.invoke('copy-text-to-clipboard', `${book.title_jpn || book.title}\n${book.url}\n`)
        }
      },
    ]
  })
}

/**
 * 创建标签右键菜单 - 通用版本（支持所有功能）
 * @param {Object} params
 * @param {Event} params.e - 事件对象
 * @param {string} params.tagName - 标签名称
 * @param {string} params.category - 标签类别
 * @param {boolean} params.isCollected - 是否已收藏
 * @param {string} params.letter - 类别字母
 * @param {Object} params.book - 书籍对象（可选，用于删除标签和清空元数据）
 * @param {Function} params.t - 翻译函数
 * @param {Object} params.ipcRenderer - IPC渲染器
 * @param {Object} params.ContextMenu - 右键菜单实例
 * @param {Function} params.onToggleCollect - 切换收藏回调
 * @param {Function} params.onRemoveTag - 删除标签回调（可选）
 * @param {Function} params.onClearMetadata - 清空元数据回调（可选）
 */
export function showTagContextMenu({ 
  e, 
  tagName, 
  category, 
  isCollected, 
  letter,
  book,
  t, 
  ipcRenderer, 
  ContextMenu, 
  onToggleCollect,
  onRemoveTag,
  onClearMetadata
}) {
  e.preventDefault()
  
  const menuItems = [
    {
      label: isCollected ? '取消收藏此标签' : '收藏此标签',
      onClick: () => {
        if (onToggleCollect) onToggleCollect(tagName, category, letter, isCollected)
      }
    }
  ]

  // 如果提供了删除标签回调，添加删除标签选项
  if (onRemoveTag && book) {
    menuItems.push({
      label: '从本书元数据中删除此标签',
      onClick: () => {
        onRemoveTag(tagName, category, book)
      }
    })
  }

  // 如果提供了清空元数据回调，添加清空元数据选项
  if (onClearMetadata && book) {
    menuItems.push({
      label: '清空除类别外元数据',
      onClick: () => {
        onClearMetadata(book)
      }
    })
  }

  // 复制标签名称
  menuItems.push({
    label: t('c.copyTitleToClipboard'),
    onClick: () => {
      ipcRenderer.invoke('copy-text-to-clipboard', tagName)
    }
  })
  
  ContextMenu.showContextMenu({
    x: e.x,
    y: e.y,
    items: menuItems
  })
}

/**
 * 标签收藏切换逻辑 - 通用版本
 * @param {Object} params
 * @param {string} params.tagName - 标签名称
 * @param {string} params.category - 标签类别
 * @param {string} params.letter - 类别字母
 * @param {boolean} params.isCollected - 是否已收藏
 * @param {Object} params.setting - 设置对象
 * @param {Object} params.ipcRenderer - IPC渲染器
 * @param {Function} params.printMessage - 消息提示函数
 * @param {Function} params.generateAutoColor - 颜色生成函数
 */
export function toggleCollectTag({ 
  tagName, 
  category, 
  letter, 
  isCollected, 
  setting, 
  ipcRenderer, 
  printMessage,
  generateAutoColor 
}) {
  if (!setting.collectTag) {
    setting.collectTag = []
  }
  
  if (isCollected) {
    // 移除收藏
    setting.collectTag = setting.collectTag.filter(
      t => !(t.cat === category && t.tag === tagName)
    )
    printMessage('success', '已取消收藏')
  } else {
    // 添加收藏
    const newTag = {
      cat: category,
      tag: tagName,
      letter: letter,
      color: generateAutoColor ? generateAutoColor(category) : '#409EFF'
    }
    setting.collectTag.push(newTag)
    printMessage('success', '已添加到收藏')
  }
  
  // 保存设置
  ipcRenderer.invoke('save-setting', setting)
}

/**
 * 根据类别自动生成颜色
 * @param {string} category - 标签类别
 * @returns {string} 颜色值
 */
export function generateAutoColor(category) {
  const categoryColors = {
    'female': '#FF6B9D',      // 粉红色
    'male': '#4A9EFF',        // 蓝色
    'mixed': '#9D5CFF',       // 紫色
    'artist': '#FF9F40',      // 橙色
    'group': '#20C5DE',       // 青色
    'parody': '#67C23A',      // 绿色
    'character': '#F56C6C',   // 红色
    'language': '#909399',    // 灰色
    'cosplayer': '#E6A23C',   // 金色
    'other': '#606266'        // 深灰色
  }
  
  return categoryColors[category] || '#409EFF' // 默认蓝色
}
