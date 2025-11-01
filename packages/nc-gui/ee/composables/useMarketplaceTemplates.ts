import salesImg from '~/assets/img/marketplace/sales.png'
import marketingImg from '~/assets/img/marketplace/marketing.png'
import hrImg from '~/assets/img/marketplace/human-resources.png'
import productManagementImg from '~/assets/img/marketplace/product-management.png'
import operationsImg from '~/assets/img/marketplace/operations.png'
import projectManagementImg from '~/assets/img/marketplace/product-management.png'
import healthcareImg from '~/assets/img/marketplace/healthcare.png'
import financeImg from '~/assets/img/marketplace/finance.png'
import educationImg from '~/assets/img/marketplace/education.png'
import manufacturingImg from '~/assets/img/marketplace/manufacturing.png'
import realEstateImg from '~/assets/img/marketplace/realestate.png'
import retailImg from '~/assets/img/marketplace/retail.png'

export interface Template {
  'Id': number
  'Title': string
  'Description': string
  'Use Case': string
  'Shared Base Url': string
  'Template Status'?: string
  'Industry': string | null
  'ERD'?: string
  'Details'?: string
  'Thumbnail': string | null
  'Screenshots'?: string[]
  'Related Templates'?: Template[]
}

export interface TemplateCategoryInfoItemType {
  order: number
  sidebarTitle: string
  title: string
  subtitle: string
  group?: string
  sidebarImg?: string
}

export enum TemplateCategoryGroup {
  Departments = 'departments',
  Industries = 'industries',
}

export const useMarketplaceTemplates = createSharedComposable((initialCategory = 'marketplace') => {
  const { $api } = useNuxtApp()

  const route = useRoute()
  const router = useRouter()

  const { t } = useI18n()

  const typeOrId = computed(() => route.params.typeOrId as string)

  const category = computed(() => route.params.category as string)

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const templates = ref<Template[]>([])
  const isLoading = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const perPage = ref(12)

  const query = reactive({
    search: '',
    industry: null as string | null,
    usecase: null as string | null,
    page: 1,
    per_page: perPage.value,
  })

  const activeCategory = ref(initialCategory)

  const categoryInfo: Record<string, TemplateCategoryInfoItemType> = {
    'marketplace': {
      order: 1,
      sidebarTitle: t('objects.templates.marketplace.sidebarTitle'),
      title: t('objects.templates.marketplace.title'),
      subtitle: t('objects.templates.marketplace.subtitle'),
    },
    // Departments
    'sales': {
      order: 2,
      sidebarTitle: t('objects.templates.sales.sidebarTitle'),
      title: t('objects.templates.sales.title'),
      subtitle: t('objects.templates.sales.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: salesImg,
    },
    'marketing': {
      order: 3,
      sidebarTitle: t('objects.templates.marketing.sidebarTitle'),
      title: t('objects.templates.marketing.title'),
      subtitle: t('objects.templates.marketing.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: marketingImg,
    },
    'hr': {
      order: 4,
      sidebarTitle: t('objects.templates.hr.sidebarTitle'),
      title: t('objects.templates.hr.title'),
      subtitle: t('objects.templates.hr.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: hrImg,
    },
    'product-management': {
      order: 5,
      sidebarTitle: t('objects.templates.product-management.sidebarTitle'),
      title: t('objects.templates.product-management.title'),
      subtitle: t('objects.templates.product-management.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: productManagementImg,
    },
    'operations': {
      order: 6,
      sidebarTitle: t('objects.templates.operations.sidebarTitle'),
      title: t('objects.templates.operations.title'),
      subtitle: t('objects.templates.operations.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: operationsImg,
    },
    'project-management': {
      order: 7,
      sidebarTitle: t('objects.templates.project-management.sidebarTitle'),
      title: t('objects.templates.project-management.title'),
      subtitle: t('objects.templates.project-management.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: projectManagementImg,
    },
    // Industries
    'healthcare': {
      order: 8,
      sidebarTitle: t('objects.templates.healthcare.sidebarTitle'),
      title: t('objects.templates.healthcare.title'),
      subtitle: t('objects.templates.healthcare.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: healthcareImg,
    },
    'finance': {
      order: 9,
      sidebarTitle: t('objects.templates.finance.sidebarTitle'),
      title: t('objects.templates.finance.title'),
      subtitle: t('objects.templates.finance.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: financeImg,
    },
    'education': {
      order: 10,
      sidebarTitle: t('objects.templates.education.sidebarTitle'),
      title: t('objects.templates.education.title'),
      subtitle: t('objects.templates.education.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: educationImg,
    },
    'manufacturing': {
      order: 11,
      sidebarTitle: t('objects.templates.manufacturing.sidebarTitle'),
      title: t('objects.templates.manufacturing.title'),
      subtitle: t('objects.templates.manufacturing.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: manufacturingImg,
    },
    'real-estate': {
      order: 12,
      sidebarTitle: t('objects.templates.real-estate.sidebarTitle'),
      title: t('objects.templates.real-estate.title'),
      subtitle: t('objects.templates.real-estate.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: realEstateImg,
    },
    'retail': {
      order: 13,
      sidebarTitle: t('objects.templates.retail.sidebarTitle'),
      title: t('objects.templates.retail.title'),
      subtitle: t('objects.templates.retail.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: retailImg,
    },
  }

  const currentCategoryInfo = computed(() => {
    return categoryInfo[activeCategory.value] || (categoryInfo.marketplace as TemplateCategoryInfoItemType)
  })

  const loadTemplates = async (reset = false) => {
    if (!activeWorkspaceId.value) return

    if (reset) {
      templates.value = []
      page.value = 1
      query.page = 1
      hasMore.value = true
    }

    if (isLoading.value || !hasMore.value) return

    isLoading.value = true

    try {
      const res = await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
        operation: 'templates',
        page: page.value,
        per_page: perPage.value,
        ...query,
      })

      if (Array.isArray(res)) {
        if (reset) {
          templates.value = res as Template[]
        } else {
          templates.value = [...templates.value, ...(res as Template[])]
        }
        hasMore.value = res.length === perPage.value
      }

      // Update pagination
      if (hasMore.value) {
        page.value++
        query.page = page.value
      }
    } catch (error) {
      console.error('Error loading templates:', error)
    } finally {
      isLoading.value = false
    }
  }

  // Get template by ID
  const getTemplateById = async (id: string | string[]) => {
    if (!activeWorkspaceId.value) return null

    isLoading.value = true

    try {
      const template = await $api.internal.getOperation(activeWorkspaceId.value, NO_SCOPE, {
        operation: 'template',
        id,
      })

      return template
    } catch (error) {
      console.error('Error fetching template:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  // Infinite scroll setup
  const templateContainer = ref(null)
  const loadingTrigger = ref(null)
  let observer: IntersectionObserver | null = null

  // Template navigation
  const openTemplate = (template: Template) => {
    if (template && template.Id) {
      router.push(`/${typeOrId.value}/marketplace/template/${template.Id}`)
    } else if (template && template['Shared Base Url']) {
      window.open(template['Shared Base Url'], '_blank')
    }
  }

  const setupObserver = () => {
    if (observer) {
      observer.disconnect()
    }

    observer = new IntersectionObserver(
      useThrottleFn((entries) => {
        if (entries[0].isIntersecting && !isLoading.value && hasMore.value) {
          loadTemplates()
        }
      }, 1000),
      { threshold: 0.1, rootMargin: '300px' },
    )

    if (loadingTrigger.value) {
      observer.observe(loadingTrigger.value)
    }
  }

  watch(
    () => loadingTrigger.value,
    (newVal) => {
      if (newVal && observer) {
        observer.disconnect()
        observer.observe(newVal)
      }
    },
  )

  const applyCategoryFilters = () => {
    query.usecase = null
    query.industry = null

    if (activeCategory.value === 'marketplace') return

    const departments = ['sales', 'marketing', 'hr', 'product-management', 'operations', 'project-management']
    if (departments.includes(activeCategory.value)) {
      query.usecase = activeCategory.value
      return
    }

    const industries = ['healthcare', 'finance', 'education', 'manufacturing', 'real-estate', 'retail']
    if (industries.includes(activeCategory.value)) {
      query.industry = activeCategory.value
    }
  }
  watch(
    () => ({ search: query.search, industry: query.industry, usecase: query.usecase }),
    () => {
      loadTemplates(true)
    },
    { deep: true },
  )

  watch(activeCategory, () => {
    applyCategoryFilters()
    loadTemplates(true)
  })

  onMounted(() => {
    applyCategoryFilters()
    loadTemplates(true)
    setupObserver()
  })

  onBeforeUnmount(() => {
    if (observer) {
      observer.disconnect()
      observer = null
    }
  })

  /**
   * Watch category query params so that we can update the active category ref based on url params
   */
  watch(
    category,
    (newValue) => {
      if (!newValue) {
        if (activeCategory.value !== 'marketplace') {
          activeCategory.value = 'marketplace'
        }

        return
      }

      if (!categoryInfo[newValue] || activeCategory.value === newValue) return

      activeCategory.value = newValue
    },
    {
      immediate: true,
      flush: 'post',
    },
  )

  return {
    templates,
    isLoading,
    hasMore,
    loadTemplates,
    getTemplateById,
    activeCategory,
    categoryInfo,
    currentCategoryInfo,
    templateContainer,
    loadingTrigger,
    openTemplate,
    setupObserver,
    query,
    typeOrId,
    route,
    router,
  }
})
