<script setup lang="ts">
import { type GridType, ViewTypes } from 'nocodb-sdk'

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

const viewStore = useViewsStore()

const { updateViewMeta } = viewStore

const view = inject(ActiveViewInj, ref())

const isPublic = inject(IsPublicInj, ref(false))

const isLocked = inject(IsLockedInj, ref(false))

const { isUIAllowed } = useRoles()

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
      await updateViewMeta(
        view.value.id,
        ViewTypes.GRID,
        {
          row_height: rh,
        },
        {
          skipNetworkCall: isPublic.value || isSharedBase.value || !isUIAllowed('viewCreateOrEdit'),
        },
      )

      open.value = false
    } catch (e: any) {
      message.error((await extractSdkResponseErrorMsg(e)) || 'There was an error while updating view!')
    }
  }
}

useMenuCloseOnEsc(open)
</script>

<template>
  <NcDropdown
    v-model:visible="open"
    offset-y
    class=""
    :trigger="['click']"
    overlay-class-name="nc-dropdown-height-menu overflow-hidden"
  >
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
      <div class="p-1.5 menu-filter-dropdown min-w-[160px]" data-testid="nc-height-menu">
        <div class="flex flex-col w-full text-sm" @click.stop>
          <div class="text-xs text-nc-content-gray-muted px-3 pt-2 pb-1 select-none">{{ $t('objects.rowHeight') }}</div>
          <div
            v-for="(item, i) of rowHeightOptions"
            :key="i"
            class="nc-row-height-option"
            :class="{
              'hover:bg-nc-bg-gray-light cursor-pointer': !isLocked,
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
  </NcDropdown>
</template>

<style scoped>
.nc-row-height-option {
  @apply flex items-center gap-2 p-2 justify-between rounded-md text-nc-content-gray-subtle2;
}

.nc-row-height-icon {
  @apply text-base;
}
</style>
