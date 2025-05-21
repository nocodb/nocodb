<script setup lang="ts">
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import dayjs from 'dayjs'
import type { ProductFeedItem } from '../../../lib/types'

const props = defineProps<{
  item: ProductFeedItem
  index: number
}>()

const {
  item: { 'Published Time': CreatedAt, Description, Title, Tags, Image, 'Feed Source': source },
} = props

const iconColorMap = {
  'Hotfix': {
    icon: iconMap.ncTool,
    color: 'red',
  },
  'Feature': {
    icon: iconMap.star,
    color: 'purple',
  },
  'Bug Fixes': {
    icon: iconMap.ncTool,
    color: 'green',
  },
}

const tags = computed(() => [
  ...(props.index === 0
    ? [
        {
          text: 'Latest Release',
          color: 'purple',
        },
      ]
    : []),
  ...(Tags?.split(',').map((tag) => ({
    text: tag,
    ...(iconColorMap[tag] || {}),
  })) || []),
])

const renderMarkdown = async (markdown: string) => {
  return await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(markdown)
}

const truncate = ref(true)

const renderedText = computedAsync(async () => {
  return await renderMarkdown(
    truncate.value
      ? Description.replace(/[*_~]|\[.*?\]|<\/?[^>]+(>|$)/g, '')
          .replace(/\(https?:\/\/[^\s)]+\)\]\(https?:\/\/[^\s)]+\)/g, '')
          .replace(/^(\*\*)?#?\s*(\p{Emoji})\s*NocoDB\s*v[\d.]+(\s*-\s*|\*\*$)/u, '# ')
          .replace(/(!?\(https?:\/\/[^\s)]+\)(?:\]\(https?:\/\/[^\s)]+(?:\s+"[^"]*")?\))?)/g, '')
          .replace('-', '')
          .substring(0, 100)
          .concat('...')
      : Description.replace(/^\[!\[.*?\]\(https?:\/\/.*?\)\]\(https?:\/\/.*?\)/m, '').replace(
          /^(\*\*)?#?\s*(\p{Emoji})\s*NocoDB\s*v[\d.]+(\s*-\s*|\*\*$)/u,
          '# ',
        ),
  )
})

const { $e } = useNuxtApp()

const expand = (e) => {
  e.stopPropagation()
  truncate.value = false
  $e('c:nocodb:feed:changelog:expand', {
    title: Title,
  })
}

const handleOpenUrl = (url: string) => {
  if (source === 'Cloud') return
  openLink(url)
}
</script>

<template>
  <div class="relative rounded-xl flex flex-col mt-6.25 bg-white changelog-card">
    <div
      class="w-full relative border cursor-pointer border-black h-[334px] xl:h-[394px] w-[540px] xl:w-[638px] border-opacity-10 rounded-t-xl overflow-hidden"
      @click="handleOpenUrl(item.Url)"
    >
      <img
        v-if="Image"
        :src="Image"
        class="absolute w-full h-full inset-0 object-cover transition-all ease-in-out transform hover:scale-105"
      />
    </div>
    <div class="flex my-4 px-4 items-center justify-between">
      <div class="flex items-center flex-wrap gap-3">
        <NcBadge :border="false" color="brand" class="font-semibold text-[13px] nc-title-badge cursor-pointer whitespace-nowrap">
          {{ Title }}
        </NcBadge>
        <span
          v-for="tag in tags"
          :key="tag.text"
          :class="{
            'bg-red-50': tag.color === 'red',
            'bg-purple-50': tag.color === 'purple',
            'bg-green-50': tag.color === 'green',
          }"
          class="flex gap-2 items-center px-1 rounded-md"
        >
          <component
            :is="tag.icon"
            :class="{
              'fill-red-700 text-transparent': tag.color === 'red',
              'fill-purple-700 text-transparent': tag.color === 'purple',
              'fill-green-700 text-transparent': tag.color === 'green',
            }"
            class="w-4 h-4"
          />
          <span
            :class="{
              'text-red-500': tag.color === 'red',
              'text-purple-500': tag.color === 'purple',
              'text-green-700': tag.color === 'green',
            }"
            class="leading-5 text-[13px] whitespace-nowrap"
          >
            {{ tag.text }}
          </span>
        </span>
      </div>
      <span class="font-medium text-sm text-gray-500 whitespace-nowrap">
        {{ dayjs(CreatedAt).format('MMM DD, YYYY') }}
      </span>
    </div>
    <div class="flex flex-1 px-4 pb-3 justify-between flex-col gap-2">
      <div class="prose max-w-none" v-html="renderedText"></div>
    </div>
    <NcButton v-if="truncate" size="small" class="w-29 mx-4 mb-3" type="text" @click="expand">
      <div class="gap-2 flex items-center">
        Show more
        <GeneralIcon icon="arrowDown" />
      </div>
    </NcButton>
  </div>
</template>

<style scoped lang="scss">
.nc-title-badge {
  width: fit-content;
}

.changelog-card {
  @apply transform transition-all ease-in-out;
  box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
}

a {
  @apply !no-underline;
}

:deep(.prose) {
  @apply !max-w-auto;
  a {
    @apply text-gray-900;
  }

  h1 {
    @apply text-3xl text-nc-content-gray-emphasis  leading-9 mb-0;
    font-weight: 700;
  }

  h2 {
    @apply text-nc-content-gray-emphasis text-xl leading-6 !my-4;
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

  img {
    @apply !my-4;
  }
}
</style>
