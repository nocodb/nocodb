<script setup lang="ts">
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkRehype from 'remark-rehype'
import rehypeSanitize from 'rehype-sanitize'
import rehypeStringify from 'rehype-stringify'
import type { CarouselApi } from '~/components/nc/Carousel/interface'

const route = useRoute()
const router = useRouter()

const workspaceId = computed(() => route.params.typeOrId as string)
const templateId = computed(() => route.params.templateId as string)
const typeOrId = computed(() => route.params.typeOrId)

const { categoryInfo, activeCategory, currentCategoryInfo, templatesMap, getTemplateById } =
  useMarketplaceTemplates('all-templates')

const {
  sharedBaseId,
  isLoading: isCopyingTemplate,
  options,
  isUseThisTemplate,
  isDuplicateDlgOpen,
  selectedWorkspace,
  templateName,
} = useCopySharedBase()

const template = ref<Template | null>(null)

const isLoading = ref<Boolean>(true)
const error = ref<string | null>(null)

const isIframeLoaded = ref(false)

const carouselApi = ref<CarouselApi>()
const currentSlideIndex = ref(0)

const templateSharedBaseUrl = computed(() => {
  return template.value?.['Shared Base Url'] as string
})

const isValidTemplateSharedBaseUrl = computed(() => {
  try {
    const newUrl = new URL(templateSharedBaseUrl.value)
    return !!newUrl
  } catch (e) {
    return false
  }
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
  isLoading.value = true
  error.value = null

  try {
    template.value = await getTemplateById(templateId.value)

    if (template.value) {
      router.currentRoute.value.meta.templateName = template.value.Title
    }
  } catch (err) {
    console.error('Failed to fetch template details:', err)
    error.value = 'Failed to load template details'
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  if (templateId.value && templatesMap.value[templateId.value]) {
    template.value = templatesMap.value[templateId.value] as Template
    isLoading.value = false

    if (template.value) {
      router.currentRoute.value.meta.templateName = template.value.Title
    }
  } else {
    fetchTemplateDetails()
  }
})

const openRelatedTemplate = (templateId) => {
  router.push(`/${typeOrId.value}/templates/${activeCategory.value}/${templateId}`)
}

const descriptionRendered = computedAsync(async () => {
  return await unified()
    .use(remarkParse)
    .use(remarkRehype)
    .use(rehypeSanitize)
    .use(rehypeStringify)
    .process(template.value?.Description ?? '')
})

const navigateToCategory = (category: string) => {
  activeCategory.value = category
  router.push(`/${typeOrId.value}/templates/${category}`)
}

const navigateToHome = () => {
  router.push(`/${typeOrId.value}/templates`)
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

const scrollToNextSlide = () => {
  if (currentSlideIndex.value === screenshots.value.length - 1) return scrollToSlide(0)

  if (carouselApi.value && carouselApi.value.canScrollNext()) {
    carouselApi.value.scrollNext()
  }
}

const scrollToPreviousSlide = () => {
  if (currentSlideIndex.value === 0) return scrollToSlide(screenshots.value.length - 1)

  if (carouselApi.value && carouselApi.value.canScrollPrev()) {
    carouselApi.value.scrollPrev()
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

  templateName.value = template.value?.Title || ''

  sharedBaseId.value = resolvedRoute.params.baseId as string

  selectedWorkspace.value = workspaceId.value!

  isDuplicateDlgOpen.value = true
}

const onIframeLoad = () => {
  isIframeLoaded.value = true
}
</script>

<template>
  <div class="flex-1 flex flex-col">
    <div>
      <div v-if="isLoading" class="flex justify-center items-center h-64 pt-6">
        <GeneralLoader size="large" />
      </div>

      <div v-else-if="error || !template" class="flex flex-col items-center justify-center py-12">
        <div class="text-nc-content-gray-subtle2 text-lg">{{ error || $t('msg.error.failedToLoadTemplateDetails') }}</div>
        <NcButton class="mt-4" size="small" type="text" @click="fetchTemplateDetails">{{ $t('general.retry') }}</NcButton>
      </div>

      <div v-else-if="template" class="template-detail mb-10">
        <div class="flex items-center gap-3 mb-4 pb-2 pt-6 sticky top-0 bg-nc-bg-default z-10 -mx-6 px-6">
          <div class="text-nc-content-gray text-heading3 font-semibold flex-1">
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

        <div v-if="screenshots.length" class="mb-8">
          <NcCarousel class="w-full template-carousel" @init-api="onCarouselInit">
            <NcCarouselContent>
              <NcCarouselItem v-for="(screenshot, index) in screenshots" :key="index">
                <div
                  class="aspect-video max-w-full max-h-[calc(min(100dvh_-_250px,600px))] flex items-center justify-center mb-6 mt-3"
                >
                  <img
                    :src="screenshot.url"
                    :alt="screenshot.title || `Screenshot ${index + 1}`"
                    class="max-h-full max-w-full h-[calc(min(100dvh_-_250px,600px))] object-contain rounded-lg shadow-lg"
                  />
                </div>
              </NcCarouselItem>
            </NcCarouselContent>

            <div v-if="screenshots.length > 1" class="flex items-center justify-center gap-2 py-2">
              <NcButton type="secondary" size="small" class="mr-2 !rounded-full" @click="scrollToPreviousSlide">
                <GeneralIcon icon="arrowLeft" class="w-4 h-4" />
              </NcButton>

              <div
                v-for="(_screenshot, index) in screenshots"
                :key="index"
                class="thumbnail-wrapper cursor-pointer transition-all"
                :class="{ selected: currentSlideIndex === index }"
                @click="scrollToSlide(index)"
              >
                <div class="w-3 h-3 rounded-full bg-nc-bg-gray-medium"></div>
              </div>

              <NcButton type="secondary" size="small" class="ml-2 !rounded-full" @click="scrollToNextSlide">
                <GeneralIcon icon="arrowRight" class="w-4 h-4" />
              </NcButton>
            </div>
          </NcCarousel>
        </div>

        <NcTabs class="nc-template-tabs">
          <a-tab-pane key="overview" class="w-full">
            <template #tab>
              <div>{{ $t('general.overview') }}</div>
            </template>
            <div class="mb-4" v-html="descriptionRendered"></div>
          </a-tab-pane>

          <a-tab-pane key="structure" class="w-full">
            <template #tab>
              <div>{{ $t('general.structure') }}</div>
            </template>
            <div class="mb-4 nc-template-shared-base-iframe">
              <div v-if="isValidTemplateSharedBaseUrl" class="nc-template-iframe-container">
                <div v-if="!isIframeLoaded" class="inset-0 absolute z-10 flex items-center justify-center">
                  <a-spin size="large" />
                </div>

                <iframe
                  ref="iframeRef"
                  :src="templateSharedBaseUrl"
                  allowfullscreen
                  allow="fullscreen"
                  class="w-full h-full border-0"
                  @load="onIframeLoad"
                />
              </div>
            </div>
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
          <div class="text-body text-nc-content-gray">
            {{ currentCategoryInfo?.subtitle }}
          </div>
          <div class="grid grid-cols-1 mt-8 md:grid-cols-2 lg:grid-cols-3 3xl:grid-cols-4 gap-6">
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
          <h2 class="text-heading3 font-semibold mt-12">{{ $t('objects.templates.browseByCategory') }}</h2>
          <div class="text-body text-nc-content-gray">{{ $t('objects.templates.browseByCategorySubtitle') }}.</div>
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
      @apply opacity-70 transition-all rounded-full overflow-hidden;

      img {
        @apply transition-all duration-200;
      }

      &:hover {
        @apply opacity-90;
      }

      &.selected {
        @apply opacity-100 shadow-md border-1 border-nc-border-brand;
        box-shadow: 0px 0px 0px 2px rgba(51, 102, 255, 0.24);
      }

      &:not(.selected) {
        @apply border-1 border-transparent;
        box-shadow: 0px 0px 0px 2px transparent;
      }
    }
  }

  .nc-template-iframe-container {
    @apply border-1 border-nc-border-gray-medium rounded-xl overflow-hidden aspect-video w-full max-h-[calc(100dvh_-_200px)] flex group relative;

    iframe {
      @apply bg-nc-bg-default;
    }
  }
}
</style>
