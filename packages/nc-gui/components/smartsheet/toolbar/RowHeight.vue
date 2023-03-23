<script setup lang="ts">
import type { GridType } from 'nocodb-sdk'
import { ActiveViewInj, IsLockedInj, iconMap, inject, ref, storeToRefs, useMenuCloseOnEsc } from '#imports'

const { isSharedBase } = storeToRefs(useProject())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { $api } = useNuxtApp()

const open = ref(false)

const updateRowHeight = async (rh: number) => {
  if (view.value?.id) {
    if (rh === (view.value.view as GridType).row_height) return
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
          <PhSplitVerticalThin />
          <!-- Row Height -->
          <component :is="iconMap.arrowDown" class="text-grey !text-0.5rem" />
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div class="w-full bg-gray-50 shadow-lg menu-filter-dropdown !border" data-testid="nc-height-menu">
        <div class="text-gray-500 !text-xs px-4 py-2">Select a row height</div>
        <div class="flex flex-col w-full text-sm" @click.stop>
          <div class="nc-row-height-option" @click="updateRowHeight(0)">
            <NcIconsRowHeightShort class="nc-row-height-icon" />
            Short
          </div>
          <div class="nc-row-height-option" @click="updateRowHeight(1)">
            <NcIconsRowHeightMedium class="nc-row-height-icon" />
            Medium
          </div>
          <div class="nc-row-height-option" @click="updateRowHeight(2)">
            <NcIconsRowHeightTall class="nc-row-height-icon" />
            Tall
          </div>
          <div class="nc-row-height-option" @click="updateRowHeight(3)">
            <NcIconsRowHeightExtraTall class="nc-row-height-icon" />
            Extra
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-row-height-option {
  @apply flex items-center py-1 px-2 justify-start hover:bg-gray-200 cursor-pointer;
}

.nc-row-height-icon {
  @apply text-gray-600 mx-4 text-base;
}
</style>
