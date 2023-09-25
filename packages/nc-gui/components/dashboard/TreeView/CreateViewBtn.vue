<script setup lang="ts">
import type { ViewType } from 'nocodb-sdk'
import { ViewTypes } from 'nocodb-sdk'

const { $e } = useNuxtApp()

const { refreshCommandPalette } = useCommandPalette()
const viewsStore = useViewsStore()
const { views } = storeToRefs(viewsStore)
const { loadViews, navigateToView } = viewsStore

const table = inject(SidebarTableInj)!
const project = inject(ProjectInj)!

const isOpen = ref(false)

function onOpenModal({
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
  isOpen.value = false

  const isDlgOpen = ref(true)

  const { close } = useDialog(resolveComponent('DlgViewCreate'), {
    'modelValue': isDlgOpen,
    title,
    type,
    'tableId': table.value.id,
    'selectedViewId': copyViewId,
    groupingFieldColumnId,
    'views': views,
    'onUpdate:modelValue': closeDialog,
    'onCreated': async (view: ViewType) => {
      closeDialog()

      refreshCommandPalette()

      await loadViews({
        force: true,
      })

      navigateToView({
        view,
        tableId: table.value.id!,
        projectId: project.value.id!,
      })

      $e('a:view:create', { view: view.type })
    },
  })

  function closeDialog() {
    isOpen.value = false

    close(1000)
  }
}
</script>

<template>
  <NcDropdown v-model:isOpen="isOpen" destroy-popup-on-hide @click.stop="isOpen = !isOpen">
    <slot />
    <template #overlay>
      <NcMenu class="max-w-48">
        <NcMenuItem @click="onOpenModal({ type: ViewTypes.GRID })">
          <div class="item" data-testid="sidebar-view-create-grid">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GRID }" />
              <div>Grid</div>
            </div>

            <GeneralIcon class="plus" icon="plus" />
          </div>
        </NcMenuItem>

        <NcMenuItem @click="onOpenModal({ type: ViewTypes.FORM })">
          <div class="item" data-testid="sidebar-view-create-form">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.FORM }" />
              <div>Form</div>
            </div>

            <GeneralIcon class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <NcMenuItem @click="onOpenModal({ type: ViewTypes.GALLERY })">
          <div class="item" data-testid="sidebar-view-create-gallery">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.GALLERY }" />
              <div>Gallery</div>
            </div>

            <GeneralIcon class="plus" icon="plus" />
          </div>
        </NcMenuItem>
        <NcMenuItem data-testid="sidebar-view-create-kanban" @click="onOpenModal({ type: ViewTypes.KANBAN })">
          <div class="item">
            <div class="item-inner">
              <GeneralViewIcon :meta="{ type: ViewTypes.KANBAN }" />
              <div>Kanban</div>
            </div>

            <GeneralIcon class="plus" icon="plus" />
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
