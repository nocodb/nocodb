<script setup lang="ts">
definePageMeta({
  key: 'true',
  hideHeader: true,
  layout: 'docs',
  public: true,
  requiresAuth: false,
})

const baseStore = useBase()

const { base } = storeToRefs(baseStore)

const route = useRoute()

const docStore = useDocStore()
const { fetchNestedPages, navigateToFirstPage } = docStore
const { isNestedFetchErrored, isPageErrored, openedProjectId, openedPageId, flattenedNestedPages, isNestedPublicPage } =
  storeToRefs(docStore)

const isFetching = ref(true)
const isSidebarOpen = ref(false)

const isErrored = computed(() => {
  return isNestedFetchErrored.value || isPageErrored.value
})

onMounted(async () => {
  isFetching.value = true

  await fetchNestedPages({
    baseId: openedProjectId.value as string,
  })

  isFetching.value = false
})

watch(
  [base, isNestedPublicPage],
  () => {
    let meta = {}
    try {
      if (typeof base.value?.meta === 'string') {
        meta = JSON.parse(base.value?.meta ?? '{}')
      }
    } catch (e) {
      console.error(e)
    }

    if ((meta as any).isPublic) {
      isSidebarOpen.value = true
      navigateToFirstPage()
    }

    if (isNestedPublicPage.value) {
      isSidebarOpen.value = true
    } else {
      isSidebarOpen.value = false
    }
  },
  {
    deep: true,
  },
)

watch(
  () => flattenedNestedPages.value?.length ?? 0,
  () => {
    if (flattenedNestedPages.value?.length > 1) {
      isSidebarOpen.value = true
    }

    if (flattenedNestedPages.value?.length > 0 && !openedPageId.value) {
      navigateToFirstPage()
    }
  },
)
</script>

<template>
  <NuxtLayout id="content" :key="route.params.baseId as string" name="dashboard">
    <template #sidebar>
      <DocsSideBar v-if="isSidebarOpen && !isFetching" :base="base" />
    </template>
    <template #content>
      <div class="flex flex-row">
        <div v-if="isErrored">
          <DocsError />
        </div>
        <template v-else>
          <DocsPageView />
        </template>
      </div>
    </template>
  </NuxtLayout>
</template>
