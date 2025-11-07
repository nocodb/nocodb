<script setup lang="ts">
const route = useRoute()
const router = useRouter()
const typeOrId = computed(() => route.params.typeOrId as string)

const { templates, isLoading, activeCategory, templateContainer, openTemplate, categoryInfo, setupObserver } =
  useMarketplaceTemplates('all-templates')

watch(activeCategory, (newCategory) => {
  if (newCategory !== 'all-templates') {
    router.push(`/${typeOrId.value}/templates/${newCategory}`)
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
    <div class="mb-6 pb-2 pt-6 sticky top-0 bg-nc-bg-default z-10 -mx-6 px-6">
      <h2 class="text-heading3 text-nc-content-gray mb-2">
        {{ categoryInfo['all-templates']?.title }}
      </h2>
      <div class="text-nc-content-gray-subtle2 text-body">{{ categoryInfo['all-templates']?.subtitle }}</div>
    </div>

    <div class="pb-8">
      <div
        ref="templateContainer"
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 4xl:grid-cols-6 gap-8 template-container"
      >
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

        <MarketplaceEmpty v-else-if="!templates.length" />
      </div>

      <MarketplaceLoadMoreIndicator />
    </div>
  </div>
</template>
