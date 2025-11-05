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
        <div class="main-container flex">
          <MarketplaceSidebar v-model:active-category="activeCategory" />

          <div class="flex-1 nc-scrollbar-thin">
            <div class="container">
              <NuxtPage />
            </div>
          </div>
        </div>
      </div>
    </NuxtLayout>
  </div>
</template>

<style lang="scss" scoped>
.marketplace-container {
  .main-container {
    @apply h-[calc(100vh_-_48px)];

    @supports (height: 100dvh) {
      @apply h-[calc(100dvh_-_48px)];
    }

    .container {
      @apply flex gap-8 px-8 mx-auto 2xl:max-w-[1536px] 3xl:max-w-[1920px] 4xl:max-w-[2360px];
    }
  }
}
</style>
