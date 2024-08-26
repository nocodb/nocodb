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

const { getPossibleAttachmentSrc } = useAttachment()

const {
  item: { 'Published Time': CreatedAt, Description, Url, Title, 'Feed Source': source, Images },
} = props

const feedIcon = {
  Twitter: iconMap.twitter,
  Youtube: iconMap.youtube,
  Github: iconMap.githubSolid,
}

const renderedText = computedAsync(async () => {
  return await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(
      Description.replace(/!\[.*?\]\(.*?\)/g, '')
        .substring(0, 300)
        .concat('...')
        .concat(`&nbsp;   [Read more](${Url})`),
    )
})
</script>

<template>
  <div class="bg-white recent-card border-gray-200 border-1 rounded-2xl" style="width: 656px">
    <div class="flex items-center justify-between px-5 py-4">
      <div class="flex items-center gap-3">
        <component :is="feedIcon[source as any]" class="w-4 h-4 stroke-transparent" />
        <span class="font-weight-medium leading-5 cursor-pointer" @click="openLink(Url)">
          {{ source }}
        </span>
      </div>
      <div class="text-sm text-gray-700 leading-5">
        {{ timeAgo(CreatedAt) }}
      </div>
    </div>
    <template v-if="source === 'Github'">
      <LazyCellAttachmentPreviewImage v-if="Images?.length" :srcs="getPossibleAttachmentSrc(Images[0], 'card_cover')" />
      <div class="prose px-5 mt-5" v-html="renderedText"></div>
    </template>
    <template v-else-if="source === 'Youtube'">
      <YoutubeVue3 :videoid="extractYoutubeVideoId(Url)" :controls="1" :height="410" :width="656" :autoplay="0" />
      <div class="p-5 flex flex-col text-gray-900 gap-4">
        <div class="text-2xl font-semibold">
          {{ Title }}
        </div>

        <div class="font-weight-base">
          {{ Description.substring(0, 200).concat('...') }}
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped lang="scss">
.prose {
  a {
    @apply !text-gray-900;
  }
}

.recent-card {
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
}
</style>
