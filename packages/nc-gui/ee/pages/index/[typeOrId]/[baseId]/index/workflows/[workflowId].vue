<script setup lang="ts">
import type { NavigationGuardNext, RouteLocationNormalizedLoadedGeneric } from 'vue-router'
import { useProvideWorkflow } from '~/composables/useWorkflow'

const { t } = useI18n()

const { $e } = useNuxtApp()

const workflowStore = useWorkflowStore()

const { activeWorkflow, activeWorkflowHasDraftChanges } = storeToRefs(workflowStore)

useProvideWorkflow(activeWorkflow)

const confirmUnpublishedChangesBeforeLeaving = (
  _to: RouteLocationNormalizedLoadedGeneric,
  _from: RouteLocationNormalizedLoadedGeneric,
  next: NavigationGuardNext,
) => {
  if (!activeWorkflowHasDraftChanges.value) {
    next()
    return
  }

  const isOpen = ref(true)

  const { close } = useDialog(resolveComponent('NcModalConfirm'), {
    'visible': isOpen,
    'title': t('msg.info.leaveWithoutFinishing'),
    'content': t('msg.info.workflowHasUnpublishedChanges'),
    'okText': t('labels.keepEditing'),
    'cancelText': t('labels.leave'),
    'onCancel': () => {
      $e('c:workflow:unpublished-draft:leave')
      isOpen.value = false
      close(1000)
      next()
    },
    'onOk': () => {
      $e('c:workflow:unpublished-draft:keep-editing')
      isOpen.value = false
      close(1000)
      next(false)
    },
    'update:visible': (visible: boolean) => {
      if (!visible) {
        close(1000)
        next(false)
      }
    },
    'showIcon': false,
    'keyboard': false,
    'maskClosable': false,
  })
}

onBeforeRouteUpdate((to, from, next) => {
  confirmUnpublishedChangesBeforeLeaving(to, from, next)
})

onBeforeRouteLeave((to, from, next) => {
  confirmUnpublishedChangesBeforeLeaving(to, from, next)
})
</script>

<template>
  <div class="flex flex-col h-full">
    <SmartsheetTopbar />
    <div style="height: calc(100svh - var(--topbar-height))">
      <SmartsheetWorkflow />
    </div>
  </div>
</template>
