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
}>()

const {
  item: { CreatedAt, Description, Url, Title, Tags },
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
  'Bug fixes': {
    icon: iconMap.ncTool,
    color: 'green',
  },
}

const tags = computed(() => {
  return Tags?.split(',').map((tag) => ({
    text: tag,
    href: `/tags/${tag}`,
    ...(iconColorMap[tag as any] || {}),
  }))
})

const renderMarkdown = async (markdown: string) => {
  return await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(markdown)
}

const renderedText = computedAsync(async () => {
  return await renderMarkdown(Description)
})
</script>

<template>
  <div class="block px-12 relative">
    <div class="relative pb-12">
      <div class="aside">
        <div class="aside-divider">
          <div class="aside-divider-dot"></div>
        </div>
        <div class="aside-inner">
          <div class="text-sm text-gray-700 leading-5">
            {{ dayjs(CreatedAt).format('MMMM D, YYYY') }}
          </div>
        </div>
      </div>

      <div class="content">
        <div class="flex flex-col py-6 gap-5">
          <div class="flex items-center">
            <div
              v-for="tag in tags"
              :key="tag.text"
              :class="{
                'bg-red-50': tag.color === 'red',
                'bg-purple-50': tag.color === 'purple',
                'bg-green-50': tag.color === 'green',
              }"
              :href="tag.href"
              class="mr-3 flex gap-2 items-center px-1 rounded-md"
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
                  'text-green-500': tag.color === 'green',
                }"
                class="leading-5 text-[13px]"
              >
                {{ tag.text }}
              </span>
            </div>
          </div>
          <div class="flex flex-col gap-2">
            <NcBadge
              :border="false"
              color="brand"
              class="font-semibold nc-title-badge cursor-pointer"
              @click="openLink(item.Url)"
            >
              {{ Title }}
            </NcBadge>
            <div class="prose max-w-none" v-html="renderedText"></div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-title-badge {
  width: fit-content;
}

.content {
  @apply !pl-50;
}

.prose {
  .prose ul > li {
    &:before {
      @apply !bg-brand-500;
    }
  }
}

.aside {
  @apply absolute left-0 top-2 bottom-2 w-44;

  .aside-inner {
    @apply sticky top-0;
  }

  .aside-divider {
    @apply absolute top-0 right-0 bottom-0 w-1.5;
    &:before {
      @apply absolute bg-[#E7E7E9] left-0 transform -translate-x-1/2;
      content: '';
      top: 6px;
      bottom: -18px;
      width: 2px;
      border-radius: 2px;
    }

    .aside-divider-dot {
      @apply sticky top-0
      transform: translateY(calc(-50% + 3px)) translateX(50%);
      &:before {
        @apply bg-brand-500 absolute w-2 h-2 border-2 border-white left-0 rounded-full transform -translate-x-1/2;
        content: '';
      }
    }
  }
}
</style>
