<script setup lang="ts">
const { hideSidebar } = storeToRefs(useSidebarStore())

const { activeCategory } = useMarketplaceTemplates('marketplace')

onMounted(() => {
  hideSidebar.value = true
})
</script>

<template>
  <div>
    <NuxtLayout name="empty">
      <div class="marketplace-container">
        <MarketplaceHeader />
        <div class="flex container h-[calc(100vh_-_80px)] gap-8 mt-8 px-8 mx-auto">
          <MarketplaceSidebar v-model:active-category="activeCategory" class="sticky top-0" />

          <NuxtPage />
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>
