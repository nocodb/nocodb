import { defineStore } from 'pinia'
import type { LayoutType } from 'nocodb-sdk'
import { AggregateFnType, ButtonActionType } from 'nocodb-sdk'
import { computed, extractSdkResponseErrorMsg, message, navigateTo, ref, useNuxtApp, useRouter, useTabs, watch } from '#imports'
import type { LayoutSidebarNode } from '~~/lib'
import { TabType } from '~~/lib'

export const availableAggregateFunctions = [
  AggregateFnType.Sum,
  AggregateFnType.Avg,
  AggregateFnType.Count,
  AggregateFnType.Max,
  AggregateFnType.Min,
]

export const availableAggregateFunctionsWithIdAndTitle = availableAggregateFunctions.map((aggregateFn) => {
  return {
    id: aggregateFn.toString(),
    // TODO: use i18n here
    title: aggregateFn.toString(),
  }
})

export const useDashboardStore = defineStore('dashboardStore', () => {
  const router = useRouter()
  const route = $(router.currentRoute)

  const { $api } = useNuxtApp()

  /***
   *
   *
   * Refs
   *
   *
   */
  const isLayoutFetching = ref<Record<string, boolean>>({})

  const layoutsOfProjects = ref<Record<string, LayoutSidebarNode[]>>({})

  const openedLayoutSidebarNode = ref<LayoutSidebarNode | undefined>(undefined)

  const projectStore = useProject()
  const { project } = storeToRefs(projectStore)

  /***
   *
   *
   * Computed
   *
   */

  const openedProjectId = computed<string>(() => route.params.projectId as string)
  const openedLayoutId = computed<string | null>(() => route.params.layoutId as string)
  const _openedWorkspaceId = computed<string>(() => route.params.workspaceId as string)

  watch(
    openedLayoutId,
    async (newLayoutId, previousLayoutId) => {
      //
      // Helper functions/props
      //
      const __isLayoutNewButAlreadyOpen = openedLayoutSidebarNode.value?.new && openedLayoutSidebarNode.value.id === newLayoutId

      const __setPreviousLayoutdAsOld = () => {
        if (previousLayoutId) {
          const previousLayout = _findSingleLayout(layoutsOfProjects.value[openedProjectId.value], previousLayoutId)
          if (previousLayout?.new) {
            previousLayout.new = false
          }
        }
      }

      const __noNewLayoutId = newLayoutId == null

      if (__noNewLayoutId) {
        openedLayoutSidebarNode.value = undefined
        return
      }

      if (__isLayoutNewButAlreadyOpen) return

      __setPreviousLayoutdAsOld()

      openedLayoutSidebarNode.value = undefined

      const fetchedLayout: LayoutType | undefined = await _fetchSingleLayout({
        layoutId: newLayoutId,
        projectId: openedProjectId.value,
      })

      if (fetchedLayout == null) {
        console.error('fetchedLayout is undefined')
        return
      }

      if (fetchedLayout?.id !== openedLayoutId.value) {
        console.error('fetchedLayout.id !== openedLayoutId.value')
        return
      }

      const mandatorySidebarNodeProps = {
        isLeaf: true,
        key: fetchedLayout.id,
      }
      openedLayoutSidebarNode.value = { ...fetchedLayout, ...mandatorySidebarNodeProps }

      _addTabWhenNestedLayoutIsPopulated({
        projectId: openedProjectId.value,
      })
    },
    {
      immediate: true,
      deep: true,
    },
  )

  function dashboardProjectUrl(projectId: string, { completeUrl }: { completeUrl?: boolean; publicMode?: boolean } = {}) {
    const path = `/ws/${_openedWorkspaceId.value}/nc/${projectId}/layout`
    if (completeUrl) return `${window.location.origin}/#${path}`

    return path
  }

  async function fetchLayouts({ withoutLoading, projectId }: { projectId: string; withoutLoading?: boolean }) {
    if (!withoutLoading) isLayoutFetching.value[projectId] = true
    try {
      const fetchedLayouts = (await $api.dashboard.layoutList(projectId)).list

      layoutsOfProjects.value[projectId] = fetchedLayouts.map((layout) => {
        return {
          ...layout,
          isLeaf: true,
          key: layout.id!,
        }
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    } finally {
      if (!withoutLoading) isLayoutFetching.value[projectId] = false
    }
  }

  function _findSingleLayout(layouts: LayoutSidebarNode[], layoutId: string) {
    if (!layouts) {
      console.error('layouts is undefined:')
    }
    return layouts.find((p) => p.id === layoutId)
  }

  async function _fetchSingleLayout({ layoutId: layoutIdParam }: { layoutId?: string; projectId: string }) {
    const layoutId = layoutIdParam || openedLayoutId.value
    if (!layoutId) throw new Error('No Layout id or slug provided')

    try {
      return await $api.dashboard.layoutGet(project.value!.id!, layoutId)
    } catch (e) {
      console.log(e)
      return undefined
    }
  }

  async function _createLayout({ layoutTitle, projectId }: { layoutTitle: string; projectId: string }) {
    const layouts = layoutsOfProjects.value[projectId]
    try {
      const createdLayoutData = await $api.dashboard.layoutCreate(projectId, {
        title: layoutTitle,
        project_id: projectId,
      })

      layouts.push({
        ...createdLayoutData,
        isLeaf: false,
        key: createdLayoutData.id!,
        parentNodeId: undefined,
        children: [],
      })

      openedLayoutSidebarNode.value = _findSingleLayout(layouts, createdLayoutData.id!)
      await navigateTo(layoutUrl({ id: createdLayoutData.id!, projectId: projectId! }))

      const openedTabs = layoutsOfProjects.value[projectId].map((p: any) => p.id)
      if (!openedTabs.includes(createdLayoutData.id!)) {
        openedTabs.push(createdLayoutData.id!)
      }

      const { addTab } = useTabs()

      addTab({
        id: createdLayoutData.id!,
        title: createdLayoutData.title || 'NO TITLE',
        type: TabType.LAYOUT,
        projectId,
      })
    } catch (e) {
      console.error(e)
      message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }

  const addNewLayout = async ({ projectId }: { projectId: string }) => {
    const layouts = layoutsOfProjects.value[projectId]
    if (!Array.isArray(layouts)) {
      console.error('Layouts not defined or not an array')
      message.error('Error while creating Layout')
      return
    }
    let dummyTitle = 'Layout'
    let conflictCount = 0
    while (layouts?.find((layout) => layout.title === dummyTitle)) {
      conflictCount++
      dummyTitle = `Layout ${conflictCount}`
    }

    await _createLayout({
      projectId,
      layoutTitle: dummyTitle,
    })
  }

  const openLayout = async ({ layout, projectId }: { layout: LayoutSidebarNode; projectId: string }) => {
    const url = layoutUrl({ id: layout.id!, projectId })

    await navigateTo(url)
  }

  async function _addTabWhenNestedLayoutIsPopulated({ projectId }: { projectId: string }) {
    const layoutsOfProject = layoutsOfProjects.value[projectId]
    if (!layoutsOfProject) {
      setTimeout(() => {
        _addTabWhenNestedLayoutIsPopulated({ projectId })
      }, 100)
      return
    }

    if (!openedLayoutId.value) return

    const { addTab } = useTabs()

    addTab({
      id: openedLayoutSidebarNode.value!.id!,
      title: openedLayoutSidebarNode.value!.title || 'NO TITLE',
      type: TabType.LAYOUT,
      projectId: openedProjectId.value,
    })
  }

  function layoutUrl({ projectId, id, completeUrl }: { projectId: string; id: string; completeUrl?: boolean }) {
    projectId = projectId || openedProjectId.value

    const url = `/ws/${_openedWorkspaceId.value}/nc/${projectId}/layout/${id}`

    return completeUrl ? `${window.location.origin}/#${url}` : url
  }

  return {
    openedLayoutSidebarNode,
    layoutsOfProjects: readonly(layoutsOfProjects),
    fetchLayouts,
    openLayout,
    addNewLayout,
    dashboardProjectUrl,
  }
})
