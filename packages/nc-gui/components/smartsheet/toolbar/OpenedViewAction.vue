<script lang="ts" setup>
const { activeTable } = storeToRefs(useTablesStore())

const { isMobileMode } = useGlobal()

const { isSharedBase, base } = storeToRefs(useBase())

const { sharedView } = useSharedView()

const { t } = useI18n()

const { $api, $e } = useNuxtApp()

const { refreshCommandPalette } = useCommandPalette()

const { activeView, views, viewsByTable } = storeToRefs(useViewsStore())
const { loadViews, removeFromRecentViews } = useViewsStore()

const { navigateToTable } = useTablesStore()

const isDropdownOpen = ref(false)

const isViewIdCopied = ref(false)

const isRenaming = ref(false)

const renameInputDom = ref()

const viewRenameTitle = ref('')

const error = ref<string | undefined>()

const updateDescription = async () => {
  if (!activeView.value || !activeView.value.id) return

  $e('c:view:description')

  const isOpen = ref(true)

  isDropdownOpen.value = false

  const { close } = useDialog(resolveComponent('DlgViewDescriptionUpdate'), {
    'modelValue': isOpen,
    'view': activeView.value,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}

const onRenameMenuClick = () => {
  isRenaming.value = true
  isDropdownOpen.value = false
  viewRenameTitle.value = activeView.value!.title

  setTimeout(() => {
    renameInputDom.value.focus()
  })
}

watch(renameInputDom, () => {
  renameInputDom.value?.focus()
})

const onRenameBlur = async () => {
  if (validate()) {
    activeView.value!.title = viewRenameTitle.value
    isRenaming.value = false
    error.value = undefined

    await $api.dbView.update(activeView.value!.id!, {
      title: viewRenameTitle.value,
    })
  } else {
    renameInputDom.value?.focus()
  }
}

/** validate view title */
function validate() {
  if (!viewRenameTitle.value || viewRenameTitle.value.trim().length < 0) {
    error.value = t('msg.error.viewNameRequired')

    return false
  }

  if (viewRenameTitle.value.trim().length > 255) {
    error.value = t('msg.error.nameMaxLength256')

    return false
  }

  if (views.value.some((v) => v.title === viewRenameTitle.value && v.id !== activeView.value!.id)) {
    error.value = t('msg.error.viewNameDuplicate')
    return false
  }

  return true
}

watch(viewRenameTitle, () => {
  if (error.value) {
    error.value = undefined
  }
})

watch(isDropdownOpen, () => {
  setTimeout(() => {
    isViewIdCopied.value = false
  }, 250)
})

const resetViewRename = () => {
  viewRenameTitle.value = activeView.value!.title
  isRenaming.value = false
}

function openDeleteDialog() {
  const isOpen = ref(true)
  isDropdownOpen.value = false

  const { close } = useDialog(resolveComponent('DlgViewDelete'), {
    'modelValue': isOpen,
    'view': activeView.value,
    'onUpdate:modelValue': closeDialog,
    'onDeleted': async () => {
      closeDialog()

      removeFromRecentViews({ viewId: activeView.value!.id, tableId: activeView.value!.fk_model_id, baseId: base.value.id })
      refreshCommandPalette()
      if (activeView.value?.id === activeView.value!.id) {
        navigateToTable({
          tableId: activeTable.value!.id!,
          baseId: base.value.id!,
        })
      }

      await loadViews({
        tableId: activeTable.value!.id!,
        force: true,
      })

      const activeNonDefaultViews = viewsByTable.value.get(activeTable!.value!.id!)?.filter((v) => !v.is_default) ?? []

      activeTable!.value!.meta = {
        ...(activeTable!.value!.meta as object),
        hasNonDefaultViews: activeNonDefaultViews.length > 1,
      }
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <div
    v-if="isRenaming"
    class="h-6 relative"
    :class="{
      'max-w-2/5': !isSharedBase && !isMobileMode && activeView?.is_default,
      'max-w-3/5': !isSharedBase && !isMobileMode && !activeView?.is_default,
    }"
  >
    <input
      ref="renameInputDom"
      v-model="viewRenameTitle"
      class="ml-0.25 w-full px-1 py-0.5 rounded-md font-medium text-gray-800"
      :class="{
        'outline-brand-500': !error,
        'outline-red-500 pr-6': error,
      }"
      @blur="onRenameBlur"
      @keydown.enter="onRenameBlur"
      @keydown.esc="resetViewRename"
    />
    <NcTooltip v-if="error" class="absolute top-0.25 right-0.5 bg-white rounded-lg">
      <template #title>
        {{ error }}
      </template>
      <GeneralIcon icon="info" class="cursor-pointer" />
    </NcTooltip>
  </div>
  <NcDropdown
    v-else-if="!sharedView"
    v-model:visible="isDropdownOpen"
    class="!xs:pointer-events-none nc-actions-menu-btn nc-view-context-btn"
    overlay-class-name="nc-dropdown-actions-menu"
  >
    <div>
      <NcButton
        v-e="['c:toolbar:view-actions']"
        class="nc-view-action-menu-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
        size="small"
        type="secondary"
      >
        <div class="flex items-center gap-0.5">
          <GeneralIcon icon="threeDotVertical" class="!h-4 !w-4" />
        </div>
      </NcButton>
    </div>
    <template #overlay>
      <SmartsheetToolbarViewActionMenu
        :table="activeTable"
        :view="activeView"
        @close-modal="isDropdownOpen = false"
        @rename="onRenameMenuClick"
        @delete="openDeleteDialog"
        @description-update="updateDescription"
      />
    </template>
  </NcDropdown>
</template>
