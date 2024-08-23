import axios from 'axios'
import type { ProductFeedItem } from '../lib/types'

const axiosInstance = axios.create({
  // baseURL: 'https://nocodb.com/api',
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const useProductFeed = createSharedComposable(() => {
  const activeTab = ref('recents')

  const youtubeFeed = ref<ProductFeedItem[]>([])

  const githubFeed = ref<ProductFeedItem[]>([])

  const socialFeed = ref<ProductFeedItem[]>([])

  const loadFeed = async ({ loadMore, type }: { loadMore: boolean; type: 'youtube' | 'github' | 'all' | 'twitter' }) => {
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

    const response = await axiosInstance.get('/social/feed', {
      params: {
        per_page: 10,
        page,
        type,
      },
    })

    return response.data
  }

  return {
    activeTab,
    youtubeFeed,
    githubFeed,
    socialFeed,
    loadFeed,
  }
})
