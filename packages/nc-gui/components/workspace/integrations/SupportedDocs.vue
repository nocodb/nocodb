<script lang="ts" setup>
import { IntegrationsType } from 'nocodb-sdk'
const { activeIntegration, activeIntegrationItem } = useIntegrationStore()

const supportedDocs = computed(() => {
  const docs = [
    {
      title: 'Integrations',
      href: 'https://nocodb.com/docs/product-docs/integrations',
    },
    {
      title: 'Create new connection',
      href: 'https://nocodb.com/docs/product-docs/integrations/create-connection',
    },
  ]

  if (activeIntegrationItem.value?.type === IntegrationsType.Database) {
    docs.push({
      title: 'Add new Data source',
      href: 'https://nocodb.com/docs/product-docs/data-sources/connect-to-data-source',
    })
  }

  return docs as {
    title: string
    href: string
  }[]
})
</script>

<template>
  <div class="w-full flex flex-col gap-3">
    <div class="text-sm text-gray-800 font-semibold">Relevant documentation</div>

    <div>
      <div v-for="(doc, idx) of supportedDocs" :key="idx" class="flex items-center gap-1">
        <div class="h-7 w-7 flex items-center justify-center">
          <GeneralIcon icon="bookOpen" class="flex-none w-4 h-4 text-gray-600" />
        </div>
        <a
          :href="doc.href"
          target="_blank"
          rel="noopener noreferrer"
          class="!text-gray-700 text-sm !no-underline !hover:underline"
        >
          {{ doc.title }}
        </a>
      </div>
    </div>
  </div>
</template>
