<script setup lang="ts">
defineRouteRules({
  prerender: true,
})

import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { CarouselApi } from '~/components/nc/Carousel/interface'

const route = useRoute()
const router = useRouter()

const { $api } = useNuxtApp()

const baseURL = $api.instance.defaults.baseURL

const workspaceId = computed(() => route.params.typeOrId as string)
const templateId = computed(() => route.params.templateId as string)
const typeOrId = computed(() => route.params.typeOrId)

const { categoryInfo, activeCategory, getTemplateById, currentCategoryInfo } = useMarketplaceTemplates('all-templates')

const {
  sharedBaseId,
  isLoading: isCopyingTemplate,
  options,
  isUseThisTemplate,
  isDuplicateDlgOpen,
  selectedWorkspace,
} = useCopySharedBase()

const templateKey = computed(() => `template:${workspaceId.value}:${templateId.value}`)

const {
  data: template,
  pending,
  error: templateError,
  refresh: refreshTemplate,
} = await useFetch<Template>(() => `/api/v2/internal/${workspaceId.value}/nc`, {
  key: templateKey,
  method: 'GET',
  params: {
    operation: 'template',
    id: templateId.value,
  },
  baseURL,
})

const isLoading = pending
const error = ref<string | null>(null)
const carouselApi = ref<CarouselApi>()
const currentSlideIndex = ref(0)

const templateSharedBaseUrl = computed(() => {
  return template.value?.['Shared Base Url']
})

const browseByCategories = computed(() => {
  return Object.entries(categoryInfo)
    .filter(([_key, category]) => !!category.group)
    .map(([key, category]) => ({
      key,
      ...category,
    }))
})

const fetchTemplateDetails = async () => {
  await refreshTemplate()

  // isLoading.value = true
  // error.value = null

  // return

  // try {
  //   template.value = await getTemplateById(templateId.value)
  // } catch (err) {
  //   console.error('Failed to fetch template details:', err)
  //   error.value = 'Failed to load template details'
  // } finally {
  //   isLoading.value = false
  // }
}

onMounted(() => {
  // if (templateId.value && templatesMap.value[templateId.value]) {
  //   template.value = templatesMap.value[templateId.value] as Template
  //   isLoading.value = false
  // } else {
  //   fetchTemplateDetails()
  // }
})

const openRelatedTemplate = (templateId) => {
  router.push(`/${typeOrId.value}/marketplace/${activeCategory.value}/${templateId}`)
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

const relatedTemplates = computed(() => {
  return template.value?.['Related Templates'] || []
})

const screenshots = computed(() => {
  if (template.value?.Screenshots?.length) {
    return template.value.Screenshots.map((screenshot, i) => ({
      url: screenshot,
      title: `${template.value?.Title} ${i + 1}`,
    }))
  }

  return [
    {
      url: template.value?.Thumbnail || '/img/marketplace/template-placeholder.png',
      title: template.value?.Title || 'Screenshot 1',
    },
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

const onUseThisTemplate = () => {
  if (!templateSharedBaseUrl.value) return

  options.value.includeData = true
  options.value.includeViews = true

  isUseThisTemplate.value = true

  const hashPath = new URL(templateSharedBaseUrl.value as string).hash.replace(/^#/, '') // "/base/123"

  if (!hashPath) {
    message.error('Invalid template shared base url')
    return
  }

  const resolvedRoute = router.resolve(hashPath)

  if (!resolvedRoute?.params?.baseId) {
    message.error('Invalid template shared base url')
    return
  }

  sharedBaseId.value = resolvedRoute.params.baseId as string

  selectedWorkspace.value = workspaceId.value!

  isDuplicateDlgOpen.value = true
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <div class="nc-scrollbar-thin">
      <div v-if="isLoading" class="flex justify-center items-center h-64">
        <GeneralLoader size="large" />
      </div>

      <div v-else-if="error || !template" class="flex flex-col items-center justify-center py-12">
        <div class="text-nc-content-grey-subtle2 text-lg">{{ error || $t('msg.error.failedToLoadTemplateDetails') }}</div>
        <NcButton class="mt-4" size="small" type="text" @click="fetchTemplateDetails">{{ $t('general.retry') }}</NcButton>
      </div>

      <div v-else-if="template" class="template-detail mb-10">
        <div class="flex items-center gap-3 mb-6 sticky top-0 bg-white z-10">
          <div class="text-nc-content-grey text-heading2 font-semibold flex-1">
            {{ template.Title }}
          </div>

          <NcTooltip :disabled="!!templateSharedBaseUrl">
            <template #title>
              {{ $t('tooltip.missingSharedBaseUrl') }}
            </template>
            <NcButton size="small" :disabled="!templateSharedBaseUrl" :loading="isCopyingTemplate" @click="onUseThisTemplate">
              {{ $t('labels.useThisTemplate') }}
            </NcButton>
          </NcTooltip>
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
                <img :src="screenshot.url" :alt="`Thumbnail ${index + 1}`" class="h-[68px] w-[120px] object-cover rounded" />
              </div>
            </div>
          </NcCarousel>
        </div>

        <NcTabs class="nc-template-tabs">
          <a-tab-pane key="overview" class="w-full">
            <template #tab>
              <div>{{ $t('general.overview') }}</div>
            </template>
            <div class="my-4" v-html="descriptionRendered"></div>
          </a-tab-pane>

          <a-tab-pane key="structure" class="w-full">
            <template #tab>
              <div>{{ $t('general.structure') }}</div>
            </template>
            <div class="my-4" v-html="structureRendered"></div>
          </a-tab-pane>
        </NcTabs>
        <div v-if="relatedTemplates.length">
          <div v-if="currentCategoryInfo?.sidebarImg" class="my-6">
            <img
              :src="currentCategoryInfo?.sidebarImg"
              :alt="currentCategoryInfo.sidebarTitle"
              class="w-12 h-12 object-contain"
            />
          </div>
          <h2 class="text-heading3 font-semibold mt-6">
            Other <span class="capitalize">{{ activeCategory === 'all-templates' ? '' : activeCategory }}</span> Templates
          </h2>
          <div class="text-body text-nc-content-grey">
            {{ currentCategoryInfo?.subtitle }}
          </div>
          <div class="grid grid-cols-1 mt-8 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <MarketplaceCard
              v-for="relatedTemplate of relatedTemplates"
              :key="relatedTemplate.Id"
              class="template-card"
              :title="relatedTemplate.Title"
              :description="relatedTemplate.Description"
              :image="relatedTemplate.Thumbnail"
              @click="openRelatedTemplate(relatedTemplate.Id)"
            />
          </div>
        </div>
        <div>
          <h2 class="text-heading3 font-semibold mt-16">{{ $t('objects.templates.browseByCategory') }}</h2>
          <div class="text-body text-nc-content-grey">{{ $t('objects.templates.browseByCategorySubtitle') }}.</div>
          <div class="grid grid-cols-[repeat(auto-fit,minmax(162px,1fr))] gap-6 my-8">
            <div
              v-for="item of browseByCategories"
              :key="item.key"
              class="template-category-item"
              @click="navigateToCategory(item.key)"
            >
              <img :src="item.sidebarImg" height="48" width="48" :alt="item.sidebarTitle" />
              <div class="text-nc-content-gray-subtle text-bodySmBold">{{ item.sidebarTitle }}</div>
            </div>
          </div>

          <NcButton type="secondary" size="small" @click="navigateToHome()">
            <div class="flex items-center gap-2">
              <GeneralIcon icon="ncArrowLeft" />
              <span class="text-bodySmBold">{{ $t('labels.backToHome') }}</span>
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
    @apply pt-2 pb-2.5 text-caption transition-none;

    &.ant-tabs-tab-active {
      @apply !text-captionBold;
    }
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

      &:not(.selected) {
        @apply border-1 border-transparent;
      }
    }
  }
}
</style>
