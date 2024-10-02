<script setup lang="ts">
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import { unified } from 'unified'
import dayjs from 'dayjs'

const props = defineProps<{
  body: string
  date: string
}>()

const renderMarkdown = async (markdown: string) => {
  return await unified().use(remarkParse).use(remarkRehype).use(rehypeSanitize).use(rehypeStringify).process(markdown)
}

const renderedText = computedAsync(async () => {
  return await renderMarkdown(props.body)
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
            {{ dayjs(date).format('MMMM D, YYYY') }}
          </div>
        </div>
      </div>

      <div class="content">
        <div class="flex flex-col py-6 gap-8">
          <div class="prose max-w-none" v-html="renderedText"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
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
        @apply bg-brand-500 absolute w-1.5 h-1.5 left-0 rounded-full transform -translate-x-1/2;
        content: '';
      }
    }
  }
}
</style>
