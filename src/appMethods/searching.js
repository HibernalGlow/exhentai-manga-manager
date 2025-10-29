export function querySearch(queryString, callback) {
  let result = []
  const options = this.customOptions.concat(this.tagList)
  if (queryString) {
    const keywords = [...queryString.matchAll(/\s+(?=(?:[^\'\"]*[\'\"][^\'\"]*[\'\"])*)[^\'\"]*$/g)]
    if (!_.isEmpty(keywords)) {
      const nextKeyword = queryString.replace(/(~|-)?[\p{L}\d]+:"[- ._()\p{L}\d]+"\$/gu, '').trim()
      if (nextKeyword[0] === '-' || nextKeyword[0] === '~') {
        result = _.filter(options, (str) => {
          return _.includes(str.value.toLowerCase(), nextKeyword.slice(1).toLowerCase())
              || _.includes(str.label.toLowerCase(), nextKeyword.slice(1).toLowerCase())
        })
      } else {
        result = _.filter(options, (str) => {
          return _.includes(str.value.toLowerCase(), nextKeyword.toLowerCase())
              || _.includes(str.label.toLowerCase(), nextKeyword.toLowerCase())
        })
      }
    } else {
      if (queryString[0] === '-' || queryString[0] === '~') {
        result = _.filter(options, (str) => {
          return _.includes(str.value.toLowerCase(), queryString.slice(1).toLowerCase())
              || _.includes(str.label.toLowerCase(), queryString.slice(1).toLowerCase())
        })
      } else {
        result = _.filter(options, (str) => {
          return _.includes(str.value.toLowerCase(), queryString.toLowerCase())
              || _.includes(str.label.toLowerCase(), queryString.toLowerCase())
        })
      }
    }
  } else {
    result = options
  }
  callback(result)
}

export function handleSearchStringChange(val) {
  if (!val) {
    this.searchString = ''
    this.handleSortChange(this.sortValue, this.bookList)
  }
}

export function handleInput(val) {
  try {
    if (/^[\p{L}\d]+:"[- ._()\p{L}\d]+"\$$/u.test(val)
        && this.searchString.trim() !== val.trim()) {
      const keywords = [...this.searchString.trim().matchAll(/\s+(?=(?:[^\'\"]*[\'\"][^\'\"]*[\'\"])*)[^\'\"]*$/g)]
      if (!_.isEmpty(keywords)) {
        const keyword = this.searchString.replace(/(~|-)?[\p{L}\d]+:"[- ._()\p{L}\d]+"\$/gu, '').trim()
        const matches = this.searchString.match(/(~|-)?[\p{L}\d]+:"[- ._()\p{L}\d]+"\$/gu)
        if (keyword[0] === '-') {
          this.searchString = matches.concat([`-${val}`]).join(' ')
        } else if (keyword[0] === '~') {
          this.searchString = matches.concat([`~${val}`]).join(' ')
        } else {
          this.searchString = matches.concat([val]).join(' ')
        }
      } else {
        const keyword = this.searchString.trim()
        if (keyword[0] === '-') {
          this.searchString = `-${val}`
        } else if (keyword[0] === '~') {
          this.searchString = `~${val}`
        } else {
          this.searchString = val
        }
      }
    } else {
      this.searchString = val
      this.searchString = this.searchString.replace(/\|{3}/, ' ')
    }
  } catch {
    this.searchString = val
  }
}

export function searchBook() {
  const checkCondition = (bookString, bookInfo, enableMixed, cat2letter) => {
    const searchStringArray = this.searchString ? this.searchString.split(/\s+(?=(?:[^\'\"]*[\'\"][^\'\"]*[\'\"])*)[^\'\"]*$/) : []
    const orCondition = _.filter(searchStringArray, (str) => str.startsWith('~'))
    const andCondition = _.filter(searchStringArray, (str) => !str.startsWith('~'))
    return _.some([andCondition, ...orCondition], (condition) => {
      if (_.isArray(condition)) {
        return _.every(condition, (str) => {
          try {
            if (_.startsWith(str, ':')) {
              const type = str.slice(1, 6)
              if (str[6] === '>') {
                switch (type) {
                  case 'mtime':
                  case 'atime':
                  case 'ptime':
                    return bookInfo[type] >= new Date(str.slice(7))
                  case 'count':
                    return bookInfo[type] > parseInt(str.slice(7), 10)
                }
              } else if (str[6] === '<') {
                switch (type) {
                  case 'mtime':
                  case 'atime':
                  case 'ptime':
                    return bookInfo[type] <= new Date(str.slice(7))
                  case 'count':
                    return bookInfo[type] < parseInt(str.slice(7), 10)
                }
              } else if (str[6] === '=') {
                switch (type) {
                  case 'mtime':
                  case 'atime':
                  case 'ptime':
                    return bookInfo[type].toLocaleDateString() === new Date(str.slice(7)).toLocaleDateString()
                  case 'count':
                    return bookInfo[type] === parseInt(str.slice(7), 10)
                }
              } else {
                return false
              }
            } else if (str.match(/^([a-z]+):"([^"]+)"\$/)) {
              const cat = RegExp.$1
              const tag = RegExp.$2
              const cats = enableMixed && ['f','m','x'].includes(cat) ? ['f','m','x'] : [cat]
              return cats.some(c => {
                const letter = cat2letter?.[c] || c
                return bookString.includes(`${letter}:${tag}`) || bookString.includes(`${c}:${tag}`)
              })
            } else if (str.match(/^-([a-z]+):"([^"]+)"\$/)) {
              const cat = RegExp.$1
              const tag = RegExp.$2
              const cats = enableMixed && ['f','m','x'].includes(cat) ? ['f','m','x'] : [cat]
              return !cats.some(c => {
                const letter = cat2letter?.[c] || c
                return bookString.includes(`${letter}:${tag}`) || bookString.includes(`${c}:${tag}`)
              })
            } else if (_.startsWith(str, '-')) {
              return !bookString.includes(str.slice(1).replace(/["']/g, '').replace(/[$]/g, '"').toLowerCase())
            } else {
              return bookString.includes(str.replace(/["']/g, '').replace(/[$]/g, '"').toLowerCase())
            }
          } catch {
            return false
          }
        })
      } else {
        const str = condition.slice(1)
        if (str.match(/^([a-z]+):"([^"]+)"\$/)) {
          const cat = RegExp.$1
          const tag = RegExp.$2
          const cats = enableMixed && ['f','m','x'].includes(cat) ? ['f','m','x'] : [cat]
          return cats.some(c => {
            const letter = cat2letter?.[c] || c
            return bookString.includes(`${letter}:${tag}`) || bookString.includes(`${c}:${tag}`)
          })
        } else {
          return bookString.includes(str.replace(/["']/g, '').replace(/[$]/g, '"').toLowerCase())
        }
      }
    })
  }
  this.displayBookList = _.filter(this.bookList, (book) => {
    const tagTokens = _.flatMap(book.tags, (tags, cat) => {
      const letter = this.cat2letter?.[cat] || cat
      return _.flatMap(tags, (tag) => [
        `${letter}:${tag}`,
        `${cat}:${tag}`,
      ])
    })
    const categoryToken = book.category ? [`cat:${book.category}`] : []
    const getBookTranslation = (book) => {
      if (book._translation) {
        return book._translation.chinese_title || ''
      }
      return ''
    }
    const bookString = JSON.stringify(
        _.assign(
            {},
            _.pick(book, ['title', 'title_jpn', 'status', 'filepath', 'url', 'pageDiff']),
            {
              tags: tagTokens.concat(categoryToken),
              chinese_title: getBookTranslation(book)
            }
        )
    ).toLowerCase()
    const bookInfo = {
      mtime: new Date(book.mtime),
      atime: new Date(book.date),
      ptime: new Date(book.posted * 1000),
      count: book.readCount
    }
    return checkCondition(bookString, bookInfo, this.enableMixedGenderSearch, this.cat2letter)
  })
  if (!this.sortValue || ['mark', 'hidden', 'collection'].includes(this.sortValue)) this.sortValue = 'addDescend'
  this.handleSortChange(this.sortValue, this.displayBookList)
  if (this.searchString && this.searchString.trim()) {
    this.addSearchHistory(this.searchString.trim())
  }
  if (this.currentUI() === 'edit-group-tag') {
    this.$refs.EditViewRef.selectBookList = []
    this.displayBookList.forEach(book => book.selected = false)
  }
}

export function handleSearchString(string) {
  this.$refs.BookDetailDialogRef.dialogVisibleBookDetail = false
  this.drawerVisibleCollection = false
  this.searchString = string
  this.searchBook()
}

export function searchFromTag(tag, cat) {
  this.$refs.BookDetailDialogRef.dialogVisibleBookDetail = false
  this.drawerVisibleCollection = false
  if (cat) {
    const letter = this.cat2letter[cat] ? this.cat2letter[cat] : cat
    this.searchString = `${letter}:"${tag}"$`
  } else {
    this.searchString = `"${tag}"$`
  }
  this.searchBook()
}


