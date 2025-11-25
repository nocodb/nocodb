<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  fields: ColumnType[]
  primaryRecordId: string
  selectedFields: Record<string, string>
  getSelectedFieldValue: (fieldId: string) => any
  getFieldValue: (fieldId: string, recordId: string) => any
}

defineProps<Props>()
</script>

<template>
  <div class="border-2 border-dashed border-primary rounded-lg p-4 bg-primary/5">
    <h3 class="font-semibold mb-3">Merge Preview</h3>
    <div class="space-y-2">
      <div v-for="field of fields" :key="field.id" class="flex items-start gap-2">
        <div class="flex-1">
          <div class="text-xs font-medium text-gray-600">{{ field.title }}</div>
          <div class="text-sm">
            {{
              field.id
                ? getSelectedFieldValue(field.id) ?? getFieldValue(field.id, primaryRecordId) ?? '(empty)'
                : '(empty)'
            }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
