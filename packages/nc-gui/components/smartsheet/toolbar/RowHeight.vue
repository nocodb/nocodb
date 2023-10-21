<script setup lang="ts">
import type { GridType } from 'nocodb-sdk'
import { ActiveViewInj, IsLockedInj, iconMap, inject, ref, storeToRefs, useMenuCloseOnEsc, useUndoRedo } from '#imports'

const { isSharedBase } = storeToRefs(useBase())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { $api } = useNuxtApp()

const { addUndo, defineViewScope } = useUndoRedo()

const open = ref(false)

const updateRowHeight = async (rh: number, undo = false) => {
  if (view.value?.id) {
    if (rh === (view.value.view as GridType).row_height) return

    if (!undo) {
      addUndo({
        redo: {
          fn: (r: number) => updateRowHeight(r, true),
          args: [rh],
        },
        undo: {
          fn: (r: number) => updateRowHeight(r, true),
          args: [(view.value.view as GridType).row_height || 0],
        },
        scope: defineViewScope({ view: view.value }),
      })
    }

    try {
      if (!isPublic.value && !isSharedBase.value) {
        await $api.dbView.gridUpdate(view.value.id, {
          row_height: rh,
        })
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
        <div class="flex items-center gap-0.5">
          <component :is="iconMap.rowHeight" class="!h-3.75 !w-3.75" />
          <!-- <span v-if="!isMobileMode" class="!text-sm !font-medium">{{ $t('objects.rowHeight') }}</span> -->
        </div>
      </a-button>
    </div>
    <template #overlay>
      <div
        class="w-full bg-white shadow-lg menu-filter-dropdown border-1 border-gray-50 rounded-md overflow-hidden"
        data-testid="nc-height-menu"
      >
        <div class="flex flex-col w-full text-sm" @click.stop>
          <div class="text-xs text-gray-500 px-3 pt-2 pb-1 select-none">{{ $t('objects.rowHeight') }}</div>
          <div
            class="nc-row-height-option"
            :class="{'active': !(view?.view as GridType).row_height }"
            @click="updateRowHeight(0)"
          >
            <GeneralIcon icon="heightShort" class="nc-row-height-icon" />
            {{ $t('objects.heightClass.short') }}
          </div>
          <div
            class="nc-row-height-option"
            :class="{'active': (view?.view as GridType).row_height === 1}"
            @click="updateRowHeight(1)"
          >
            <GeneralIcon icon="heightMedium" class="nc-row-height-icon" />
            {{ $t('objects.heightClass.medium') }}
          </div>
          <div
            class="nc-row-height-option"
            :class="{'active': (view?.view as GridType).row_height === 2}"
            @click="updateRowHeight(2)"
          >
            <GeneralIcon icon="heightTall" class="nc-row-height-icon" />
            {{ $t('objects.heightClass.tall') }}
          </div>
          <div
            class="nc-row-height-option"
            :class="{'active': (view?.view as GridType).row_height === 3}"
            @click="updateRowHeight(3)"
          >
            <GeneralIcon icon="heightExtra" class="nc-row-height-icon" />
            {{ $t('objects.heightClass.extra') }}
          </div>
        </div>
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-row-height-option {
  @apply flex items-center py-2 pl-1 pr-2 justify-start hover:bg-gray-100 cursor-pointer text-gray-600;
}

.nc-row-height-icon {
  @apply mx-2 text-base;
}

.active {
  @apply bg-primary-selected;
}
</style>
