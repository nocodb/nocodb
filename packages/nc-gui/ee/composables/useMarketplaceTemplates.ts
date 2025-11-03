import salesImg from '~/assets/img/marketplace/sales.png'
import marketingImg from '~/assets/img/marketplace/marketing.png'
import hrImg from '~/assets/img/marketplace/human-resources.png'
import productManagementImg from '~/assets/img/marketplace/product-management.png'
import operationsImg from '~/assets/img/marketplace/operations.png'
import projectManagementImg from '~/assets/img/marketplace/project-management.png'
import healthcareImg from '~/assets/img/marketplace/healthcare.png'
import financeImg from '~/assets/img/marketplace/finance.png'
import educationImg from '~/assets/img/marketplace/education.png'
import manufacturingImg from '~/assets/img/marketplace/manufacturing.png'
import realEstateImg from '~/assets/img/marketplace/realestate.png'
import retailImg from '~/assets/img/marketplace/retail.png'
import transportationImg from '~/assets/img/marketplace/transportation.png'
import hospitalityImg from '~/assets/img/marketplace/hospitality.png'
import entertainmentImg from '~/assets/img/marketplace/entertainment.png'
import technologyImg from '~/assets/img/marketplace/technology.png'
import itAndOperationsImg from '~/assets/img/marketplace/it-and-operations.png'
import supplyChainManagementImg from '~/assets/img/marketplace/supply-chain-management.png'
import reusingImg from '~/assets/img/marketplace/reusing.png'
import productImg from '~/assets/img/marketplace/product.png'

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

/**
 * Key will be used in url so remove special characters and spaces
 * Value is select option value of `Use Case` column of published templates table
 */
export enum TemplateUseCasesEnum {
  sales = 'Sales',
  marketing = 'Marketing',
  operations = 'Operations',
  finance = 'Finance',
  'human-resources' = 'Human Resources',
  'product-management' = 'Product Management',
  'project-management' = 'Project Management',
  'supply-chain-management' = 'Supply chain management',
  'it-and-operations' = 'IT & Operations',
  'finance-and-legal' = 'Finance & Legal',
  'hr-and-recruiting' = 'HR & Recruiting',
  product = 'Product',
  reusing = 'Reusing',
}

/**
 * Key will be used in url so remove special characters and spaces
 * Value is select option value of `Industry` column of published templates table
 */
export enum TemplateIndustriesEnum {
  technology = 'Technology',
  healthcare = 'Healthcare',
  finance = 'Finance',
  education = 'Education',
  retail = 'Retail',
  manufacturing = 'Manufacturing',
  'real-estate' = 'Real Estate',
  transportation = 'Transportation',
  hospitality = 'Hospitality',
  entertainment = 'Entertainment',
}

export type TemplateCategoryType = 'all-templates' | keyof typeof TemplateUseCasesEnum | keyof typeof TemplateIndustriesEnum

export interface TemplateCategoryInfoItemType {
  order: number
  sidebarTitle: string
  title: string
  subtitle: string
  group?: string
  sidebarImg?: string
  value?: TemplateUseCasesEnum | TemplateIndustriesEnum
}

export enum TemplateCategoryGroup {
  Departments = 'departments',
  Industries = 'industries',
}

export const useMarketplaceTemplates = createSharedComposable((initialCategory: TemplateCategoryType = 'all-templates') => {
  const { $api } = useNuxtApp()

  const route = useRoute()
  const router = useRouter()

  const { t } = useI18n()

  const typeOrId = computed(() => route.params.typeOrId as string)

  const category = computed(() => route.params.category as TemplateCategoryType)

  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  const templates = ref<Template[]>([])

  const templatesMap = computed(() => {
    return templates.value.reduce((acc, template) => {
      acc[template.Id] = template
      return acc
    }, {} as Record<string, Template>)
  })

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

  const activeCategory = ref<TemplateCategoryType>(initialCategory as TemplateCategoryType)

  const categoryInfo: Record<TemplateCategoryType, TemplateCategoryInfoItemType> = {
    'all-templates': {
      order: 1,
      sidebarTitle: t('objects.templates.all-templates.sidebarTitle'),
      title: t('objects.templates.all-templates.title'),
      subtitle: t('objects.templates.all-templates.subtitle'),
    },
    // Departments
    'sales': {
      order: 2,
      sidebarTitle: t('objects.templates.sales.sidebarTitle'),
      title: t('objects.templates.sales.title'),
      subtitle: t('objects.templates.sales.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: salesImg,
      value: TemplateUseCasesEnum.sales,
    },
    'marketing': {
      order: 3,
      sidebarTitle: t('objects.templates.marketing.sidebarTitle'),
      title: t('objects.templates.marketing.title'),
      subtitle: t('objects.templates.marketing.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: marketingImg,
      value: TemplateUseCasesEnum.marketing,
    },
    'human-resources': {
      order: 4,
      sidebarTitle: t('objects.templates.human-resources.sidebarTitle'),
      title: t('objects.templates.human-resources.title'),
      subtitle: t('objects.templates.human-resources.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: hrImg,
      value: TemplateUseCasesEnum['human-resources'],
    },
    'product-management': {
      order: 5,
      sidebarTitle: t('objects.templates.product-management.sidebarTitle'),
      title: t('objects.templates.product-management.title'),
      subtitle: t('objects.templates.product-management.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: productManagementImg,
      value: TemplateUseCasesEnum['product-management'],
    },
    'operations': {
      order: 6,
      sidebarTitle: t('objects.templates.operations.sidebarTitle'),
      title: t('objects.templates.operations.title'),
      subtitle: t('objects.templates.operations.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: operationsImg,
      value: TemplateUseCasesEnum.operations,
    },
    'project-management': {
      order: 7,
      sidebarTitle: t('objects.templates.project-management.sidebarTitle'),
      title: t('objects.templates.project-management.title'),
      subtitle: t('objects.templates.project-management.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: projectManagementImg,
      value: TemplateUseCasesEnum['project-management'],
    },
    'supply-chain-management': {
      order: 8,
      sidebarTitle: t('objects.templates.supply-chain-management.sidebarTitle'),
      title: t('objects.templates.supply-chain-management.title'),
      subtitle: t('objects.templates.supply-chain-management.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: supplyChainManagementImg,
      value: TemplateUseCasesEnum['supply-chain-management'],
    },
    'it-and-operations': {
      order: 9,
      sidebarTitle: t('objects.templates.it-and-operations.sidebarTitle'),
      title: t('objects.templates.it-and-operations.title'),
      subtitle: t('objects.templates.it-and-operations.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: itAndOperationsImg,
      value: TemplateUseCasesEnum['it-and-operations'],
    },
    'finance-and-legal': {
      order: 10,
      sidebarTitle: t('objects.templates.finance-and-legal.sidebarTitle'),
      title: t('objects.templates.finance-and-legal.title'),
      subtitle: t('objects.templates.finance-and-legal.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: financeImg,
      value: TemplateUseCasesEnum['finance-and-legal'],
    },
    'hr-and-recruiting': {
      order: 11,
      sidebarTitle: t('objects.templates.hr-and-recruiting.sidebarTitle'),
      title: t('objects.templates.hr-and-recruiting.title'),
      subtitle: t('objects.templates.hr-and-recruiting.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: hrImg,
      value: TemplateUseCasesEnum['hr-and-recruiting'],
    },
    'product': {
      order: 12,
      sidebarTitle: t('objects.templates.product.sidebarTitle'),
      title: t('objects.templates.product.title'),
      subtitle: t('objects.templates.product.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: productImg,
      value: TemplateUseCasesEnum.product,
    },
    'reusing': {
      order: 13,
      sidebarTitle: t('objects.templates.reusing.sidebarTitle'),
      title: t('objects.templates.reusing.title'),
      subtitle: t('objects.templates.reusing.subtitle'),
      group: TemplateCategoryGroup.Departments,
      sidebarImg: reusingImg,
      value: TemplateUseCasesEnum.reusing,
    },

    // Industries
    'healthcare': {
      order: 8,
      sidebarTitle: t('objects.templates.healthcare.sidebarTitle'),
      title: t('objects.templates.healthcare.title'),
      subtitle: t('objects.templates.healthcare.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: healthcareImg,
      value: TemplateIndustriesEnum.healthcare,
    },
    'finance': {
      order: 9,
      sidebarTitle: t('objects.templates.finance.sidebarTitle'),
      title: t('objects.templates.finance.title'),
      subtitle: t('objects.templates.finance.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: financeImg,
      value: TemplateIndustriesEnum.finance,
    },
    'education': {
      order: 10,
      sidebarTitle: t('objects.templates.education.sidebarTitle'),
      title: t('objects.templates.education.title'),
      subtitle: t('objects.templates.education.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: educationImg,
      value: TemplateIndustriesEnum.education,
    },
    'manufacturing': {
      order: 11,
      sidebarTitle: t('objects.templates.manufacturing.sidebarTitle'),
      title: t('objects.templates.manufacturing.title'),
      subtitle: t('objects.templates.manufacturing.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: manufacturingImg,
      value: TemplateIndustriesEnum.manufacturing,
    },
    'real-estate': {
      order: 12,
      sidebarTitle: t('objects.templates.real-estate.sidebarTitle'),
      title: t('objects.templates.real-estate.title'),
      subtitle: t('objects.templates.real-estate.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: realEstateImg,
      value: TemplateIndustriesEnum['real-estate'],
    },
    'retail': {
      order: 13,
      sidebarTitle: t('objects.templates.retail.sidebarTitle'),
      title: t('objects.templates.retail.title'),
      subtitle: t('objects.templates.retail.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: retailImg,
      value: TemplateIndustriesEnum.retail,
    },
    'transportation': {
      order: 14,
      sidebarTitle: t('objects.templates.transportation.sidebarTitle'),
      title: t('objects.templates.transportation.title'),
      subtitle: t('objects.templates.transportation.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: transportationImg,
      value: TemplateIndustriesEnum.transportation,
    },
    'hospitality': {
      order: 15,
      sidebarTitle: t('objects.templates.hospitality.sidebarTitle'),
      title: t('objects.templates.hospitality.title'),
      subtitle: t('objects.templates.hospitality.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: hospitalityImg,
      value: TemplateIndustriesEnum.hospitality,
    },
    'entertainment': {
      order: 16,
      sidebarTitle: t('objects.templates.entertainment.sidebarTitle'),
      title: t('objects.templates.entertainment.title'),
      subtitle: t('objects.templates.entertainment.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: entertainmentImg,
      value: TemplateIndustriesEnum.entertainment,
    },
    'technology': {
      order: 17,
      sidebarTitle: t('objects.templates.technology.sidebarTitle'),
      title: t('objects.templates.technology.title'),
      subtitle: t('objects.templates.technology.subtitle'),
      group: TemplateCategoryGroup.Industries,
      sidebarImg: technologyImg,
      value: TemplateIndustriesEnum.technology,
    },
  }

  const currentCategoryInfo = computed(() => {
    return categoryInfo[activeCategory.value] || (categoryInfo['all-templates'] as TemplateCategoryInfoItemType)
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

    if (
      activeCategory.value === 'all-templates' ||
      !categoryInfo[activeCategory.value] ||
      !categoryInfo[activeCategory.value].value
    ) {
      return
    }

    if (categoryInfo[activeCategory.value].group === TemplateCategoryGroup.Departments) {
      query.usecase = categoryInfo[activeCategory.value].value as TemplateUseCasesEnum
    } else if (categoryInfo[activeCategory.value].group === TemplateCategoryGroup.Industries) {
      query.industry = categoryInfo[activeCategory.value].value as TemplateIndustriesEnum
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
        if (activeCategory.value !== 'all-templates') {
          activeCategory.value = 'all-templates'
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
    templatesMap,
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
