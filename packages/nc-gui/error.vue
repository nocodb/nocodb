<script lang="ts" setup>
withDefaults(defineProps<{ error: Record<string, any> }>(), { error: () => ({}) })
</script>

<template>
  <GeneralPageDoesNotExist action-button-class="mt-4">
    <template v-if="error.statusCode === 404" #icon>
      <div class="flex min-h-[205px]">
        <img src="~assets/img/placeholder/no-search-result-found.png" class="!w-[264px] flex-none" alt="404 - Page Not Found" />
      </div>
    </template>

    <template #title>
      {{
        error.statusCode === 404 ? '404 - Page Not Found' : error.statusMessage ?? error.message ?? `Error ${error.statusCode}`
      }}
    </template>
  </GeneralPageDoesNotExist>
</template>
