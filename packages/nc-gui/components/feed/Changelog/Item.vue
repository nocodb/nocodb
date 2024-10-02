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

const markdown = `# Introducing New Field Type : Button  🎉

Introducing the new field type Button, designed to enhance interactivity and automation by utilising data from the current row. This Button field type allows you to wire up the execution to predefined action such as triggering a webhook/API or opening a custom URL or launching a pre-filled NocoDB form. With this, you can dynamically pass record data, enabling highly tailored and context-aware interactions.

[![DemoVideo](https://github.com/user-attachments/assets/0c8539d7-71f1-4b2f-931b-d924eeedde8e)](https://youtu.be/V20tQDkbkvU)


### Added

- Automate workflows by configuring buttons to trigger custom webhooks.
- Configure buttons to open custom URLs
- Easily set up buttons to open pre-filled NocoDB forms
- Tailor the button’s text, colour, and icon to fit your specific needs
- Leverage NocoDB's formula editor to create dynamic URLs and payloads



### 📢 Important notice
This release includes a migration to generate a file reference table, which will be used in future updates to clean up unreferenced attachments. The migration process will run in the background. Please **note that this release doesn’t initiate any clean up of unreferenced files**.

Additionally, we are introducing the [NC_ATTACHMENT_RETENTION_DAYS](https://docs.nocodb.com/getting-started/self-hosted/environment-variables/#storage) configuration for future releases. If this value is set to 0, it will prevent the cleanup of any stale / unreferenced attachments. Otherwise, unreferenced attachments will be removed from the disk after the specified number of days.


**Team NocoDB**
`

const renderedText = computedAsync(async () => {
  return await renderMarkdown(props.body)
})
</script>

<template>
  <div class="block max-w-260 px-12 relative">
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
