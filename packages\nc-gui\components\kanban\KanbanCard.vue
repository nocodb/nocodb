<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import type { Row } from '~/lib/types'

const props = defineProps<{
  row: Row
  fields: ColumnType[]
  coverImageField?: string
  groupingField?: ColumnType
  isPublic?: boolean
  readOnly?: boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  expand: []
  deleteRecord: []
}>()

const { isMobileMode } = useGlobal()
const { isUIAllowed } = useRoles()
const { t } = useI18n()
const { getPossibleAttachmentSrc } = useAttachment()

const coverImageSrc = computed<string | null>(() => {
  if (!props.coverImageField || !props.row?.row) return null
  const attachments = props.row.row[props.coverImageField]
  if (!attachments?.length) return null
  try {
    const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments
    const first = parsed?.[0]
    if (!first) return null
    return getPossibleAttachmentSrc(first)
  } catch {
    return null
  }
})

const displayField = computed(() => props.fields?.find((f) => (f as any).pv))

const nonPrimaryFields = computed(() =>
  props.fields?.filter(
    (f) => !(f as any).pv && f.title !== props.groupingField?.title,
  ) ?? [],
)
</script>

<template>
  <div
    class="group relative nc-kanban-item"
    :class="compact ? 'compact' : 'normal'"
  >
    <!-- content -->
  </div>
</template>
