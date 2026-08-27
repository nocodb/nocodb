<script lang="ts" setup>
import type { ColumnType, TableType } from 'nocodb-sdk'
import { RelationTypes, UITypes, isVirtualCol } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  fields: ColumnType[]
  compactMode?: boolean
  readonly?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { row, fields, compactMode, readonly } = toRefs(props)

const meta = inject(MetaInj, ref())
const { isUIAllowed } = useRoles()
const { isMobileMode } = useGlobal()

const primaryField = computed(() => fields.value?.find((f) => f.pv) ?? fields.value?.[0])

const primaryFieldValue = computed(() => {
  if (!primaryField.value) return ''
  return row.value?.row?.[primaryField.value.title as string] ?? ''
})

function expandRecord() {
  emit('expandRecord', row.value)
}

function deleteRecord() {
  emit('deleteRecord', row.value)
}
</script>

<template>
  <div
    class="nc-kanban-data-card"
    :class="{ 'nc-kanban-data-card-compact': compactMode }"
  >
    <template v-if="compactMode">
      <div class="compact-card-wrapper group flex items-center px-2 py-[3px] min-h-[28px] gap-1 bg-white border border-gray-200 rounded hover:border-brand-500 cursor-pointer transition-all">
        <span class="flex-1 text-sm text-gray-700 truncate leading-5">
          {{ primaryFieldValue || t('general.noValue') }}
        </span>
        <div class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <NcButton
            v-if="!readonly && isUIAllowed('dataEdit')"
            size="xsmall"
            type="text"
            class="!h-5 !w-5 !p-0 !min-w-0"
            @click.stop="expandRecord"
          >
            <GeneralIcon icon="expand" class="h-[14px] w-[14px] text-gray-500" />
          </NcButton>
        </div>
      </div>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>

<style lang="scss" scoped>
.nc-kanban-data-card-compact {
  + .nc-kanban-data-card-compact {
    @apply mt-0.5;
  }
}
</style>
