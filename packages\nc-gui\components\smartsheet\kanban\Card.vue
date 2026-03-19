<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  fields: ColumnType[]
  compactMode?: boolean
}>()

const emit = defineEmits(['expandRecord', 'deleteRecord'])

const { row, fields, compactMode } = toRefs(props)

const { isUIAllowed } = useRoles()

const meta = inject(MetaInj, ref())

const selected = ref(false)

function expandRecord() {
  emit('expandRecord', row.value)
}

const displayField = computed(() => fields.value?.[0])

const displayValue = computed(() => {
  if (!displayField.value) return ''
  return row.value?.row?.[displayField.value.title as string] ?? ''
})
</script>

<template>
  <div
    class="nc-kanban-data-card group"
    :class="{
      'nc-compact': compactMode,
    }"
  >
    <template v-if="compactMode">
      <div class="flex items-center gap-2 px-2 py-1">
        <span class="text-sm text-nc-content-gray-subtle truncate flex-1">
          {{ displayValue }}
        </span>
        <NcButton
          size="xsmall"
          type="text"  
          class="opacity-0 group-hover:opacity-100 transition-all !h-5 !w-5 !p-0"
          @click.stop="expandRecord"
        >
          <GeneralIcon icon="expand" class="h-3 w-3" />
        </NcButton>
      </div>
    </template>
    <template v-else>
      <slot />
    </template>
  </div>
</template>
