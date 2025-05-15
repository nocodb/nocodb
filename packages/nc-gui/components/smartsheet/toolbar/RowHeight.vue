<script setup lang="ts">
import type { GridType } from 'nocodb-sdk'

const rowHeightOptions: { icon: keyof typeof iconMap; heightClass: string }[] = [
  {
    icon: 'heightShort',
    heightClass: 'short',
  },
  {
    icon: 'heightMedium',
    heightClass: 'medium',
  },
  {
    icon: 'heightTall',
    heightClass: 'tall',
  },
  {
    icon: 'heightExtra',
    heightClass: 'extra',
  },
]

const { isSharedBase } = storeToRefs(useBase())

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { isUIAllowed } = useRoles()

const { $api } = useNuxtApp()

const { addUndo, defineViewScope } = useUndoRedo()

const open = ref(false)

const updateRowHeight = async (rh: number, undo = false) => {
  if (isLocked.value) return

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
      if (!isPublic.value && !isSharedBase.value && isUIAllowed('viewCreateOrEdit')) {
        await $api.dbView.gridUpdate(view.value.id, {
          row_height: rh,
        })
      }

      ;(view.value.view as GridType).row_height = rh

      open.value = false
    } catch (e: any) {
      message.error((await extractSdkResponseErrorMsg(e)) || 'There was an error while updating view!')
    }
  }
}

useMenuCloseOnEsc(open)
</script>

<template>
  <a-dropdown v-model:visible="open" offset-y class="" :trigger="['click']" overlay-class-name="nc-dropdown-height-menu">
    <div>
      <NcButton
        v-e="['c:row-height']"
        class="nc-height-menu-btn nc-toolbar-btn !border-0 !h-7 !px-1.5 !min-w-7"
        size="small"
        type="secondary"
        :show-as-disabled="isLocked"
      >
        <div class="flex items-center gap-0.5">
          <component :is="iconMap.rowHeight" class="!h-3.75 !w-3.75" />
          <!-- <span v-if="!isMobileMode" class="!text-sm !font-medium">{{ $t('objects.rowHeight') }}</span> -->
        </div>
      </NcButton>
    </div>
    <template #overlay>
      <div
        class="w-full bg-white shadow-lg p-1.5 menu-filter-dropdown border-1 border-gray-200 rounded-lg overflow-hidden min-w-[160px]"
        data-testid="nc-height-menu"
      >
        <div class="flex flex-col w-full text-sm" @click.stop>
          <div class="text-xs text-gray-500 px-3 pt-2 pb-1 select-none">{{ $t('objects.rowHeight') }}</div>
          <div
            v-for="(item, i) of rowHeightOptions"
            :key="i"
            class="nc-row-height-option"
            :class="{
              'hover:bg-gray-100 cursor-pointer': !isLocked,
              'cursor-not-allowed': isLocked,
            }"
            @click="updateRowHeight(i)"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon :icon="item.icon" class="nc-row-height-icon" />
              {{ $t(`objects.heightClass.${item.heightClass}`) }}
            </div>
            <component
              :is="iconMap.check"
              v-if="i === 0 ? !(view?.view as GridType).row_height: (view?.view as GridType).row_height === i"
              class="text-primary w-4 h-4"
            />
          </div>
        </div>
        <GeneralLockedViewFooter v-if="isLocked" class="-mx-1.5 -mb-1.5" @on-open="open = false" />
      </div>
    </template>
  </a-dropdown>
</template>

<style scoped>
.nc-row-height-option {
  @apply flex items-center gap-2 p-2 justify-between rounded-md text-gray-600;
}

.nc-row-height-icon {
  @apply text-base;
}
</style>
