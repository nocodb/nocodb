<script setup lang="ts">
const activeCategory = ref('marketplace')

const search = ref('')
</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <div class="flex flex-col gap-6">
      <div class="flex gap-8">
        <MarketplaceSidebar v-model:active-category="activeCategory" v-model:search-query="search" />

        <div class="flex-1">
          <h2 class="text-xl text-nc-content-gray font-bold">
            {{ activeCategory === 'marketplace' ? 'Popular templates' : activeCategory }}
          </h2>
          <div class="text-nc-content-gray-subtle2">Browse the most popular bases among our users.</div>

          <div class="grid grid-cols-3 gap-8 mt-8">
            <MarketplaceCard />
            <MarketplaceCard />
            <MarketplaceCard />
            <MarketplaceCard />
            <MarketplaceCard />
            <MarketplaceCard />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
