<script lang="ts" setup>
import type { AttachmentType, ColumnType } from 'nocodb-sdk'
import type { Row as RowType } from '#imports'

const props = defineProps<{
  row: RowType
  rowIndex: number
}>()

const emit = defineEmits(['expandRow', 'updateRowProperty'])

const { row, rowIndex } = toRefs(props)

const fields = inject(FieldsInj, ref([]))

const { isUIAllowed } = useRoles()

const { isMobileMode } = useGlobal()

const isPublic = inject(IsPublicInj, ref(false))

const reloadViewDataHook = inject(ReloadViewDataHookInj)

const expandRow = inject(ExpandRowInj, (_row: RowType) => {})

const { kanbanMetaData, kanbanViewCoverImageColumnId } = useKanbanViewStoreOrThrow()

const { metas } = useMetas()

const meta = inject(MetaInj, ref())

const viewMeta = inject(ViewMetaInj, ref())

const compactMode = computed(() => !!(kanbanMetaData.value as any)?.compact_mode)

const coverImageColumn = computed(() =>
  meta.value?.columns?.find((col: ColumnType) => col.id === kanbanViewCoverImageColumnId.value),
)

const coverImage = computed(() => {
  if (!coverImageColumn.value?.title) return null
  const attachments = row.value.row[coverImageColumn.value.title]
  if (!attachments || !Array.isArray(attachments) || attachments.length === 0) return null
  const firstAttachment = attachments[0] as AttachmentType
  return firstAttachment?.signedPath
    ? `${firstAttachment.signedPath}`
    : firstAttachment?.path
    ? `${firstAttachment.path}`
    : null
})
</script>

<template>
  <div
    class="nc-kanban-card group relative flex flex-col w-full cursor-pointer border-1 border-gray-200 rounded-xl overflow-hidden bg-white hover:border-brand-500 transition-all"
    :class="{
      'nc-kanban-card-compact': compactMode,
    }"
    :data-testid="`nc-kanban-card-${rowIndex}`"
  >
    <!-- Cover Image -->
    <template v-if="!compactMode && coverImage">
      <div class="nc-kanban-cover-image-wrapper h-32 w-full overflow-hidden">
        <img
          :src="coverImage"
          class="w-full h-full object-cover"
          alt="cover image"
        />
      </div>
    </template>

    <div
      class="flex flex-col gap-1 p-2"
      :class="{
        'p-1.5': compactMode,
      }"
    >
      <slot />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-kanban-card-compact {
  @apply text-sm;
}
</style>
