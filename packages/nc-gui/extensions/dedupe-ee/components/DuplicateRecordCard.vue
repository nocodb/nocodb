<script setup lang="ts">
import { computed } from 'vue'
import type { ColumnType } from 'nocodb-sdk'

interface Props {
  record: Record<string, any>
  recordId: string
  fields: ColumnType[]
  isPrimary: boolean
  isExcluded: boolean
  selectedFields: Record<string, string>
  onSetPrimary: (recordId: string) => void
  onExclude: (recordId: string) => void
  onInclude: (recordId: string) => void
  onSelectField: (fieldId: string, recordId: string) => void
  getFieldValue: (fieldId: string, recordId: string) => any
}

const props = defineProps<Props>()

const fieldIsSelected = (fieldId: string) => {
  return props.selectedFields[fieldId] === props.recordId
}
</script>

<template>
  <div
    class="border rounded-lg p-4"
    :class="{
      'border-primary bg-primary/5': isPrimary,
      'border-gray-300': !isPrimary,
      'opacity-50': isExcluded,
    }"
  >
    <div class="flex items-start justify-between mb-3">
      <div class="flex items-center gap-2">
        <NcButton
          size="small"
          :type="isPrimary ? 'primary' : 'secondary'"
          @click="onSetPrimary(recordId)"
        >
          {{ isPrimary ? 'Primary Record' : 'Set as Primary' }}
        </NcButton>
        <NcButton
          v-if="!isExcluded"
          size="small"
          type="secondary"
          @click="onExclude(recordId)"
        >
          Exclude
        </NcButton>
        <NcButton v-else size="small" type="secondary" @click="onInclude(recordId)">
          Include
        </NcButton>
      </div>
      <div v-if="isPrimary" class="text-primary font-semibold">✓ Primary</div>
    </div>

    <div class="space-y-2">
      <div
        v-for="field of fields"
        :key="field.id"
        class="flex items-start gap-2 p-2 rounded"
        :class="{
          'bg-green-50 border border-green-200': field.id && fieldIsSelected(field.id!),
        }"
      >
        <div class="flex-1">
          <div class="text-xs font-medium text-gray-600">{{ field.title }}</div>
          <div class="text-sm">
            {{ field.id ? getFieldValue(field.id, recordId) ?? '(empty)' : '(empty)' }}
          </div>
        </div>
        <NcButton
          v-if="!isPrimary && field.id"
          size="small"
          :type="fieldIsSelected(field.id) ? 'primary' : 'secondary'"
          @click="onSelectField(field.id, recordId)"
        >
          {{ fieldIsSelected(field.id) ? 'Selected' : 'Use' }}
        </NcButton>
      </div>
    </div>
  </div>
</template>
