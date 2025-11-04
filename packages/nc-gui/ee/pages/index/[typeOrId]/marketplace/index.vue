<script setup lang="ts">
const { hideSidebar } = storeToRefs(useSidebarStore())

const { activeCategory } = useMarketplaceTemplates('all-templates')

onMounted(() => {
  hideSidebar.value = true
})
</script>

<template>
  <div>
    <NuxtLayout name="empty">
      <div class="marketplace-container">
        <MarketplaceHeader />
        <div class="container">
          <MarketplaceSidebar v-model:active-category="activeCategory" class="sticky top-0" />

          <NuxtPage />
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<style lang="scss" scoped>
.marketplace-container {
  & > .container {
    @apply flex gap-8 mt-8 px-8 mx-auto relative;

    @apply h-[calc(100vh_-_80px)];

    @supports (height: 100dvh) {
      @apply h-[calc(100dvh_-_80px)];
    }
  }
}
</style>
