import axios from 'axios'

const axiosInstance = axios.create({
  // baseURL: 'https://nocodb.com/api',
  baseURL: 'http://localhost:8000/api/v1',
  headers: {
    'Content-Type': 'application/json',
  },
})

export const useProductFeed = createSharedComposable(() => {
  const activeTab = ref('recents')

  const youtubeFeed = ref<
    {
      id: string
      body: string
      name: string
      published_at: string
      thumbnails: {
        default: {
          height: number
          url: string
          width: number
        }
        high: {
          height: number
          url: string
          width: number
        }
        medium: {
          height: number
          url: string
          width: number
        }
      }
      embed_url: string
      html_url: string
    }[]
  >([])
  const githubFeed = ref<
    {
      body: string
      html_url: string
      id: string
      name: string
      published_at: string
    }[]
  >([])

  const socialFeed = ref([])

  const ytNextPageToken = ref('')

  const loadYoutubeFeed = async (loadMore?: boolean) => {
    const { data } = await axiosInstance.get('/social/youtube', {
      params: loadMore
        ? {
            pageToken: ytNextPageToken.value,
            per_page: 10,
          }
        : {
            per_page: 10,
          },
    })
    ytNextPageToken.value = data.nextPageToken
    youtubeFeed.value = [...youtubeFeed.value, ...data.videos]
  }

  const loadGithubFeed = async (loadMore?: boolean) => {
    const { data } = await axiosInstance.get('/social/github', {
      params: loadMore
        ? {
            page: githubFeed.value.length / 10 + 1,
            per_page: 10,
          }
        : {
            per_page: 10,
          },
    })
    githubFeed.value = [...githubFeed.value, ...data]
  }

  return {
    activeTab,
    youtubeFeed,
    githubFeed,
    socialFeed,
    loadYoutubeFeed,
    loadGithubFeed,
  }
})
