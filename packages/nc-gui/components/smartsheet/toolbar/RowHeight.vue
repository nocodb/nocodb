<script setup lang="ts">
import type { GridType } from 'nocodb-sdk'
import { ActiveViewInj, IsLockedInj, inject, ref, useMenuCloseOnEsc } from '#imports'

const { isSharedBase } = useProject()

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { $api } = useNuxtApp()

const open = ref(false)

const updateRowHeight = async (rh: number) => {
  if (view.value?.id) {
    try {
      if (!isPublic.value && !isSharedBase.value) {
        await $api.dbView.gridUpdate(view.value.id, {
          row_height: rh,
        })

        message.success('View updated successfully!')
      }

      ;(view.value.view as GridType).row_height = rh

      open.value = false
    } catch (e) {
      message.error('There was an error while updating view!')
    }
  }
}

useMenuCloseOnEsc(open)
</script>

<template>
  <a-dropdown v-model:visible="open" offset-y class="" :trigger="['click']" overlay-class-name="nc-dropdown-height-menu">
    <div>
      <a-button v-e="['c:row-height']" class="nc-height-menu-btn nc-toolbar-btn" :disabled="isLocked">
        <div class="flex items-center gap-1">
          <RiLineHeight />

          <!-- Row Height -->
          <span class="text-capitalize !text-sm font-weight-normal">Row Height</span>
          <MdiMenuDown class="text-grey" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div class="w-full bg-gray-50 shadow-lg menu-filter-dropdown !border" data-testid="nc-height-menu">
        <div class="text-gray-500 !text-xs px-4 py-2">Select a row height</div>
        <div class="flex flex-col w-full text-sm" @click.stop>
          <div class="nc-row-height-option" @click="updateRowHeight(0)">Short</div>
          <div class="nc-row-height-option" @click="updateRowHeight(1)">Medium</div>
          <div class="nc-row-height-option" @click="updateRowHeight(2)">Tall</div>
          <div class="nc-row-height-option" @click="updateRowHeight(3)">Extra</div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-row-height-option {
  @apply flex items-center py-1 px-2 justify-center hover:bg-gray-200 cursor-pointer;
}
</style>
