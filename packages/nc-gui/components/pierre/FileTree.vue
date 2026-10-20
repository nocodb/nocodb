<script setup lang="ts">
import { FileTree } from '@pierre/trees'
import type { GitStatusEntry } from '@pierre/trees'

/**
 * A file tree over a flat list of repo-relative paths, rendered by
 * `@pierre/trees`.
 *
 * The library builds the directory structure from the paths themselves, so
 * callers hand over the flat list `git ls-files` gives them and nothing else.
 */

interface Props {
  /** Repo-relative file paths. Directories are inferred from the segments. */
  paths: string[]
  /** Per-path git status, drawn in the tree's own status lane. */
  gitStatus?: GitStatusEntry[]
  /** Show the built-in search field. */
  search?: boolean
  /** How much of the tree opens on first render. */
  initialExpansion?: 'closed' | 'open' | number
}

const props = withDefaults(defineProps<Props>(), {
  search: true,
  // Every directory open would bury a monorepo's changed files; the first level
  // is enough to see the shape and start navigating.
  initialExpansion: 1,
})

const emit = defineEmits<{
  /** A file row was picked. Directory rows never reach this. */
  select: [path: string]
}>()

const { isDark } = useTheme()

const root = ref<HTMLDivElement>()

let tree: FileTree | undefined

/** The library reports selection changes only, so a click on the already selected file is picked up here. */
let selectionChanged = false

function onPointerDown() {
  selectionChanged = false
}

function onClick(event: MouseEvent) {
  if (selectionChanged) return

  const row = event
    .composedPath()
    .find((node): node is HTMLElement => node instanceof HTMLElement && node.dataset.itemType === 'file')
  const path = row?.dataset.itemPath

  if (path) emit('select', path)
}

onMounted(() => {
  if (!root.value) return

  tree = new FileTree({
    paths: props.paths,
    gitStatus: props.gitStatus,
    search: props.search,
    initialExpansion: props.initialExpansion,
    // The library declares `light dark` and so follows the OS; this follows the app's theme instead.
    unsafeCSS: '*, :host { color-scheme: inherit !important; }',
    onSelectionChange: (paths) => {
      selectionChanged = true

      const path = paths[0]

      // Directory rows select too; they have nothing to open.
      if (!path || path.endsWith('/')) return

      emit('select', path)
    },
  })

  tree.render({ containerWrapper: root.value })
})

onBeforeUnmount(() => {
  tree?.cleanUp()
  tree = undefined
})

watch(
  () => props.paths,
  (paths) => tree?.resetPaths(paths),
)

watch(
  () => props.gitStatus,
  (gitStatus) => tree?.setGitStatus(gitStatus),
  { deep: true },
)

defineExpose({
  openSearch: () => tree?.openSearch(),
  scrollToPath: (path: string) => tree?.scrollToPath(path, { focus: true }),
})
</script>

<template>
  <div
    ref="root"
    class="nc-pierre-file-tree h-full w-full"
    :style="{ colorScheme: isDark ? 'dark' : 'light' }"
    data-testid="nc-pierre-file-tree"
    @pointerdown.capture="onPointerDown"
    @click="onClick"
  />
</template>

<style lang="scss">
/* The library's overrides inherit through its shadow root; mapped onto the app's tokens. */
.nc-pierre-file-tree {
  --trees-bg-override: var(--nc-bg-default);
  --trees-fg-override: var(--nc-content-gray);
  --trees-fg-muted-override: var(--nc-content-gray-muted);
  --trees-bg-muted-override: var(--nc-bg-gray-light);
  --trees-selected-bg-override: var(--nc-bg-gray-light);
  --trees-selected-fg-override: var(--nc-content-gray-emphasis);
  --trees-border-color-override: var(--nc-border-gray-medium);
  --trees-input-bg-override: var(--nc-bg-default);
  --trees-search-bg-override: var(--nc-bg-default);
  --trees-search-fg-override: var(--nc-content-gray);
  --trees-focus-ring-color-override: var(--nc-border-brand);
  --trees-font-family-override: inherit;
  --trees-font-size-override: 13px;
  --trees-padding-inline-override: 8px;
  --trees-git-added-color-override: var(--nc-content-green-dark);
  --trees-status-added-override: var(--nc-content-green-dark);
  --trees-git-untracked-color-override: var(--nc-content-green-dark);
  --trees-status-untracked-override: var(--nc-content-green-dark);
  --trees-git-deleted-color-override: var(--nc-content-red-dark);
  --trees-status-deleted-override: var(--nc-content-red-dark);
  --trees-git-modified-color-override: var(--nc-content-orange-dark);
  --trees-status-modified-override: var(--nc-content-orange-dark);
  --trees-git-renamed-color-override: var(--nc-content-orange-dark);
  --trees-status-renamed-override: var(--nc-content-orange-dark);
}
</style>
