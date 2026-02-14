<script lang="ts" setup>
import { IntegrationsType } from 'nocodb-sdk'
const { activeIntegrationItem } = useIntegrationStore()

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
  <NcModalSupportedDocs :docs="supportedDocs">
    <template #title> {{ $t('title.relevantDocumentation') }} </template>
  </NcModalSupportedDocs>
</template>
