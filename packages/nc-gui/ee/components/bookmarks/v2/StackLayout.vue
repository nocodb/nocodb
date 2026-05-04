<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

interface Props {
  groups: BookmarkGroupType[]
  bookmarksByGroup: Record<string, BookmarkType[]>
  columns: 1 | 2
}

const props = defineProps<Props>()

const { groups, bookmarksByGroup, columns } = toRefs(props)

const emit = defineEmits<{ navigate: [bookmark: BookmarkType] }>()

const { draggingGroupId, groupDropIndex, updateGroupDropIndex, onDropGroup, onDragEnd } = useBookmarkDnd()

// Distribute groups across columns. We use a simple round-robin so columns balance.
const columnGroups = computed(() => {
  const cols: BookmarkGroupType[][] = Array.from({ length: columns.value }, () => [])
  groups.value.forEach((g, i) => {
    cols[i % columns.value].push(g)
  })
  return cols
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

    const logicalIdx = posInCol * columns.value + colIdx
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
</script>

<template>
  <div
    ref="listRef"
    class="nc-v2-stack-layout"
    :class="`cols-${columns}`"
    @dragover="handleDragOver"
    @drop="handleDrop"
    @dragend="onDragEnd"
  >
    <div v-for="(col, colIdx) in columnGroups" :key="colIdx" class="nc-v2-stack-col">
      <template v-for="group in col" :key="group.id">
        <div
          v-if="dropTargetGroupId === group.id && group.id !== draggingGroupId"
          class="nc-v2-stack-group-drop-line"
        />
        <BookmarksV2StackGroup
          :group="group"
          :bookmarks="bookmarksByGroup[group.id!] ?? []"
          :all-groups="groups"
          @navigate="(bm) => emit('navigate', bm)"
        />
      </template>
      <div
        v-if="draggingGroupId && groupDropIndex === groups.length && colIdx === groups.length % columns"
        class="nc-v2-stack-group-drop-line"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-v2-stack-layout {
  @apply grid gap-0;
  /* minmax(0, 1fr) — true equal columns regardless of content size */
  &.cols-1 { grid-template-columns: minmax(0, 1fr); }
  &.cols-2 { grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
}
.nc-v2-stack-col {
  @apply flex flex-col min-w-0;
  & + & {
    @apply border-l-1 border-dashed border-nc-border-gray-medium;
  }
}
.nc-v2-stack-group-drop-line {
  @apply h-0.5 mx-3 my-1 rounded-full bg-nc-content-brand;
}
</style>
