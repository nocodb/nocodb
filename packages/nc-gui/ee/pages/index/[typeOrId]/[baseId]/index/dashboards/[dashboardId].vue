<script setup lang="ts">
import type { NavigationGuardNext, RouteLocationNormalizedLoadedGeneric } from 'vue-router'
import { useTitle } from '@vueuse/core'

const { t } = useI18n()

const dashboardStore = useDashboardStore()

const baseStore = useBases()

const { openedProject } = storeToRefs(baseStore)

const { isEditingDashboard, activeDashboard, activeBaseDashboards, dashboards } = storeToRefs(dashboardStore)

const confirmUnsavedChangesBeforeLeaving = (
  to: RouteLocationNormalizedLoadedGeneric,
  from: RouteLocationNormalizedLoadedGeneric,
  next: NavigationGuardNext,
) => {
  if (!isEditingDashboard.value) {
    next()
    return
  }

  const targetDashboardId = to.params.dashboardId as string

  const baseDashboards = dashboards.value.get(openedProject.value?.id)

  const fromDashboardId = from.params.dashboardId as string

  const fromDashboard = activeBaseDashboards.value.find((d) => d.id === fromDashboardId)

  if ((!targetDashboardId && !baseDashboards?.length) || !fromDashboard) {
    next()
    return
  }

  const targetDashboard = activeBaseDashboards.value.find((d) => d.id === targetDashboardId) as any
  if (targetDashboard?.___is_new) {
    targetDashboard.___is_new = false
    const baseDashboards = dashboards.value.get(targetDashboard?.base_id)
    const index = baseDashboards?.findIndex((d) => d.id === targetDashboardId)
    if (!index || index === -1 || !baseDashboards) return
    baseDashboards[index] = targetDashboard
    dashboards.value.set(targetDashboard?.base_id, baseDashboards)
    next()
    isEditingDashboard.value = true
    return
  }

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('NcModalConfirm'), {
    'visible': isOpen,
    'title': t('msg.info.leaveWithoutFinishing'),
    'content': t('msg.info.leaveWithoutFinishingConfirmation'),
    'okText': t('labels.keepEditing'),
    'cancelText': t('labels.leave'),
    'onCancel': () => {
      isEditingDashboard.value = false
      isOpen.value = false
      close(1000)
      next()
    },
    'onOk': () => {
      isOpen.value = false
      close(1000)
      next(false) // Cancel navigation
    },
    'update:visible': (visible: boolean) => {
      if (!visible) {
        close(1000)
        next(false) // Cancel navigation if dialog is closed without action
      }
    },
    'showIcon': false,
    'keyboard': false,
    'maskClosable': false,
  })
}

onBeforeRouteUpdate((to, from, next) => {
  confirmUnsavedChangesBeforeLeaving(to, from, next)
})

onBeforeRouteLeave((to, from, next) => {
  confirmUnsavedChangesBeforeLeaving(to, from, next)
})

watch(
  () => activeDashboard.value?.title,
  (title) => {
    if (!title) return

    const capitalizedTitle = `${title.charAt(0).toUpperCase()}${title.slice(1)} | ${openedProject.value?.title}`

    useTitle(capitalizedTitle)
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col h-full">
    <SmartsheetTopbar />
    <div style="height: calc(100dvh - var(--topbar-height))">
      <LazySmartsheetDashboard />
    </div>
  </div>
</template>

<style scoped lang="scss"></style>
