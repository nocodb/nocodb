<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const category = computed(() => route.params.category as TemplateCategoryType)
const typeOrId = computed(() => route.params.typeOrId as string)

const {
  templates,
  isLoading,
  activeCategory,
  categoryInfo,
  currentCategoryInfo,
  templateContainer,
  openTemplate,
  setupObserver,
} = useMarketplaceTemplates(category.value)

const validCategories = Object.keys(categoryInfo)
if (!validCategories.includes(category.value)) {
  router.replace(`/${typeOrId.value}/marketplace`)
}

watch(activeCategory, (newCategory) => {
  if (newCategory !== category.value) {
    if (newCategory === 'marketplace') {
      router.push(`/${typeOrId.value}/marketplace`)
    } else {
      router.push(`/${typeOrId.value}/marketplace/${newCategory}`)
    }
  }
})

onMounted(() => {
  nextTick(() => {
    setupObserver()
  })
})
</script>

<template>
  <div class="flex-1 flex flex-col">
    <div class="mb-6">
      <h2 class="text-xl text-nc-content-gray font-bold">
        {{ currentCategoryInfo.title }}
      </h2>
      <div class="text-nc-content-gray-subtle2">{{ currentCategoryInfo.subtitle }}</div>
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

        <MarketplaceEmpty v-else-if="!templates.length">
          <template #title> No {{ category }} templates found </template>
        </MarketplaceEmpty>
      </div>

      <MarketplaceLoadMoreIndicator />
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
