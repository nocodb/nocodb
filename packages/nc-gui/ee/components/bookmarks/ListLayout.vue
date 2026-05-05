<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

interface Props {
  groups: BookmarkGroupType[]
  columnGroups: BookmarkGroupType[][]
  bookmarksByGroup: Record<string, BookmarkType[]>
}

const props = defineProps<Props>()

const { groups, columnGroups, bookmarksByGroup } = toRefs(props)

const emit = defineEmits<{ navigate: [bookmark: BookmarkType] }>()

const { draggingGroupId, groupDropIndex, updateGroupDropIndex, onDropGroup, onDragEnd } = useBookmarkDnd()

const colCount = computed(() => columnGroups.value.length)

// Prefix sum of column lengths — used to convert (colIdx, posInCol) into
// the linear index in `groups` (sequential column-major fill).
const columnOffsets = computed(() => {
  const offsets: number[] = [0]
  for (const col of columnGroups.value) {
    offsets.push(offsets[offsets.length - 1] + col.length)
  }
  return offsets
})

const listRef = ref<HTMLElement>()
let rafId: number | null = null

function handleDragOver(e: DragEvent) {
  if (!draggingGroupId.value || !listRef.value) return
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'

  const clientX = e.clientX
  const clientY = e.clientY

  if (rafId != null) return
  rafId = requestAnimationFrame(() => {
    rafId = null
    if (!draggingGroupId.value) return
    if (!listRef.value) return

    const colEls = Array.from(listRef.value.children) as HTMLElement[]
    let colIdx = -1
    for (let i = 0; i < colEls.length; i++) {
      const r = colEls[i].getBoundingClientRect()
      if (clientX >= r.left && clientX <= r.right) {
        colIdx = i
        break
      }
    }
    if (colIdx === -1) return

    const groupEls = colEls[colIdx].querySelectorAll('[data-group-id]')
    let posInCol = (columnGroups.value[colIdx] ?? []).length
    for (let i = 0; i < groupEls.length; i++) {
      const r = groupEls[i].getBoundingClientRect()
      if (clientY < r.top + r.height / 2) {
        posInCol = i
        break
      }
    }

    const logicalIdx = (columnOffsets.value[colIdx] ?? 0) + posInCol
    updateGroupDropIndex(Math.min(logicalIdx, groups.value.length))
  })
}

function handleDrop(e: DragEvent) {
  if (!draggingGroupId.value) return
  e.preventDefault()
  onDropGroup(groupDropIndex.value ?? groups.value.length)
}

const dropTargetGroupId = computed(() => {
  if (!draggingGroupId.value || groupDropIndex.value == null) return null
  return groups.value[groupDropIndex.value]?.id ?? null
})

// Drop indicator at the very end belongs in the last column
const lastColIdx = computed(() => Math.max(0, colCount.value - 1))
</script>

<template>
  <div
    ref="listRef"
    class="nc-bookmark-list-layout"
    :class="`cols-${colCount}`"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @dragend="onDragEnd"
  >
    <div v-for="(col, colIdx) in columnGroups" :key="colIdx" class="nc-bookmark-list-col">
      <template v-for="group in col" :key="group.id">
        <div
          v-if="dropTargetGroupId === group.id && group.id !== draggingGroupId"
          class="nc-bookmark-list-group-drop-line"
        />
        <BookmarksListGroup
          :group="group"
          :bookmarks="bookmarksByGroup[group.id!] ?? []"
          :all-groups="groups"
          @navigate="(bm) => emit('navigate', bm)"
        />
      </template>
      <div
        v-if="draggingGroupId && groupDropIndex === groups.length && colIdx === lastColIdx"
        class="nc-bookmark-list-group-drop-line"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-bookmark-list-layout {
  @apply grid gap-0;
  /* minmax(0, 1fr) — true equal columns regardless of content size */
  &.cols-1 { grid-template-columns: minmax(0, 1fr); }
  &.cols-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  &.cols-3 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr); }
}
.nc-bookmark-list-col {
  @apply flex flex-col min-w-0;
  & + & {
    @apply border-l-1 border-dashed border-nc-border-gray-medium;
  }
}
.nc-bookmark-list-group-drop-line {
  @apply h-0.5 mx-3 my-1 rounded-full bg-nc-content-brand;
}
</style>
