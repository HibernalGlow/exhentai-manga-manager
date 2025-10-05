/**
 * 搜索敏捷面板工具类
 * 处理搜索历史的存储、加载和管理
 */
class SearchHistoryManager {
  constructor() {
    this.storageKey = 'searchHistory'
    this.maxHistoryItems = 50
  }

  /**
   * 加载搜索历史
   * @returns {Array} 搜索历史数组
   */
  loadHistory() {
    try {
      const history = localStorage.getItem(this.storageKey)
      return history ? JSON.parse(history) : []
    } catch (e) {
      console.error('Failed to load search history:', e)
      return []
    }
  }

  /**
   * 保存搜索历史
   * @param {Array} history - 搜索历史数组
   */
  saveHistory(history) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(history))
    } catch (e) {
      console.error('Failed to save search history:', e)
    }
  }

  /**
   * 添加搜索记录
   * @param {string} query - 搜索查询
   * @param {Array} currentHistory - 当前历史记录（可选，用于避免重复加载）
   * @returns {Array} 更新后的历史记录
   */
  addSearch(query, currentHistory = null) {
    if (!query || query.trim() === '') return currentHistory || this.loadHistory()

    const history = currentHistory || this.loadHistory()

    // 移除重复的搜索
    const filteredHistory = history.filter(item => item.query !== query.trim())

    // 添加到开头
    const newHistory = [{
      query: query.trim(),
      timestamp: Date.now()
    }, ...filteredHistory]

    // 限制历史记录数量
    const limitedHistory = newHistory.slice(0, this.maxHistoryItems)

    this.saveHistory(limitedHistory)
    return limitedHistory
  }

  /**
   * 删除指定的搜索记录
   * @param {number} index - 要删除的记录索引
   * @param {Array} currentHistory - 当前历史记录（可选）
   * @returns {Array} 更新后的历史记录
   */
  removeSearch(index, currentHistory = null) {
    const history = currentHistory || this.loadHistory()
    history.splice(index, 1)
    this.saveHistory(history)
    return history
  }

  /**
   * 清空所有搜索历史
   */
  clearAllHistory() {
    this.saveHistory([])
    return []
  }

  /**
   * 格式化时间显示
   * @param {number} timestamp - 时间戳
   * @returns {string} 格式化的时间字符串
   */
  formatTime(timestamp) {
    const now = Date.now()
    const diff = now - timestamp
    const minutes = Math.floor(diff / (1000 * 60))
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))

    if (minutes < 1) return '刚刚'
    if (minutes < 60) return `${minutes}分钟前`
    if (hours < 24) return `${hours}小时前`
    if (days < 7) return `${days}天前`
    return new Date(timestamp).toLocaleDateString()
  }

  /**
   * 搜索历史记录
   * @param {string} keyword - 搜索关键词
   * @param {Array} history - 历史记录数组（可选）
   * @returns {Array} 匹配的搜索记录
   */
  searchHistory(keyword, history = null) {
    const searchData = history || this.loadHistory()
    if (!keyword || keyword.trim() === '') return searchData

    const lowerKeyword = keyword.toLowerCase()
    return searchData.filter(item =>
      item.query.toLowerCase().includes(lowerKeyword)
    )
  }

  /**
   * 获取搜索统计信息
   * @param {Array} history - 历史记录数组（可选）
   * @returns {Object} 统计信息
   */
  getStats(history = null) {
    const searchData = history || this.loadHistory()
    return {
      total: searchData.length,
      today: searchData.filter(item => {
        const today = new Date()
        const itemDate = new Date(item.timestamp)
        return itemDate.toDateString() === today.toDateString()
      }).length,
      thisWeek: searchData.filter(item => {
        const now = new Date()
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return new Date(item.timestamp) >= weekAgo
      }).length
    }
  }
}

// 创建全局实例
const searchHistoryManager = new SearchHistoryManager()

export default searchHistoryManager
export { SearchHistoryManager }