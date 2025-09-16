<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { isColumnInvalid } from '#imports'

const props = defineProps<{ virtual?: boolean; isOpen: boolean; isHiddenCol?: boolean }>()

const emit = defineEmits(['edit', 'addColumn', 'update:isOpen'])

const isOpen = useVModel(props, 'isOpen', emit)

const column = inject(ColumnInj)

const isLocked = inject(IsLockedInj, ref(null))

const isPublic = inject(IsPublicInj, ref(false))

const isExpandedForm = inject(IsExpandedFormOpenInj, ref(false))

const meta = inject(MetaInj, ref())

const { isUIAllowed } = useRoles()

const { aiIntegrations, isNocoAiAvailable } = useNocoAi()

const columnInvalid = computed<{ isInvalid: boolean; tooltip: string }>(() => {
  if (!column?.value) {
    return {
      isInvalid: false,
      tooltip: '',
    }
  }

  return isColumnInvalid({
    col: column.value,
    aiIntegrations: aiIntegrations.value,
    isReadOnly: isPublic.value || !isUIAllowed('dataEdit'),
    isNocoAiAvailable: isNocoAiAvailable.value,
    columns: meta.value?.columns as ColumnType[],
  })
})

const openDropdown = () => {
  if (isLocked.value) return
  isOpen.value = !isOpen.value
}

const emitAddColumn = (...args: any[]) => {
  emit('addColumn', ...args)
}

const emitEdit = (...args: any[]) => {
  emit('edit', ...args)
}
</script>

<template>
  <a-dropdown
    v-model:visible="isOpen"
    :trigger="['click']"
    :placement="isExpandedForm ? 'bottomLeft' : 'bottomRight'"
    :overlay-class-name="`nc-dropdown-column-operations ${isOpen ? 'active' : ''} !border-1 rounded-lg !shadow-xl`"
    @click.stop="openDropdown"
  >
    <div class="flex gap-1 items-center" @dblclick.stop>
      <div v-if="isExpandedForm" class="h-[1px]">&nbsp;</div>
      <NcTooltip v-if="column?.description?.length && !isExpandedForm" class="flex">
        <template #title>
          <div class="whitespace-pre-wrap break-words">{{ column?.description }}</div>
        </template>
        <GeneralIcon icon="info" class="group-hover:opacity-100 !w-3.5 !h-3.5 !text-gray-500 flex-none" />
      </NcTooltip>

      <NcTooltip class="flex items-center">
        <GeneralIcon v-if="columnInvalid.isInvalid && !isExpandedForm" class="text-red-300 w-3.5 h-3.5" icon="alertTriangle" />

        <template #title>
          {{ $t(columnInvalid.tooltip) }}
        </template>
      </NcTooltip>
      <GeneralIcon
        v-if="!isExpandedForm"
        icon="arrowDown"
        class="text-grey h-full text-grey nc-ui-dt-dropdown cursor-pointer outline-0 mr-2"
      />
    </div>
    <template #overlay>
      <SmartsheetHeaderColumnMenu
        v-model:is-open="isOpen"
        :column="column"
        :virtual="virtual"
        :is-hidden-col="isHiddenCol"
        @add-column="emitAddColumn"
        @edit="emitEdit"
      />
    </template>
  </a-dropdown>
</template>

<style scoped lang="scss">
:deep(.nc-menu-item-inner) {
  @apply !w-full;
}
.nc-header-menu-item {
  @apply text-dropdown flex items-center gap-2;
}

.nc-column-options {
  .nc-icons {
    @apply !w-5 !h-5;
  }
}

:deep(.ant-dropdown-menu-item.ant-dropdown-menu-item-disabled .nc-icon) {
  @apply text-current;
}
</style>
