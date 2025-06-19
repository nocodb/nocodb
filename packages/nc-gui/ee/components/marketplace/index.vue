<script setup lang="ts">
const activeCategory = ref('marketplace')

const { templates, query, loadTemplates, isLoading, hasMore } = useTemplates()

const categoryInfo = {
  'marketplace': {
    title: 'Popular templates',
    subtitle: 'Browse the most popular bases among our users.',
  },
  // Departments
  'sales': {
    title: 'Sales Templates',
    subtitle: 'Streamline your sales process with these ready-to-use templates.',
  },
  'marketing': {
    title: 'Marketing Templates',
    subtitle: 'Boost your marketing efforts with these specialized templates.',
  },
  'hr': {
    title: 'Human Resources Templates',
    subtitle: 'Simplify HR management with these comprehensive templates.',
  },
  'product-management': {
    title: 'Product Management Templates',
    subtitle: 'Organize your product development workflow with these templates.',
  },
  'operations': {
    title: 'Operations Templates',
    subtitle: 'Optimize your business operations with these efficient templates.',
  },
  'project-management': {
    title: 'Project Management Templates',
    subtitle: 'Track and manage your projects effectively with these templates.',
  },
  // Industries
  'healthcare': {
    title: 'Healthcare Templates',
    subtitle: 'Specialized templates for healthcare organizations and professionals.',
  },
  'finance': {
    title: 'Finance Templates',
    subtitle: 'Manage financial data and processes with these tailored templates.',
  },
  'education': {
    title: 'Education Templates',
    subtitle: 'Templates designed for educational institutions and learning management.',
  },
  'manufacturing': {
    title: 'Manufacturing Templates',
    subtitle: 'Streamline manufacturing processes with these industry-specific templates.',
  },
  'real-estate': {
    title: 'Real Estate Templates',
    subtitle: 'Templates for property management and real estate businesses.',
  },
  'retail': {
    title: 'Retail Templates',
    subtitle: 'Optimize inventory and sales tracking with these retail-focused templates.',
  },
}

const currentCategoryInfo = computed(() => {
  return categoryInfo[activeCategory.value] || categoryInfo.marketplace
})

const debouncedSearch = refDebounced(query.search, 1000)

watch(activeCategory, (newCategory) => {
  query.usecase = null
  query.industry = null

  if (newCategory === 'marketplace') return

  const departments = ['sales', 'marketing', 'hr', 'product-management', 'operations', 'project-management']
  if (departments.includes(newCategory)) {
    query.usecase = newCategory
    return
  }

  const industries = ['healthcare', 'finance', 'education', 'manufacturing', 'real-estate', 'retail']
  if (industries.includes(newCategory)) {
    query.industry = newCategory
  }
})

onMounted(() => {
  loadTemplates({ reset: true })
})

const templateContainer = ref(null)
const loadingTrigger = ref(null)

onMounted(() => {
  const observer = new IntersectionObserver(
    (entries) => {
      if (entries[0].isIntersecting && !isLoading.value && hasMore.value) {
        loadTemplates()
      }
    },
    { threshold: 0.1 },
  )

  if (loadingTrigger.value) {
    observer.observe(loadingTrigger.value)
  }

  onBeforeUnmount(() => {
    observer.disconnect()
  })
})
</script>

<template>
  <div class="container mx-auto py-8 px-4">
    <div class="flex flex-col gap-6">
      <div class="flex gap-8">
        <MarketplaceSidebar v-model:active-category="activeCategory" v-model:search-query="debouncedSearch" />

        <div class="flex-1">
          <h2 class="text-xl text-nc-content-gray font-bold">
            {{ currentCategoryInfo.title }}
          </h2>
          <div class="text-nc-content-gray-subtle2">{{ currentCategoryInfo.subtitle }}</div>

          <div ref="templateContainer" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mt-8">
            <template v-if="templates.length">
              <div v-for="template in templates" :key="template.id" class="template-card">
                <MarketplaceCard
                  :title="template.title"
                  :description="template.description"
                  :image="template.image || 'https://via.placeholder.com/300x200'"
                />
              </div>
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
                <div class="text-nc-content-gray-subtle2">Try adjusting your search or filters</div>
              </div>
            </template>
          </div>

          <!-- Loading indicator and trigger for infinite scroll -->
          <div v-if="hasMore" ref="loadingTrigger" class="py-8 flex justify-center">
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

  &:hover {
    transform: translateY(-4px);
  }
}

.template-card-skeleton {
  @extend .template-card;
}
</style>
