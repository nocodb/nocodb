<script lang="ts" setup>
import type { AttachmentType, ColumnType } from 'nocodb-sdk'

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
  editRecord: []
  deleteRecord: []
}>()

const { isMobileMode } = useGlobal()

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const { getMeta } = useMetas()

const isCompact = computed(() => props.compact)

const getCoverImage = computed(() => {
  if (!props.coverImageField) return null
  const attachments = props.row?.row?.[props.coverImageField]
  if (!attachments?.length) return null
  try {
    const parsed = typeof attachments === 'string' ? JSON.parse(attachments) : attachments
    return parsed?.[0]
  } catch {
    return null
  }
})

const displayFields = computed(() => {
  return props.fields?.filter((f) => !f.pv) ?? []
})

const titleField = computed(() => {
  return props.fields?.find((f) => f.pv)
})
</script>
