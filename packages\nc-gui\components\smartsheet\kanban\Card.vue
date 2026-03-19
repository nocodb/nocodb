<script lang="ts" setup>
import type { Row as RowType } from '#imports'

interface Props {
  row: RowType
  fields: any[]
  compactMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  compactMode: false,
})

const { row, fields, compactMode } = toRefs(props)

const { isUIAllowed } = useRoles()
const expandedFormDlg = ref(false)
const expandedFormRowState = ref<Record<string, any>>()
</script>

<template>
  <div
    class="nc-kanban-card"
    :class="{
      'nc-kanban-card-compact': compactMode,
    }"
  >
    <!-- compact mode: single line -->
    <template v-if="compactMode">
      <div class="flex items-center gap-1 px-2 py-1 min-h-[28px]">
        <span class="text-sm truncate flex-1">
          {{ row.row[fields[0]?.title] }}
        </span>
      </div>
    </template>
    <!-- normal mode -->
    <template v-else>
      <div class="flex flex-col gap-2 p-2">
        <template v-for="field in fields" :key="field.id">
          <div class="flex flex-col">
            <span class="text-xs text-gray-500">{{ field.title }}</span>
            <span class="text-sm">{{ row.row[field.title] }}</span>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>
