<script setup lang="ts">
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'

const props = defineProps<{
  // Prop used to align the dropdown to the left in sidebar
  alignLeftLevel: number | undefined
}>()

const { $e } = useNuxtApp()

const alignLeftLevel = toRef(props, 'alignLeftLevel')

const { refreshCommandPalette } = useCommandPalette()
const viewsStore = useViewsStore()
const { loadViews, navigateToView } = viewsStore

const table = inject(SidebarTableInj)!
const base = inject(ProjectInj)!

const isViewListLoading = ref(false)
const toBeCreateType = ref<ViewTypes>()

const isOpen = ref(false)

const overlayClassName = computed(() => {
  if (alignLeftLevel.value === 1) return 'nc-view-create-dropdown nc-view-create-dropdown-left-1'

  if (alignLeftLevel.value === 2) return 'nc-view-create-dropdown nc-view-create-dropdown-left-2'

  return 'nc-view-create-dropdown'
})

async function onOpenModal({
  title = '',
  type,
  copyViewId,
  groupingFieldColumnId,
}: {
  title?: string
  type: ViewTypes
  copyViewId?: string
  groupingFieldColumnId?: string
}) {
  if (isViewListLoading.value) return

  toBeCreateType.value = type

  isViewListLoading.value = true
  await loadViews({
    tableId: table.value.id!,
  })

  isOpen.value = false
  isViewListLoading.value = false

  const isDlgOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isDlgOpen,
    title,
    type,
    'tableId': table.value.id,
    'selectedViewId': copyViewId,
    groupingFieldColumnId,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        tableId: table.value.id!,
        force: true,
      })

      table.value.meta = {
        ...(table.value.meta as object),
        hasNonDefaultViews: true,
      }

      navigateToView({
        view,
        tableId: table.value.id!,
        baseId: base.value.id!,
        doNotSwitchTab: true,
      })

      $e('a:view:create', { view: view.type })
    },
  })

  function closeDialog() {
    isOpen.value = false
    isDlgOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <NcDropdown v-model:visible="isOpen" destroy-popup-on-hide :overlay-class-name="overlayClassName" @click.stop="isOpen = true">
    <slot />
    <template #overlay>
      <NcMenu class="max-w-48">
        <NcMenuItem @click.stop="onOpenModal({ type: ViewTypes.GRID })">
          <div class="item" data-testid="sidebar-view-create-grid">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
              <div>Grid</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.GRID && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>

        <NcMenuItem @click="onOpenModal({ type: ViewTypes.FORM })">
          <div class="item" data-testid="sidebar-view-create-form">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.FORM }" />
              <div>Form</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.FORM && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <NcMenuItem @click="onOpenModal({ type: ViewTypes.GALLERY })">
          <div class="item" data-testid="sidebar-view-create-gallery">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" />
              <div>Gallery</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.GALLERY && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <NcMenuItem data-testid="sidebar-view-create-kanban" @click="onOpenModal({ type: ViewTypes.KANBAN })">
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" />
              <div>Kanban</div>
            </div>

            <GeneralLoader v-if="toBeCreateType === ViewTypes.KANBAN && isViewListLoading" />
            <GeneralIcon v-else class="plus" icon="plus" />
          </div>
        </NcMenuItem>
      </NcMenu>
    </template>
  </NcDropdown>
</template>

<style lang="scss" scoped>
.item {
  @apply flex flex-row items-center w-36 justify-between;
}

.item-inner {
  @apply flex flex-row items-center gap-x-1.75;
}

.plus {
  @apply text-brand-400;
}
</style>

<style lang="scss">
.nc-view-create-dropdown {
  @apply !max-w-43 !min-w-43;
}

.nc-view-create-dropdown-left-1 {
  @apply !left-18;
}

.nc-view-create-dropdown-left-2 {
  @apply !left-23.5;
}
</style>
