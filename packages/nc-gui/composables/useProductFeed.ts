import axios from 'axios'
import type { ProductFeedItem } from '../lib/types'

const axiosInstance = axios.create({
  baseURL: 'https://nocodb.com/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const useProductFeed = createSharedComposable(() => {
  const activeTab = ref('recents')

  const youtubeFeed = ref<ProductFeedItem[]>([])

  const githubFeed = ref<ProductFeedItem[]>([])

  const socialFeed = ref<ProductFeedItem[]>([])

  const isErrorOccurred = reactive({
    youtube: false,
    github: false,
    social: false,
  })

  const loadFeed = async ({ loadMore, type }: { loadMore: boolean; type: 'youtube' | 'github' | 'all' | 'twitter' }) => {
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

      const response = await axiosInstance.get<ProductFeedItem[]>('/social/feed', {
        params: {
          per_page: 10,
          page,
          type,
        },
      })

      return response.data
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
