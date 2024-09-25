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
  item: { 'Published Time': CreatedAt, Description, Title, Tags },
} = props

const truncate = ref(true)

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
  return await renderMarkdown(truncate.value ? Description.substring(0, 300).concat('...') : Description)
})
</script>

<template>
  <div class="block relative">
    <div class="vertical-line"></div>
    <div class="relative border-1 border-nc-gray-medium rounded-xl pb-6 changelog-item bg-white">
      <div class="aside">
        <div class="aside-divider">
          <div class="aside-divider-dot mt-8"></div>
        </div>
        <div class="aside-inner">
          <div class="text-sm text-right pr-8 text-gray-700 leading-5">
            {{ dayjs(CreatedAt).format('MMMM D, YYYY') }}
          </div>
        </div>
      </div>

      <div class="content">
        <div class="pt-6 pr-6 space-y-5">
          <div class="flex items-center">
            <a
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
                  'text-green-700': tag.color === 'green',
                }"
                class="leading-5 text-[13px]"
              >
                {{ tag.text }}
              </span>
            </a>
          </div>
          <div class="flex flex-col gap-2">
            <NcBadge
              :border="false"
              color="brand"
              class="font-semibold text-[13px] nc-title-badge cursor-pointer"
              @click="openLink(item.Url)"
            >
              {{ Title }}
            </NcBadge>
            <div class="prose max-w-none" v-html="renderedText"></div>

            <NcButton v-if="truncate" size="small" class="w-29" type="text" @click="truncate = false">
              <div class="gap-2 flex items-center">
                Show more
                <GeneralIcon icon="arrowDown" />
              </div>
            </NcButton>
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

.vertical-line {
  @apply ml-47.5;
  height: 24px;
  width: 2px;
  background-color: #e7e7e9;
}

.changelog-item {
  box-shadow: 0px 2px 4px -2px rgba(51, 102, 255, 0.08), 0px 4px 4px -2px rgba(51, 102, 255, 0.04);
}

.content {
  @apply !pl-52;

  a {
    @apply !no-underline;
  }

  :deep(.prose) {
    a {
      @apply text-gray-900;
    }

    h1 {
      @apply text-2xl text-nc-content-gray-emphasis leading-9 mb-0;
      font-weight: 700;
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
      @apply text-nc-content-gray-emphasis text-lg leading-5 mb-0;
    }
  }
}

.aside {
  @apply absolute left-0 top-0 bottom-0 w-52;

  .aside-inner {
    @apply sticky top-0 pt-5 pb-4;
  }

  .aside-divider {
    @apply absolute top-0 right-0 bottom-0 w-1.5 mr-3;
    &:before {
      @apply absolute bg-[#E7E7E9] left-0 transform -translate-x-1/2;
      content: '';
      top: 0px;
      bottom: 0px;
      width: 2px;
      border-radius: 2px;
    }

    .aside-divider-dot {
      @apply sticky h-5 mr-3 top-9;
      transform: translateY(calc(-50% + 3px)) translateX(50%);
      &:before {
        @apply bg-brand-500 absolute w-2 h-2 border-2 border-white left-0 rounded-full transform -translate-x-1/2;
        content: '';
      }
    }
  }
}
</style>
