<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const typeOrId = computed(() => route.params.typeOrId as string)

const { templates, isLoading, hasMore, activeCategory, templateContainer, loadingTrigger, openTemplate, categoryInfo } =
  useMarketplaceTemplates('marketplace')

watch(activeCategory, (newCategory) => {
  if (newCategory !== 'marketplace') {
    router.push(`/${typeOrId.value}/marketplace/${newCategory}`)
  }
})
</script>

<template>
  <div class="marketplace-container">
    <MarketplaceHeader />
    <div class="flex container h-[calc(100vh_-_80px)] gap-8 mt-8 mx-auto">
      <MarketplaceSidebar v-model:active-category="activeCategory" class="sticky top-0" />
      <div class="flex-1 flex flex-col">
        <div class="mb-6">
          <h2 class="text-xl text-nc-content-gray font-bold">
            {{ categoryInfo.marketplace.title }}
          </h2>
          <div class="text-nc-content-gray-subtle2">{{ categoryInfo.marketplace.subtitle }}</div>
        </div>

        <div class="overflow-auto">
          <div ref="templateContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 template-container">
            <template v-if="templates.length">
              <MarketplaceCard
                v-for="template in templates"
                :key="template.Id"
                class="template-card"
                :title="template.Title"
                :description="template.Description"
                :image="template.Thumbnail"
                @click="openTemplate(template)"
              />
            </template>

            <template v-else-if="isLoading && !templates.length">
              <div v-for="i in 6" :key="i" class="template-card-skeleton">
                <div class="h-40 bg-gray-200 rounded-lg animate-pulse"></div>
                <div class="h-6 bg-gray-200 rounded-lg mt-2 w-3/4 animate-pulse"></div>
                <div class="h-4 bg-gray-200 rounded-lg mt-2 animate-pulse"></div>
              </div>
            </template>

            <template v-else-if="!templates.length">
              <div class="col-span-3 flex flex-col items-center justify-center py-12">
                <div class="text-nc-content-gray-subtle2 text-lg">No templates found</div>
                <div class="text-nc-content-gray-subtle2">Try checking back later for new templates</div>
              </div>
            </template>
          </div>

          <div v-if="hasMore" ref="loadingTrigger" class="py-4 flex justify-center">
            <div v-if="isLoading" class="flex items-center gap-2">
              <GeneralLoader size="medium" />
              <span class="text-nc-content-gray-subtle2">Loading more templates...</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
.template-card {
  transition: transform 0.2s ease-in-out;
  will-change: transform;

  &:hover {
    transform: translateY(-4px);
  }
}

.template-card-skeleton {
  @extend .template-card;
}
</style>
