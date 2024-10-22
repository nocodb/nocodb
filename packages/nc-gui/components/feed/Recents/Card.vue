<script setup lang="ts">
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import { YoutubeVue3 } from 'youtube-vue3'
import type { ProductFeedItem } from '../../../lib/types'
import { extractYoutubeVideoId } from '../../../utils/urlUtils'
import { timeAgo } from '~/utils/datetimeUtils'
const props = defineProps<{
  item: ProductFeedItem
}>()

const {
  item: { 'Published Time': CreatedAt, Description, Url, Title, 'Feed Source': source, Image },
} = props

const feedIcon = {
  Twitter: iconMap.twitter,
  Youtube: iconMap.youtube,
  Github: iconMap.githubSolid,
  Cloud: iconMap.ncCloud,
}

const truncate = ref(true)

const { $e } = useNuxtApp()

const expand = () => {
  truncate.value = false
  $e('c:nocodb:feed:recents:expand', {
    title: Title,
    type: source,
  })
}

const watchVideo = () => {
  $e('c:nocodb:feed:recents:watch', {
    title: Title,
    description: Description,
    url: Url,
    type: 'youtube',
  })
}

const renderedText = computedAsync(async () => {
  return await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(
      truncate.value
        ? Description.replace(/!\[.*?\]\(.*?\)/g, '')
            .substring(0, 250)
            .concat('...')
        : Description.replace(/^\[!\[.*?\]\(https?:\/\/.*?\)\]\(https?:\/\/.*?\)/m, ''),
    )
})

const { width } = useWindowSize()

const handleOpenUrl = (url: string) => {
  if (source === 'Cloud') return

  openLink(url)
}
</script>

<template>
  <div class="bg-white recent-card border-gray-200 border-1 rounded-2xl max-w-[540px] xl:max-w-[640px]">
    <div class="flex items-center justify-between px-5 py-4">
      <div class="flex items-center gap-3">
        <component :is="feedIcon[source]" class="w-4 h-4 stroke-transparent" />
        <span class="font-weight-medium text-nc-content-gray leading-5 cursor-pointer" @click="handleOpenUrl(Url)">
          {{ source }}
        </span>
      </div>
      <div class="text-sm text-nc-content-gray-muted leading-5">
        {{ timeAgo(CreatedAt) }}
      </div>
    </div>
    <template v-if="['Github', 'Cloud'].includes(source)">
      <div class="pb-5">
        <img v-if="Image" :src="Image" class="cursor-pointer" @click="handleOpenUrl(Url)" />
        <div class="prose px-5 mt-5" v-html="renderedText"></div>

        <NcButton v-if="truncate" size="small" class="w-29 mx-5" type="text" @click="expand">
          <div class="gap-2 flex items-center">
            Show more
            <GeneralIcon icon="arrowDown" />
          </div>
        </NcButton>
      </div>
    </template>
    <template v-else-if="source === 'Youtube'">
      <YoutubeVue3
        :videoid="extractYoutubeVideoId(Url)"
        :controls="1"
        :height="width < 1280 ? 330 : 392"
        :width="width < 1280 ? 538 : 638"
        :autoplay="0"
        @played="watchVideo"
      />
      <div class="p-5 flex flex-col text-nc-content-gray-emphasis gap-4">
        <div class="text-2xl font-semibold truncate">
          {{ Title }}
        </div>

        <div class="font-weight-base text-md">
          {{ Description.substring(0, 200).concat('...') }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.recent-card {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
  :deep(.prose) {
    a {
      @apply text-gray-900;
    }
    h1 {
      @apply text-3xl text-nc-content-gray-emphasis truncate leading-9 mb-0;
      font-weight: 700;
    }

    h2 {
      @apply text-nc-content-gray-emphasis text-xl leading-6 !mb-0;
    }
    p {
      @apply text-nc-content-gray-emphasis leading-6;
      font-size: 14px !important;
    }

    li {
      @apply text-nc-content-gray-emphasis leading-6;
      font-size: 14px !important;
    }

    h3 {
      @apply text-nc-content-gray-emphasis text-lg leading-6 mb-0;
    }
  }
}
</style>
