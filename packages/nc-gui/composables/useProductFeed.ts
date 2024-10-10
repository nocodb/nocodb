import dayjs from 'dayjs'
import type { ProductFeedItem } from '../lib/types'

export const useProductFeed = createSharedComposable(() => {
  const activeTab = ref('recents')

  const { $api } = useNuxtApp()

  const { appInfo } = useGlobal()

  const youtubeFeed = ref<ProductFeedItem[]>([])

  const githubFeed = ref<ProductFeedItem[]>([])

  const socialFeed = ref<ProductFeedItem[]>([])

  const cloudFeed = ref<ProductFeedItem[]>([])

  const isErrorOccurred = reactive({
    youtube: false,
    github: false,
    social: false,
    cloud: false,
  })

  const loadFeed = async ({ loadMore, type }: { loadMore: boolean; type: 'youtube' | 'github' | 'all' | 'cloud' }) => {
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
          case 'cloud':
            page = Math.ceil(cloudFeed.value.length / 10) + 1
            break
        }
      }

      const response = await $api.utils.feed({ page, per_page: 10, type })

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
        case 'cloud':
          cloudFeed.value = [...cloudFeed.value, ...response] as ProductFeedItem[]
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
        case 'cloud':
          isErrorOccurred.cloud = true
          break
      }
      console.error(error)
      return []
    }
  }

  const isNewFeedAvailable = ref(false)

  const checkNewFeed = async () => {
    try {
      await loadFeed({ type: 'all', loadMore: false })
      if (!socialFeed.value.length) return

      const [latestFeed] = socialFeed.value
      const lastFeedTime = localStorage.getItem('lastFeedPublishedTime')
      const lastFeed = dayjs(lastFeedTime)

      if (!lastFeed.isValid() || dayjs(latestFeed['Published Time']).isAfter(lastFeed)) {
        isNewFeedAvailable.value = true
      }
    } catch (error) {
      console.error('Error while checking new feed', error)
    }
  }

  const intervalId = ref()

  const checkFeedWithInterval = async () => {
    await checkNewFeed()
    intervalId.value = setTimeout(checkFeedWithInterval, 3 * 60 * 60 * 1000)
  }

  onMounted(() => {
    if (appInfo.value.feedEnabled) {
      checkFeedWithInterval()
    }
  })

  onUnmounted(() => {
    if (intervalId.value) {
      clearTimeout(intervalId.value)
      intervalId.value = null
    }
  })

  return {
    isErrorOccurred,
    activeTab,
    youtubeFeed,
    githubFeed,
    socialFeed,
    cloudFeed,
    loadFeed,
    isNewFeedAvailable,
  }
})
