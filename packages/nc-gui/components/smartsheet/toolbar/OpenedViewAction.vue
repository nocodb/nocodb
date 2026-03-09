<script lang="ts" setup>
defineProps<{
  showOnlyCopyId?: boolean
}>()

const { activeTable } = storeToRefs(useTablesStore())

const { $e } = useNuxtApp()

const viewStore = useViewsStore()

const { activeView } = storeToRefs(viewStore)

const isDropdownOpen = ref(false)

const isViewIdCopied = ref(false)

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

watch(isDropdownOpen, () => {
  setTimeout(() => {
    isViewIdCopied.value = false
  }, 250)
})

function openDeleteDialog() {
  const isOpen = ref(true)
  isDropdownOpen.value = false

  const { close } = useDialog(resolveComponent('DlgViewDelete'), {
    'modelValue': isOpen,
    'view': activeView.value,
    'onUpdate:modelValue': closeDialog,
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <NcDropdown
    v-model:visible="isDropdownOpen"
    class="nc-actions-menu-btn nc-view-context-btn"
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
        :show-only-copy-id="showOnlyCopyId"
        @close-modal="isDropdownOpen = false"
        @delete="openDeleteDialog"
        @description-update="updateDescription"
      />
    </template>
  </NcDropdown>
</template>
