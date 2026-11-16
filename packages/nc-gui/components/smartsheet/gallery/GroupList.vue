<script setup lang="ts">
import type { Group, Row } from '~/lib/types'

interface Props {
  parent: Group
  /** Groups start collapsed; the expanded ones persist per view. */
  expandedKeys: Set<string>
  pageSize: number
  groupPageSize: number
  scrollRoot?: HTMLElement | null
  /** Used to size not-yet-loaded groups, so only groups near the viewport load. */
  cardHeight: number
  columnsPerRow: number
  depth?: number
}

const props = withDefaults(defineProps<Props>(), {
  depth: 0,
})

defineSlots<{
  card(props: { record: Row }): any
}>()

const { meta } = useSmartsheetStoreOrThrow()

const view = inject(ActiveViewInj, ref())

const { loadGroups, loadMoreGroupRows } = useViewGroupByOrThrow()

const loadingKeys = reactive(new Set<string>())

// A failed load stays failed until Retry, so an always-visible trigger can't loop on it.
const failedKeys = reactive(new Set<string>())

const listEl = ref<HTMLElement>()

// Top-level group whose header is stuck with cards scrolling under it.
const stuckGroupPath = ref<string | null>(null)

const loadedGroupCount = computed(() => props.parent.children?.length ?? 0)

const totalGroupCount = computed(() => props.parent.paginationData?.totalRows ?? loadedGroupCount.value)

const hasMoreGroups = computed(() => loadedGroupCount.value < totalGroupCount.value)

function groupPath(group: Group) {
  return group.nestedIn.map((n) => `${n.column_id ?? n.title}:${n.key}`).join('/')
}

/** Same key format the canvas grid stores its expanded groups under. */
function expansionKey(group: Group) {
  return group.nestedIn.map((n) => `${n.key}-${n.column_name}`).join('_')
}

function isCollapsed(group: Group) {
  return !props.expandedKeys.has(expansionKey(group))
}

function hasMoreRows(group: Group) {
  return !group.rows || group.rows.length < group.count
}

function placeholderHeight(group: Group) {
  const rows = Math.ceil(Math.min(group.count, props.pageSize) / Math.max(1, props.columnsPerRow))
  return rows * (props.cardHeight + 12)
}

function rowKey(record: Row, index: number) {
  return extractPkFromRow(record.row, meta.value?.columns ?? []) || `idx-${index}`
}

async function withLoading(key: string, fn: () => Promise<boolean | undefined>) {
  if (loadingKeys.has(key) || failedKeys.has(key)) return
  loadingKeys.add(key)
  try {
    if ((await fn()) === false) failedKeys.add(key)
  } finally {
    loadingKeys.delete(key)
  }
}

function canLoad(key: string) {
  return !loadingKeys.has(key) && !failedKeys.has(key)
}

function retry(key: string, load: () => unknown) {
  failedKeys.delete(key)
  load()
}

function loadChildren(group: Group) {
  if (group.children || isCollapsed(group)) return
  return withLoading(groupPath(group), () => loadGroups({}, group))
}

function loadRows(group: Group) {
  if (!hasMoreRows(group) || isCollapsed(group)) return
  // A full first page paints fast; later pages are larger to cut round trips.
  const limit = group.rows?.length ? props.pageSize * 2 : props.pageSize
  return withLoading(groupPath(group), () => loadMoreGroupRows(group, limit, { lean: true }))
}

function loadMoreGroups() {
  return withLoading(`${groupPath(props.parent)}#groups`, () =>
    loadGroups({ offset: 0, limit: loadedGroupCount.value + props.groupPageSize }, props.parent),
  )
}

function updateStuckHeader() {
  if (props.depth || !props.scrollRoot || !listEl.value) return
  const top = props.scrollRoot.getBoundingClientRect().top
  let stuck: string | null = null
  for (const el of listEl.value.querySelectorAll<HTMLElement>(':scope > .nc-gallery-group')) {
    const rect = el.getBoundingClientRect()
    if (rect.top < top - 1 && rect.bottom > top + 44) {
      stuck = el.dataset.groupPath ?? null
      break
    }
  }
  stuckGroupPath.value = stuck
}

function toggleGroup(group: Group) {
  const key = expansionKey(group)
  const expand = !props.expandedKeys.has(key)
  if (expand) props.expandedKeys.add(key)
  else props.expandedKeys.delete(key)
  groupKeysManager.toggleKey(view.value?.base_id, view.value?.id, key, expand)
}

let stuckRaf = false

useEventListener(
  () => props.scrollRoot,
  'scroll',
  () => {
    if (stuckRaf) return
    stuckRaf = true
    requestAnimationFrame(() => {
      stuckRaf = false
      updateStuckHeader()
    })
  },
  { passive: true },
)
</script>

<template>
  <div ref="listEl" class="nc-gallery-group-list flex flex-col" :class="depth ? 'gap-2' : 'gap-3'">
    <section
      v-for="group of parent.children ?? []"
      :key="groupPath(group)"
      :data-group-path="groupPath(group)"
      class="nc-gallery-group rounded-xl border-1 border-nc-border-gray-medium"
      :class="depth % 2 ? 'bg-nc-bg-gray-extralight' : 'bg-nc-bg-default'"
      :data-testid="`nc-gallery-group-${group.key}`"
    >
      <div
        role="button"
        tabindex="0"
        class="nc-gallery-group-header flex items-center gap-2 h-11 px-3 cursor-pointer select-none rounded-xl"
        :class="{
          'sticky top-0 z-20 bg-nc-bg-default': depth === 0,
          'nc-gallery-group-header-stuck': depth === 0 && stuckGroupPath === groupPath(group),
          'rounded-b-none': !isCollapsed(group),
        }"
        :aria-expanded="!isCollapsed(group)"
        :aria-label="isCollapsed(group) ? $t('labels.expandGroup') : $t('labels.collapseGroup')"
        @click="toggleGroup(group)"
        @keydown.enter.prevent="toggleGroup(group)"
        @keydown.space.prevent="toggleGroup(group)"
      >
        <GeneralIcon
          icon="chevronDown"
          class="flex-none w-4 h-4 text-nc-content-gray-subtle transition-transform"
          :class="{ '-rotate-90': isCollapsed(group) }"
        />
        <SmartsheetGalleryGroupValue :group="group" class="flex-1" />
        <span class="nc-gallery-group-count flex-none text-xs text-nc-content-gray-muted">
          {{ $t('datatype.Count') }}
          <span class="ml-1 text-nc-content-gray-subtle tabular-nums">{{ group.count }}</span>
        </span>
      </div>

      <template v-if="!isCollapsed(group)">
        <div v-if="group.nested" class="px-3 pb-3">
          <SmartsheetGalleryGroupList
            v-if="group.children"
            :parent="group"
            :expanded-keys="expandedKeys"
            :page-size="pageSize"
            :group-page-size="groupPageSize"
            :scroll-root="scrollRoot"
            :card-height="cardHeight"
            :columns-per-row="columnsPerRow"
            :depth="depth + 1"
          >
            <template #card="slotProps">
              <slot name="card" v-bind="slotProps" />
            </template>
          </SmartsheetGalleryGroupList>
          <div v-else class="flex justify-center py-4">
            <NcButton
              v-if="failedKeys.has(groupPath(group))"
              size="xs"
              type="secondary"
              data-testid="nc-gallery-group-retry"
              @click.stop="retry(groupPath(group), () => loadChildren(group))"
            >
              {{ $t('general.retry') }}
            </NcButton>
            <GeneralLoader v-else size="regular" />
          </div>
          <SmartsheetGalleryLoadTrigger
            v-if="!group.children"
            :active="canLoad(groupPath(group))"
            :root="scrollRoot"
            @load="loadChildren(group)"
          />
        </div>

        <div
          v-else-if="!group.rows"
          class="nc-gallery-group-placeholder relative flex justify-center pt-6"
          :style="{ height: `${placeholderHeight(group)}px` }"
        >
          <!-- Covers the whole placeholder: a jump past its top edge still loads the group. -->
          <SmartsheetGalleryLoadTrigger
            class="absolute inset-0 !h-full"
            :active="canLoad(groupPath(group))"
            :root="scrollRoot"
            @load="loadRows(group)"
          />
          <NcButton
            v-if="failedKeys.has(groupPath(group))"
            size="xs"
            type="secondary"
            class="relative"
            data-testid="nc-gallery-group-retry"
            @click.stop="retry(groupPath(group), () => loadRows(group))"
          >
            {{ $t('general.retry') }}
          </NcButton>
          <GeneralLoader v-else size="regular" />
        </div>

        <template v-else>
          <div v-if="group.rows.length" class="nc-gallery-group-grid grid gap-3 px-3 pb-3">
            <SmartsheetGalleryCardSlot
              v-for="(record, index) of group.rows"
              :key="rowKey(record, index)"
              :root="scrollRoot"
              :estimated-height="cardHeight"
            >
              <slot name="card" :record="record" />
            </SmartsheetGalleryCardSlot>
          </div>

          <div v-if="loadingKeys.has(groupPath(group))" class="flex justify-center pb-3">
            <GeneralLoader size="regular" />
          </div>
          <div v-else-if="hasMoreRows(group)" class="flex justify-center pb-3">
            <NcButton
              size="xs"
              type="text"
              data-testid="nc-gallery-group-load-more"
              @click.stop="retry(groupPath(group), () => loadRows(group))"
            >
              {{ $t('general.loadMore') }}
              <span class="ml-1 text-nc-content-gray-muted tabular-nums">({{ group.count - group.rows.length }})</span>
            </NcButton>
          </div>

          <SmartsheetGalleryLoadTrigger
            :active="hasMoreRows(group) && canLoad(groupPath(group))"
            :root="scrollRoot"
            @load="loadRows(group)"
          />
        </template>
      </template>
    </section>

    <div v-if="hasMoreGroups" class="flex justify-center">
      <GeneralLoader v-if="loadingKeys.has(`${groupPath(parent)}#groups`)" size="regular" />
      <NcButton
        v-else
        size="xs"
        type="secondary"
        data-testid="nc-gallery-load-more-groups"
        @click="retry(`${groupPath(parent)}#groups`, loadMoreGroups)"
      >
        {{ $t('general.loadMore') }}
        <span class="ml-1 text-nc-content-gray-muted tabular-nums">({{ totalGroupCount - loadedGroupCount }})</span>
      </NcButton>
    </div>
    <SmartsheetGalleryLoadTrigger
      v-if="hasMoreGroups"
      :active="canLoad(`${groupPath(parent)}#groups`)"
      :root="scrollRoot"
      @load="loadMoreGroups"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-gallery-group-header-stuck {
  box-shadow: 0 4px 6px -4px rgba(0, 0, 0, 0.12);
}

:global([theme='dark'] .nc-gallery-group-header-stuck) {
  box-shadow: 0 4px 8px -4px rgba(0, 0, 0, 0.6);
}

.nc-gallery-group-grid {
  // auto-fill keeps a lone card at track width instead of stretching it across the row.
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
}
</style>
