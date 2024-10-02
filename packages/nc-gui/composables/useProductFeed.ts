import type { ProductFeedItem } from '../lib/types'

export const useProductFeed = createSharedComposable(() => {
  const activeTab = ref('recents')

  const { $api } = useNuxtApp()

  const { appInfo } = useGlobal()

  const youtubeFeed = ref<ProductFeedItem[]>([])

  const githubFeed = ref<ProductFeedItem[]>([])

  const socialFeed = ref<ProductFeedItem[]>([])

  const isErrorOccurred = reactive({
    youtube: false,
    github: false,
    social: false,
  })

  const newFeedCount = ref(0)

  const loadFeed = async ({ loadMore, type }: { loadMore: boolean; type: 'youtube' | 'github' | 'all' }) => {
    try {
      let page = 1

      if (loadMore) {
        switch (type) {
          case 'youtube':
            page = Math.ceil(youtubeFeed.value.length / 10) + 1
            break
          case 'github':
            page = Math.ceil(githubFeed.value.length / 10) + 1
            break
          case 'all':
            page = Math.ceil(socialFeed.value.length / 10) + 1
            break
        }
      }

      const response = await $api.utils.feed2({ page, per_page: 10, type })

      if (type === 'all' && page === 1 && response.length) {
        localStorage.setItem('last_published_at', response[0]['Published Time'] as string)
      }

      switch (type) {
        case 'youtube':
          youtubeFeed.value = [...youtubeFeed.value, ...response] as ProductFeedItem[]
          break
        case 'github':
          githubFeed.value = [...githubFeed.value, ...response] as ProductFeedItem[]
          break
        case 'all':
          socialFeed.value = [...socialFeed.value, ...response] as ProductFeedItem[]
          break
      }
    } catch (error) {
      switch (type) {
        case 'youtube':
          isErrorOccurred.youtube = true
          break
        case 'github':
          isErrorOccurred.github = true
          break
        case 'all':
          isErrorOccurred.social = true
          break
      }
      console.error(error)
      return []
    }
  }

  const checkForNewFeed = async () => {
    const lastPublishedAt = localStorage.getItem('last_published_at')

    if (!lastPublishedAt) {
      return
    }

    try {
      const newFeeds = await $api.utils.feed({ last_published_at: lastPublishedAt })
      if (typeof newFeeds === 'number') {
        newFeedCount.value = newFeeds
      } else if (typeof newFeeds === 'string') {
        newFeedCount.value = 100
      }
    } catch (error) {
      console.error(error)
    }
  }

  const intervalId = ref()

  const checkFeedWithInterval = async () => {
    await checkForNewFeed()
    intervalId.value = setTimeout(checkFeedWithInterval, 3 * 60 * 60 * 1000)
  }

  onMounted(() => {
    if (appInfo.value.feedEnabled) {
      checkFeedWithInterval()
    }
  })

  onUnmounted(() => {
    if (intervalId.value) clearTimeout(intervalId.value)
  })

  return {
    isErrorOccurred,
    activeTab,
    youtubeFeed,
    githubFeed,
    socialFeed,
    loadFeed,
  }
})
