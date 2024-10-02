import type { ProductFeedItem } from '../lib/types'

export const useProductFeed = createSharedComposable(() => {
  const activeTab = ref('recents')

  const { $api } = useNuxtApp()

  const youtubeFeed = ref<ProductFeedItem[]>([])

  const githubFeed = ref<ProductFeedItem[]>([])

  const socialFeed = ref<ProductFeedItem[]>([])

  const isErrorOccurred = reactive({
    youtube: false,
    github: false,
    social: false,
  })

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

      const response = await $api.utils.feed({ page, per_page: 10, type })

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

  return {
    isErrorOccurred,
    activeTab,
    youtubeFeed,
    githubFeed,
    socialFeed,
    loadFeed,
  }
})
