<script setup lang="ts">
import type { RestoreConflict } from '~/composables/useBaseTrash'

interface Props {
  kind: 'link' | 'validation' | 'unique-active' | 'unique-intra'
  conflicts: RestoreConflict[]
}

const props = defineProps<Props>()

const { t } = useI18n()

const isOpen = ref(true)

const titleKey = computed(() => {
  switch (props.kind) {
    case 'link':
      return 'trash.conflict.group.link'
    case 'validation':
      return 'trash.conflict.group.validation'
    case 'unique-active':
    case 'unique-intra':
      return 'trash.conflict.group.unique'
  }
})

const resolutionKey = computed(() => {
  switch (props.kind) {
    case 'link':
      return 'trash.conflict.resolution.clearLink'
    case 'validation':
    case 'unique-active':
      return 'trash.conflict.resolution.clearField'
    case 'unique-intra':
      return 'trash.conflict.resolution.intraKeepLowest'
  }
})

const groupIcon = computed(() => {
  switch (props.kind) {
    case 'link':
      return 'ncLink'
    case 'validation':
      return 'alertTriangle'
    case 'unique-active':
    case 'unique-intra':
      return 'ncCopy'
  }
})

function validationReason(message?: string): string {
  if (!message) return t('trash.conflict.cell.validationGeneric')
  const low = message.toLowerCase()
  if (low.includes('isemail') || low.includes('email')) {
    return t('trash.conflict.cell.validationEmail')
  }
  if (low.includes('isurl') || low.includes(' url')) {
    return t('trash.conflict.cell.validationUrl')
  }
  if (low.includes('phone') || low.includes('mobile')) {
    return t('trash.conflict.cell.validationPhone')
  }
  return t('trash.conflict.cell.validationGeneric')
}

function valueText(v: unknown): string {
  if (v === null || v === undefined || v === '') return ''
  if (typeof v === 'string') return v
  try {
    return JSON.stringify(v)
  } catch {
    return String(v)
  }
}

function reasonFor(c: RestoreConflict): string {
  switch (c.kind) {
    case 'link-v1':
    case 'link-v2':
      return t('trash.conflict.cell.linkTaken')
    case 'validation':
      return validationReason(c.message)
    case 'unique-active':
      return t('trash.conflict.cell.duplicateActive', {
        value: valueText(c.value),
      })
    case 'unique-intra':
      return t('trash.conflict.cell.duplicateIntra')
  }
}

function willClear(c: RestoreConflict): boolean {
  // unique-intra winner keeps the value — no clear
  if (c.kind === 'unique-intra' && c.winnerRowId === c.rowId) return false
  return true
}
</script>

<template>
  <div class="nc-base-trash-conflict-group rounded-lg border-1 border-nc-border-gray-medium overflow-hidden bg-white">
    <button
      type="button"
      class="w-full flex items-center gap-2 px-3 py-2 text-left bg-nc-bg-gray-extralight hover:bg-nc-bg-gray-light transition-colors"
      @click="isOpen = !isOpen"
    >
      <GeneralIcon :icon="isOpen ? 'ncChevronDown' : 'ncChevronRight'" class="w-3.5 h-3.5 text-nc-content-gray-subtle shrink-0" />
      <GeneralIcon :icon="groupIcon" class="w-3.5 h-3.5 text-nc-content-gray-subtle shrink-0" />
      <span class="text-bodySm font-semibold text-nc-content-gray-emphasis shrink-0">
        {{ t(titleKey) }}
      </span>
      <NcBadge class="!bg-nc-bg-gray-light !text-nc-content-gray-subtle shrink-0">
        {{ conflicts.length }}
      </NcBadge>
      <span class="text-captionSm text-nc-content-gray-muted ml-auto truncate">
        {{ t(resolutionKey) }}
      </span>
    </button>

    <div v-if="isOpen" class="divide-y divide-nc-border-gray-medium">
      <div v-for="(c, i) in conflicts" :key="i" class="flex items-center gap-3 px-3 py-2.5 text-captionSm">
        <span class="text-nc-content-gray-muted font-mono shrink-0 w-10"> #{{ c.rowId }} </span>
        <span class="font-medium text-nc-content-gray-emphasis shrink-0 max-w-32 truncate" :title="c.columnTitle">
          {{ c.columnTitle }}
        </span>
        <span class="text-nc-content-gray-subtle flex-1 min-w-0 truncate" :title="reasonFor(c)">
          {{ reasonFor(c) }}
        </span>
        <span v-if="willClear(c)" class="text-captionSm text-nc-content-gray-muted shrink-0 italic">
          {{ t('trash.conflict.outcome.cleared') }}
        </span>
        <span v-else class="text-captionSm text-nc-content-brand shrink-0 font-medium">
          {{ t('trash.conflict.outcome.kept') }}
        </span>
      </div>
    </div>
  </div>
</template>
