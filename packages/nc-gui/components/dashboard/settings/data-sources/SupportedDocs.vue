<script lang="ts" setup>
const supportedDocs = [
  {
    title: 'Integrations',
    href: 'https://docs.nocodb.com/category/integrations',
  },
  {
    title: 'Create new connection',
    href: 'https://docs.nocodb.com/integrations/create-connection',
  },
  {
    title: 'Add new Data source',
    href: 'https://docs.nocodb.com/data-sources/connect-to-data-source',
  },
] as {
  title: string
  href: string
}[]
</script>

<template>
  <div>
    <div class="w-full flex flex-col gap-3">
      <div class="text-sm text-gray-800 font-semibold">Supported Docs</div>

      <div>
        <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
          <div class="h-7 w-7 flex items-center justify-center">
            <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-500" />
          </div>
          <a
            :href="doc.href"
            target="_blank"
            rel="noopener noreferrer"
            class="!text-gray-600 text-sm !no-underline !hover:underline"
          >
            {{ doc.title }}
          </a>
        </div>
      </div>
    </div>
  </div>
</template>
