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

const root = ref<HTMLDivElement>()

let tree: FileTree | undefined

onMounted(() => {
  if (!root.value) return

  tree = new FileTree({
    paths: props.paths,
    gitStatus: props.gitStatus,
    search: props.search,
    initialExpansion: props.initialExpansion,
    onSelectionChange: (paths) => {
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
  <div ref="root" class="h-full w-full" data-testid="nc-pierre-file-tree" />
</template>
