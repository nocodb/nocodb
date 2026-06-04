<script lang="ts" setup>
const { isWhiteLabelled, logoUrl, productName, config } = useBranding()

// When white-labelled, clicking the footer goes to the configured footer URL
// (if any) instead of nocodb.com — most on-prem deployments will leave this
// blank and the wordmark becomes a static decoration.
const onClick = () => {
  if (isWhiteLabelled.value) {
    const url = config.value?.email?.footerUrl
    if (url) openLink(url)
    return
  }
  openLink('https://www.nocodb.com')
}
</script>

<template>
  <div
    v-if="isWhiteLabelled"
    class="flex items-center gap-3 text-gray-700 dark:text-slate-300"
    :class="{ 'cursor-pointer': !!config?.email?.footerUrl }"
    @click="onClick"
  >
    <img v-if="logoUrl" :src="logoUrl" :alt="productName" class="h-7 max-w-[112px] object-contain -my-0.5" />
    <div class="text-sm">{{ productName }} Forms</div>
  </div>
  <div v-else class="flex items-center gap-3 cursor-pointer text-gray-700 dark:text-slate-300" @click="onClick">
    <GeneralIcon icon="nocodb1" class="w-7 h-7 -my-0.5" />

    <div class="text-sm">NocoDB Forms</div>
  </div>
</template>
