<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

interface Props {
  row: RowType
  fields: ColumnType[]
  compactMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compactMode: false,
})

const emit = defineEmits(['expandRecord', 'deleteRecord', 'click'])

const { row, fields, compactMode } = toRefs(props)

const { isUIAllowed } = useRoles()

const displayField = computed(() => fields.value?.[0])

const displayValue = computed(() => {
  if (!displayField.value) return ''
  return row.value?.row?.[displayField.value.title as string] ?? ''
})

function expandRecord() {
  emit('expandRecord', row.value)
}
</script>

<template>
  <div
    class="nc-kanban-card group"
    :class="[compactMode ? 'nc-kanban-card-compact' : 'nc-kanban-card-normal']"
    @click="emit('click', $event)"
  >
    <template v-if="compactMode">
      <div class="flex items-center justify-between px-2 py-[3px] min-h-[28px] gap-1">
        <span class="text-sm text-gray-700 truncate flex-1">
          {{ displayValue }}
        </span>
        <NcButton
          v-if="isUIAllowed('dataEdit')"
          type="text"
          size="xsmall"
          class="!h-5 !w-5 !min-w-[20px] opacity-0 group-hover:opacity-100 transition-opacity !p-0 flex-shrink-0"
          @click.stop="expandRecord"
        >
          <GeneralIcon icon="expand" class="h-3 w-3 text-gray-500" />
        </NcButton>
      </div>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-kanban-card-compact {
  @apply border border-gray-200 rounded bg-white hover:border-primary cursor-pointer;

  &:hover {
    @apply shadow-sm;
  }
}

.nc-kanban-card-normal {
  @apply border border-gray-200 rounded bg-white hover:border-primary cursor-pointer;
}
</style>
