import { ref, nextTick } from 'vue'

/**
 * 搜索功能相关的 composable
 * 包含搜索面板控制、收藏标签追加、搜索历史等功能
 */
export function useSearch() {
  // 搜索面板相关状态
  const favoriteTagPanelVisible = ref(false)
  const favoriteTagHideTimer = ref(null)
  const favoriteTagPanelHeight = ref(240)
  const enableMixedGenderSearch = ref(false)

  // 搜索面板控制方法
  const handleSearchFocus = () => {
    clearFavoriteHideTimer()
    favoriteTagPanelVisible.value = true
  }

  const handleSearchBlur = () => {
    scheduleFavoriteHide()
  }

  const handlePanelShow = () => {
    clearFavoriteHideTimer()
    favoriteTagPanelVisible.value = true
  }

  const clearFavoriteHideTimer = () => {
    if (favoriteTagHideTimer.value) {
      clearTimeout(favoriteTagHideTimer.value)
      favoriteTagHideTimer.value = null
    }
  }

  const scheduleFavoriteHide = () => {
    clearFavoriteHideTimer()
    favoriteTagHideTimer.value = setTimeout(() => {
      favoriteTagPanelVisible.value = false
      favoriteTagHideTimer.value = null
    }, 180)
  }

  const handlePanelHide = () => {
    favoriteTagPanelVisible.value = false
  }

  const updatePanelHeight = (height, setting, saveSettingFn) => {
    favoriteTagPanelHeight.value = height
    // 保存到设置
    setting.favoriteTagPanelHeight = height
    saveSettingFn()
  }

  // 收藏标签追加方法
  const appendCollectTag = (tag, modifier = '', event, searchString, handleInputFn, searchAutocompleteRef) => {
    if (event?.shiftKey && !modifier) {
      modifier = '~'
    }
    const baseToken = `${tag.letter}:"${tag.tag}"$`
    const token = modifier === '-' ? `-${baseToken}` : modifier === '~' ? `~${baseToken}` : baseToken
    const trimmed = searchString.trim()
    const nextValue = trimmed ? `${trimmed} ${token}` : token
    handleInputFn(nextValue)
    nextTick(() => {
      searchAutocompleteRef?.focus?.()
    })
  }

  // 搜索历史相关方法
  const addSearchHistory = (query, searchAgilePanelRef) => {
    if (searchAgilePanelRef) {
      searchAgilePanelRef.addSearchHistory(query)
    }
  }

  const applySearchHistory = (query, searchString, searchBookFn) => {
    searchString = query
    searchBookFn()
  }

  return {
    // 状态
    favoriteTagPanelVisible,
    favoriteTagHideTimer,
    favoriteTagPanelHeight,
    enableMixedGenderSearch,

    // 方法
    handleSearchFocus,
    handleSearchBlur,
    handlePanelShow,
    clearFavoriteHideTimer,
    scheduleFavoriteHide,
    handlePanelHide,
    updatePanelHeight,
    appendCollectTag,
    addSearchHistory,
    applySearchHistory
  }
}