<script lang="ts" setup>
import { onUnmounted } from '@vue/runtime-core'
import { navigateTo } from '#imports'

definePageMeta({
  hideHeader: true,
  hasSidebar: true,
})

const router = useRouter()

const route = router.currentRoute

const { ncNavigateTo } = useGlobal()

const dialogOpen = ref(false)

const openDialogKey = ref<string>('')

const dataSourcesState = ref<string>('')

const dialogProjectId = ref<string>('')

function toggleDialog(value?: boolean, key?: string, dsState?: string, pId?: string) {
  dialogOpen.value = value ?? !dialogOpen.value
  openDialogKey.value = key || ''
  dataSourcesState.value = dsState || ''
  dialogProjectId.value = pId || ''
}

provide(ToggleDialogInj, toggleDialog)

const workspaceStore = useWorkspace()
const { populateWorkspace } = workspaceStore
const { collaborators, lastPopulatedWorkspaceId } = storeToRefs(workspaceStore)

const basesStore = useBases()

const tableStore = useTablesStore()

const navigating = ref(false)

const autoNavigateToProject = async ({ initial = false }: { initial: boolean }) => {
  const routeName = route.value.name as string

  if (routeName !== 'index-typeOrId' && routeName !== 'index') {
    return
  }

  if (navigating.value) return

  navigating.value = true

  // open first base if base list is not empty
  if (basesStore.basesList?.length) {
    const firstBase = basesStore.basesList[0]
    if (firstBase && firstBase.id) {
      if (initial) {
        await tableStore.loadProjectTables(firstBase.id)
        const firstTable = tableStore.baseTables.get(firstBase.id)?.[0]

        if (firstTable) {
          ncNavigateTo({
            workspaceId: firstBase.fk_workspace_id!,
            baseId: basesStore.basesList[0].id!,
            tableId: firstTable.id,
          })
        }
      } else {
        await basesStore.navigateToProject({
          workspaceId: firstBase.fk_workspace_id!,
          baseId: basesStore.basesList[0].id!,
        })
      }
    }
  }

  navigating.value = false
}

watch(
  () => workspaceStore.activeWorkspaceId,
  async (newId, oldId) => {
    if (newId === 'nc') {
      workspaceStore.setLoadingState(false)
      workspaceStore.isWorkspaceLoading = false
      return
    }

    if (newId === 'base') {
      workspaceStore.setLoadingState(false)
      basesStore.loadProjects()
      return
    }

    if (newId && oldId !== newId && lastPopulatedWorkspaceId.value !== newId) {
      basesStore.clearBases()
      collaborators.value = []
      // return
    }

    if (lastPopulatedWorkspaceId.value !== newId && (newId || workspaceStore.workspacesList.length)) {
      await populateWorkspace()

      if (!route.value.params.baseId && basesStore.basesList.length) {
        await autoNavigateToProject({ initial: oldId === undefined })
      }
    }

    if (lastPopulatedWorkspaceId.value === newId && !route.value.params.typeOrId) {
      await autoNavigateToProject({ initial: false })
    }
  },
  {
    immediate: true,
  },
)

const { deleteWorkspace: _deleteWorkspace, loadWorkspaces } = workspaceStore

// create a new sidebar state
const { toggle, toggleHasSidebar } = useSidebar('nc-left-sidebar', { hasSidebar: true, isOpen: true })

const { sharedBaseId } = useCopySharedBase()

const isDuplicateDlgOpen = ref(false)

let timerRef: any

onUnmounted(() => {
  if (timerRef) clearTimeout(timerRef)
})

onMounted(async () => {
  if (route.value.meta.public) return

  if (route.value.query?.continueAfterSignIn) {
    localStorage.removeItem('continueAfterSignIn')
    return await navigateTo(route.value.query.continueAfterSignIn as string)
  } else {
    const continueAfterSignIn = localStorage.getItem('continueAfterSignIn')

    if (continueAfterSignIn) {
      return await navigateTo({
        path: continueAfterSignIn,
        query: route.query,
      })
    }
  }

  toggle(true)
  toggleHasSidebar(true)

  // skip loading workspace and command palette for shared source
  if (!['base'].includes(route.value.params.typeOrId as string)) {
    await loadWorkspaces()
  }

  if (sharedBaseId.value) isDuplicateDlgOpen.value = true
})

const { $e, $poller } = useNuxtApp()

const DlgSharedBaseDuplicateOnOk = async (jobData: { id: string; base_id: string; workspace_id: string }) => {
  await populateWorkspace()

  $poller.subscribe(
    { id: jobData.id },
    async (data: {
      id: string
      status?: string
      data?: {
        error?: {
          message: string
        }
        message?: string
        result?: any
      }
    }) => {
      if (data.status !== 'close') {
        if (data.status === JobStatus.COMPLETED) {
          await ncNavigateTo({
            workspaceId: jobData.workspace_id,
            baseId: jobData.base_id,
          })
        } else if (data.status === JobStatus.FAILED) {
          message.error('Failed to duplicate project')
          await populateWorkspace()
        }
      }
    },
  )

  $e('a:base:duplicate-shared-base')
}
</script>

<template>
  <div>
    <NuxtLayout name="dashboard">
      <template #sidebar>
        <DashboardSidebar />
      </template>
      <template #content>
        <NuxtPage :transition="false" />
      </template>
    </NuxtLayout>
    <LazyDashboardSettingsModal
      v-model:model-value="dialogOpen"
      v-model:open-key="openDialogKey"
      v-model:data-sources-state="dataSourcesState"
      :base-id="dialogProjectId"
    />
    <DlgSharedBaseDuplicate v-model="isDuplicateDlgOpen" :shared-base-id="sharedBaseId" :on-ok="DlgSharedBaseDuplicateOnOk" />
  </div>
</template>

<style scoped></style>
