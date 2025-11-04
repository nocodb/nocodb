<script lang="ts" setup>
const { isLoading, loadingTrigger, hasMore, templates } = useMarketplaceTemplates('all-templates')
</script>

<template>
  <div v-if="hasMore && templates.length" ref="loadingTrigger" class="py-4 flex justify-center">
    <div v-if="isLoading" class="flex items-center gap-2">
      <GeneralLoader size="medium" />
      <span class="text-nc-content-gray-subtle2">{{ $t('objects.templates.loadingMoreTemplates') }}...</span>
    </div>
  </div>
</template>
