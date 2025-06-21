// Template interface
export interface Template {
  'Id': number
  'Title': string
  'Description': string
  'Use Case': string
  'Shared Base Url': string
  'Industry': string | null
  'Thumbnail': string | null
}

// Create a shared composable that can be reused across components
export const useMarketplaceTemplates = createSharedComposable((initialCategory = 'marketplace') => {
  const { $api } = useNuxtApp()
  const route = useRoute()
  const router = useRouter()
  const typeOrId = computed(() => route.params.typeOrId as string)

  // Get active workspace ID from store
  const { activeWorkspaceId } = storeToRefs(useWorkspace())

  // Template data and loading state
  const templates = ref<Template[]>([])
  const isLoading = ref(false)
  const hasMore = ref(true)
  const page = ref(1)
  const perPage = ref(12)

  // Query parameters
  const query = reactive({
    search: '',
    industry: null as string | null,
    usecase: null as string | null,
    page: 1,
    per_page: perPage.value,
  })

  // Active category state
  const activeCategory = ref(initialCategory)

  // Category information
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

  // Get current category info
  const currentCategoryInfo = computed(() => {
    return categoryInfo[activeCategory.value] || categoryInfo.marketplace
  })

  // Load templates from API
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
      // Use the actual API to fetch template details
      const template = await $api.internal.getOperation(activeWorkspaceId.value, 'NO_SCOPE', {
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

  // Setup intersection observer for infinite scroll
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
      { threshold: 0.1, rootMargin: '500px' },
    )

    if (loadingTrigger.value) {
      observer.observe(loadingTrigger.value)
    }
  }

  // Apply category-specific filters
  const applyCategoryFilters = () => {
    // Reset filters
    query.usecase = null
    query.industry = null

    // Skip for marketplace as it doesn't need filters
    if (activeCategory.value === 'marketplace') return

    // Apply department filters
    const departments = ['sales', 'marketing', 'hr', 'product-management', 'operations', 'project-management']
    if (departments.includes(activeCategory.value)) {
      query.usecase = activeCategory.value
      return
    }

    // Apply industry filters
    const industries = ['healthcare', 'finance', 'education', 'manufacturing', 'real-estate', 'retail']
    if (industries.includes(activeCategory.value)) {
      query.industry = activeCategory.value
    }
  }
  // Setup and cleanup
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
