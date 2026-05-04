<script setup lang="ts">
import type { BookmarkGroupType, BookmarkType } from 'nocodb-sdk'

interface Props {
  groups: BookmarkGroupType[]
  bookmarksByGroup: Record<string, BookmarkType[]>
}

const props = defineProps<Props>()

const { groups, bookmarksByGroup } = toRefs(props)

const emit = defineEmits<{ navigate: [bookmark: BookmarkType] }>()

// Round-robin into 2 columns so heights stay balanced
const columnGroups = computed(() => {
  const cols: BookmarkGroupType[][] = [[], []]
  groups.value.forEach((g, i) => cols[i % 2].push(g))
  return cols
})
</script>

<template>
  <div class="nc-v2-card-layout">
    <div v-for="(col, ci) in columnGroups" :key="ci" class="nc-v2-card-col">
      <BookmarksV2CardGroup
        v-for="group in col"
        :key="group.id"
        :group="group"
        :bookmarks="bookmarksByGroup[group.id!] ?? []"
        :all-groups="groups"
        @navigate="(bm) => emit('navigate', bm)"
      />
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-v2-card-layout {
  @apply grid gap-2 px-3 py-3;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}
.nc-v2-card-col {
  @apply flex flex-col gap-2 min-w-0;
}
</style>
