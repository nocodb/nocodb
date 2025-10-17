<script setup lang="ts">
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { CarouselApi } from '~/components/nc/Carousel/interface'

const route = useRoute()
const router = useRouter()
const templateId = computed(() => route.params.templateId)
const typeOrId = computed(() => route.params.typeOrId)

const { activeCategory, getTemplateById, currentCategoryInfo } = useMarketplaceTemplates('marketplace')

const template = ref<Record<string, any> | null>(null)
const isLoading = ref(true)
const error = ref<string | null>(null)
const carouselApi = ref<CarouselApi>()
const currentSlideIndex = ref(0)

const fetchTemplateDetails = async () => {
  isLoading.value = true
  error.value = null

  try {
    template.value = await getTemplateById(templateId.value)
  } catch (err) {
    console.error('Failed to fetch template details:', err)
    error.value = 'Failed to load template details'
  } finally {
    isLoading.value = false
  }
}

const dummyTemplate = {
  'Id': 1,
  'Title': 'Sales CRM',
  'Description':
    'Streamline your sales process with this Sales CRM template. Track leads, manage contacts, and close more deals efficiently with this powerful and customizable Sales CRM solution.',
  'Thumbnail': 'https://images.unsplash.com/photo-1552664730-d307ca884978?q=80&w=2070&auto=format&fit=crop',
  'Features': [
    'Lead tracking and management',
    'Contact organization',
    'Deal pipeline visualization',
    'Sales analytics and reporting',
    'Task management and reminders',
    'Email integration',
    'Customizable fields and workflows',
  ],
  'Structure':
    'Perfect for sales teams looking to organize leads, track customer interactions, and manage the sales pipeline from prospect to close. Ideal for small to medium businesses wanting to improve their sales process efficiency.',
  'UseCase':
    'Perfect for sales teams looking to organize leads, track customer interactions, and manage the sales pipeline from prospect to close. Ideal for small to medium businesses wanting to improve their sales process efficiency.',
  'Industry': 'Sales',
  'Screenshots': [
    'https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1542744173-8e7e53415bb0?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?q=80&w=2070&auto=format&fit=crop',
    'https://images.unsplash.com/photo-1531538606174-0f90ff5dce83?q=80&w=2074&auto=format&fit=crop',
  ],
  'Shared Base Url': 'https://example.com/template/sales-crm',
}

// Use dummy data for now
onMounted(() => {
  // fetchTemplateDetails()
  setTimeout(() => {
    template.value = dummyTemplate
    isLoading.value = false
  }, 500)
})

// Related templates
const relatedTemplates = [
  {
    Id: 2,
    Title: 'Sales Pipeline',
    Thumbnail: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2015&auto=format&fit=crop',
    Description: 'Track, manage, and optimize your sales process with this Sales Pipeline template',
  },
  {
    Id: 3,
    Title: 'Intercom',
    Thumbnail: 'https://images.unsplash.com/photo-1556745757-8d76bdb6984b?q=80&w=2066&auto=format&fit=crop',
    Description: 'Manage customer conversations, support tickets, and customer feedback efficiently',
  },
  {
    Id: 4,
    Title: 'Sales CRM',
    Thumbnail: 'https://images.unsplash.com/photo-1560472355-536de3962603?q=80&w=2070&auto=format&fit=crop',
    Description: 'Streamline your sales process with this powerful and customizable Sales CRM solution',
  },
  {
    Id: 5,
    Title: 'Dashboard CRM',
    Thumbnail: 'https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?q=80&w=2070&auto=format&fit=crop',
    Description: 'Manage your sales pipeline, track leads, and close more deals',
  },
  {
    Id: 6,
    Title: 'Organization Finance',
    Thumbnail: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?q=80&w=2011&auto=format&fit=crop',
    Description: 'Track expenses, manage budgets, and monitor financial health',
  },
  {
    Id: 7,
    Title: 'Human Resources',
    Thumbnail: 'https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=2070&auto=format&fit=crop',
    Description: 'Streamline HR management, track recruitment, and organize employee data',
  },
]

const openRelatedTemplate = (templateId) => {
  router.push(`/${typeOrId.value}/marketplace/template/${templateId}`)
}

const descriptionRendered = computedAsync(async () => {
  return await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(template.value?.Description ?? '')
})

const structureRendered = computedAsync(async () => {
  return await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(template.value?.Structure ?? '')
})

const navigateToCategory = (category: string) => {
  activeCategory.value = category
  router.push(`/${typeOrId.value}/marketplace/${category}`)
}

const navigateToHome = () => {
  router.push(`/${typeOrId.value}/marketplace`)
}

const screenshots = computed(() => {
  if (template.value?.Screenshots?.length) {
    return template.value.Screenshots
  }
  return [
    { url: template.value?.Image || '/img/marketplace/template-placeholder.png', title: 'Screenshot 1' },
    { url: '/img/marketplace/template-placeholder-2.png', title: 'Screenshot 2' },
    { url: '/img/marketplace/template-placeholder-3.png', title: 'Screenshot 3' },
  ]
})

const onCarouselInit = (api: CarouselApi) => {
  carouselApi.value = api

  if (api) {
    api.on('select', () => {
      currentSlideIndex.value = api.selectedScrollSnap()
    })

    currentSlideIndex.value = api.selectedScrollSnap()
  }
}

const scrollToSlide = (index: number) => {
  if (carouselApi.value) {
    carouselApi.value.scrollTo(index)
    currentSlideIndex.value = index
  }
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <div class="overflow-auto">
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <GeneralLoader size="large" />
      </div>

      <div v-else-if="error" class="flex flex-col items-center justify-center py-12">
        <div class="text-nc-content-grey-subtle2 text-lg">{{ error }}</div>
        <button class="mt-4 btn-primary" @click="fetchTemplateDetails">Retry</button>
      </div>

      <div v-else-if="template" class="template-detail mb-10">
        <div class="flex items-center gap-3 mb-6 sticky top-0 bg-white z-10">
          <div class="text-nc-content-grey text-heading2 font-semibold flex-1">
            {{ template.Title }}
          </div>

          <NcButton size="small"> Use this Template </NcButton>
        </div>

        <div class="mb-16">
          <NcCarousel class="w-full template-carousel" @init-api="onCarouselInit">
            <NcCarouselContent>
              <NcCarouselItem v-for="(screenshot, index) in screenshots" :key="index">
                <div class="w-full h-[300px] flex items-center justify-center">
                  <img
                    :src="screenshot.url"
                    :alt="screenshot.title || `Screenshot ${index + 1}`"
                    class="max-h-full max-w-full object-contain rounded-lg shadow-lg"
                  />
                </div>
              </NcCarouselItem>
            </NcCarouselContent>

            <div class="flex items-center justify-center gap-3 mt-6 flex-wrap">
              <div
                v-for="(screenshot, index) in screenshots"
                :key="index"
                class="thumbnail-wrapper cursor-pointer transition-all"
                :class="{ selected: currentSlideIndex === index }"
                @click="scrollToSlide(index)"
              >
                <img :src="screenshot.url" :alt="`Thumbnail ${index + 1}`" class="h-16 w-24 object-cover rounded" />
              </div>
            </div>
          </NcCarousel>
        </div>

        <NcTabs>
          <a-tab-pane key="overview" class="w-full">
            <template #tab>
              <div class="font-bold text-captionBold">Overview</div>
            </template>
            <div class="my-4" v-html="descriptionRendered"></div>
          </a-tab-pane>

          <a-tab-pane key="structure" class="w-full">
            <template #tab>
              <div class="font-bold text-captionBold">Structure</div>
            </template>
            <div class="my-4" v-html="structureRendered"></div>
          </a-tab-pane>
        </NcTabs>
        <div>
          <h2 class="text-heading3 font-semibold mt-6">
            Other <span class="capitalize">{{ activeCategory === 'marketplace' ? '' : activeCategory }}</span> Templates
          </h2>
          <div class="text-body text-nc-content-grey">
            {{ currentCategoryInfo?.subtitle }}
          </div>
          <div class="grid grid-cols-1 mt-8 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MarketplaceCard
              v-for="relatedTemplate in relatedTemplates"
              :key="relatedTemplate.Id"
              class="template-card"
              :title="relatedTemplate.Title"
              :description="relatedTemplate.Description"
              :image="relatedTemplate.Thumbnail"
              @click="openRelatedTemplate(relatedTemplate)"
            />
          </div>
        </div>
        <div>
          <h2 class="text-heading3 font-semibold mt-16">Browse by category</h2>
          <div class="text-body text-nc-content-grey">Explore further to discover the base that fits you best.</div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(162px,1fr))] gap-6 my-8">
            <div class="template-category-item" @click="navigateToCategory('sales')">
              <img src="~/assets/img/marketplace/sales.png" height="48" width="48" alt="Sales" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Sales</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('marketing')">
              <img src="~assets/img/marketplace/marketing.png" height="48" width="48" alt="Marketing" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Marketing</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('hr')">
              <img src="~assets/img/marketplace/human-resources.png" height="48" width="48" alt="Human Resources" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Human Resources</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('product-management')">
              <img src="~assets/img/marketplace/product-management.png" height="48" width="48" alt="Product Management" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Product Management</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('operations')">
              <img src="~assets/img/marketplace/operations.png" height="48" width="48" alt="Operations" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Operations</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('project-management')">
              <img src="~assets/img/marketplace/product-management.png" height="48" width="48" alt="Project Management" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Project Management</div>
            </div>

            <!-- Industry Categories -->
            <div class="template-category-item" @click="navigateToCategory('healthcare')">
              <img src="~assets/img/marketplace/healthcare.png" height="48" width="48" alt="Healthcare" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Healthcare</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('finance')">
              <img src="~assets/img/marketplace/finance.png" height="48" width="48" alt="Finance" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Finance</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('education')">
              <img src="~assets/img/marketplace/education.png" height="48" width="48" alt="Education" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Education</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('manufacturing')">
              <img src="~assets/img/marketplace/manufacturing.png" height="48" width="48" alt="Manufacturing" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Manufacturing</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('real-estate')">
              <img src="~assets/img/marketplace/realestate.png" height="48" width="48" alt="Real Estate" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Real Estate</div>
            </div>

            <div class="template-category-item" @click="navigateToCategory('retail')">
              <img src="~assets/img/marketplace/retail.png" height="48" width="48" alt="Retail" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">Retail</div>
            </div>
          </div>

          <NcButton type="secondary" size="small" @click="navigateToHome()">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncArrowLeft" />
              <span class="text-bodySmBold">Back to Home</span>
            </div>
          </NcButton>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scped>
.marketplace-container {
  .ant-tabs-nav {
    @apply mb-6;
  }

  .ant-tabs-tab {
    @apply pt-1 pb-1.5;
  }

  .template-category-item {
    box-shadow: 0px 0px 4px 2px rgba(0, 0, 0, 0.04);
    width: 162px;
    @apply p-3 flex flex-col gap-3 transition-all border-1 border-nc-border-gray-light rounded-2xl cursor-pointer;

    &:hover {
      box-shadow: 0px 0px 4px 2px rgba(0, 0, 0, 0.08);
    }

    * img {
      @apply !h-12 !w-12;
    }
  }

  .template-carousel {
    @apply rounded-lg overflow-hidden;

    .embla__slide {
      @apply transition-opacity duration-300;

      img {
        @apply transition-transform duration-300;

        &:hover {
          transform: scale(1.02);
        }
      }
    }

    .thumbnail-wrapper {
      @apply opacity-70 transition-all rounded overflow-hidden;

      img {
        @apply transition-all duration-200;
      }

      &:hover {
        @apply opacity-90;
      }

      &.selected {
        @apply opacity-100 shadow-md border-1 border-nc-border-brand;
        box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
        transform: translateY(-2px);
      }
    }
  }
}
</style>
