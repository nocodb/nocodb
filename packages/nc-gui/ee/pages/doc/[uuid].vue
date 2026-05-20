<script setup lang="ts">
import type { PublicDocTreeNode } from 'nocodb-sdk'

// Defensive walk-depth cap on the deep-link ancestor walk — terminates on a
// malformed parent chain. Document nesting in practice is shallow.
const MAX_ANCESTOR_WALK_DEPTH = 64

/**
 * Public reader for shared docs (/doc/<uuid>).
 *
 * Loads the share manifest (root + subtree titles) on mount, then renders
 * the doc content for the currently-selected node. Subtree navigation is
 * driven by a `?p=<docId>` query param so deep-links to descendants work.
 *
 * Anonymous-friendly: no auth, no headers required.
 */

definePageMeta({
  public: true,
  requiresAuth: false,
})

const route = useRoute()
const router = useRouter()

const { isDark } = useTheme()
const { appInfo } = useGlobal()

const uuid = computed(() => route.params.uuid as string)
// eslint-disable-next-line @typescript-eslint/no-use-before-define
const activeDocId = computed(() => (route.query.p as string) || meta.value?.root?.id)

const {
  meta,
  activeContent,
  isLoading,
  notFound,
  loadMeta,
  loadDoc,
  loadChildren,
  fetchDocInfo,
  isLoadingChildren,
  areChildrenLoaded,
} = useSharedDoc()

const renderableTree = computed<PublicDocTreeNode[]>(() => meta.value?.tree ?? [])

// Map for quick title lookup when rendering breadcrumbs / titles.
const nodesById = computed(() => {
  const m = new Map<string, PublicDocTreeNode>()
  for (const n of renderableTree.value) m.set(n.id, n)
  return m
})

const activeNode = computed(() => (activeDocId.value ? nodesById.value.get(activeDocId.value) : null))

// Tracks which nodes are expanded in the sidebar. Mirrors the in-app docs
// store's expandedDocIds — children are fetched lazily on expand, so a
// node is "expanded" in the UI sense even before its children arrive.
const expandedDocIds = ref<Set<string>>(new Set())

// Reset expansion state and seed with the new root whenever the share root
// changes (navigating between two /doc/<uuid> pages reuses this component,
// so state from the previous share would otherwise leak into the next).
// Root is expanded by default — its children come with the initial manifest.
watch(
  () => meta.value?.root?.id,
  (id) => {
    expandedDocIds.value = id ? new Set([id]) : new Set()
  },
)

// Auto-expand the active doc and all its ancestors in the sidebar so a
// deep-link or in-page navigation reveals the path from the share root.
// Mirrors useDocumentsStore.expandToDocument — limited to ancestors present
// in the tree we already fetched (initial manifest + lazy-loaded children).
watch(
  [activeDocId, renderableTree],
  ([id, tree]) => {
    if (!id || !tree?.length) return
    const byId = new Map<string, PublicDocTreeNode>()
    for (const n of tree) byId.set(n.id, n)

    const node = byId.get(id)
    const next = new Set(expandedDocIds.value)
    if (node?.has_children) next.add(id)
    let cursor: string | null = node?.parent_id ?? null
    while (cursor) {
      next.add(cursor)
      cursor = byId.get(cursor)?.parent_id ?? null
    }
    if (next.size !== expandedDocIds.value.size) {
      expandedDocIds.value = next
    }
  },
  { immediate: true },
)

const sidebarVisible = computed(() => !!meta.value?.include_subtree && renderableTree.value.length > 1)

const updatedAgo = computed(() => {
  const ts = activeContent.value?.updated_at
  return ts ? timeAgo(ts) : ''
})

const docEditorRef = ref<{ editor: any } | null>(null)
const docTitle = computed(() => activeContent.value?.title || activeNode.value?.title || '')

// Build the absolute attachment URL for the markdown export and the cover
// banner. Mirrors the public proxy URL pattern useDocumentImageUpload uses
// for inline <img src>.
const buildAttachmentUrl = (fileRefId: string) => {
  const base = appInfo.value?.ncSiteUrl?.replace(/\/$/, '') ?? ''
  if (!uuid.value || !activeDocId.value || !fileRefId) return ''
  return `${base}/api/v2/public/shared-doc/${uuid.value}/doc/${activeDocId.value}/attachment/${encodeURIComponent(fileRefId)}`
}

// In-app DocEditor renders the cover image in doc mode only — the public
// reader runs the editor in cell mode, so we render the cover here instead
// to keep the shared chrome (cover + icon + title + subtitle) consistent.
const coverImageSrc = computed(() => {
  const refId = activeContent.value?.cover_image_file_ref_id
  return refId ? buildAttachmentUrl(refId) : ''
})

// Resolve the icon to show in the topbar. Prefer the active doc's icon
// (loaded with content); fall back to the tree node so the chrome renders
// the right glyph between the meta and content requests.
const topbarIcon = computed(() => activeContent.value?.icon ?? activeNode.value?.icon ?? meta.value?.root?.icon ?? null)

const editorInstance = computed<any>(() => docEditorRef.value?.editor ?? undefined)

const { downloadMarkdown } = useDocumentExport({
  editor: editorInstance as any,
  title: docTitle,
  imageUrlBuilder: buildAttachmentUrl,
})

// Tell DocImageNode (via useDocumentImageUpload.buildProxyUrl) to route
// attachment URLs through the public endpoint instead of the authed one.
provide(
  PublicDocShareInj,
  computed(() => (uuid.value && activeDocId.value ? { sharedDocUuid: uuid.value, docId: activeDocId.value } : null)),
)

const navigateToDoc = (docId: string) => {
  router.replace({
    query: { ...route.query, p: docId === meta.value?.root?.id ? undefined : docId },
  })
}

// Direct children of the currently-displayed doc — drives the Notion-style
// "Sub documents" panel at the bottom of the body. Sourced from the
// share-scope tree we already fetched (initial manifest + anything the user
// has expanded so far). Empty when subtree share is off, the active doc is
// a leaf, or its children haven't been lazy-loaded yet.
const subDocs = computed<PublicDocTreeNode[]>(() => {
  const id = activeDocId.value
  if (!id) return []
  return renderableTree.value.filter((n) => n.parent_id === id).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
})

// Auto-load children of the currently-viewed doc so the sub-documents panel
// fills in even when the user navigates without expanding the sidebar.
watch(activeDocId, (id) => {
  if (!id || !uuid.value) return
  if (areChildrenLoaded(id)) return
  const node = nodesById.value.get(id)
  // Skip the call for known leaf nodes to avoid a 200 + empty array on
  // every leaf navigation. For unknown nodes (deep links / descendants
  // not yet pulled into the tree), fetch optimistically — the backend
  // returns an empty array for leaves and 404s anything out of scope.
  if (node && !node.has_children) return
  loadChildren(uuid.value, id)
})

// Deep-link path resolver — mirrors useDocumentsStore.expandToDocument over
// the public API. When the active doc isn't yet in the tree (the URL points
// at a sub-document the initial manifest didn't include), walk up from its
// parent_id by repeatedly hitting /content (the public-reader equivalent of
// in-app's `documentGet`); merge each ancestor into the tree and lazy-load
// its children so siblings at every depth render in the sidebar.
watch([activeContent, () => meta.value?.root?.id], async ([content, rootId]) => {
  if (!content || !rootId || !uuid.value) return
  if (content.id === rootId) return

  const parentIdsToLoadChildren: string[] = []
  let cursor: string | null = content.parent_id ?? null

  // Walk up the parent chain. Stop at the share root (already in the
  // initial manifest) or when an ancestor is missing / out of scope.
  let depth = 0
  while (cursor && cursor !== rootId && depth < MAX_ANCESTOR_WALK_DEPTH) {
    depth += 1
    let node = nodesById.value.get(cursor)
    if (!node) {
      const fetched = await fetchDocInfo(uuid.value, cursor)
      if (!fetched) break
      node = fetched
    }
    parentIdsToLoadChildren.push(cursor)
    cursor = (node.parent_id as string | null) ?? null
  }

  // Always pull in siblings of the active doc — its immediate parent's
  // children include the active doc itself, which is how the active row
  // makes it into the tree when it wasn't in the initial manifest.
  if (content.parent_id) parentIdsToLoadChildren.push(content.parent_id)

  const unique = [...new Set(parentIdsToLoadChildren)]
  await Promise.all(unique.map((pid) => loadChildren(uuid.value, pid)))
})

// Build a flat sidebar walking from the share root only — descendants of
// collapsed nodes are hidden, and an "expanded" parent whose children
// aren't loaded yet still renders as expanded (with no rows underneath) so
// the spinner can sit on the chevron while loadChildren resolves.
interface TreeRow {
  node: PublicDocTreeNode
  depth: number
}

const sidebarRows = computed<TreeRow[]>(() => {
  const rootId = meta.value?.root?.id
  if (!rootId) return []

  const childrenByParent = new Map<string | null, PublicDocTreeNode[]>()
  for (const n of renderableTree.value) {
    const key = n.parent_id ?? null
    const list = childrenByParent.get(key) ?? []
    list.push(n)
    childrenByParent.set(key, list)
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  const rows: TreeRow[] = []
  const walk = (parent: string | null, depth: number) => {
    const kids = childrenByParent.get(parent) ?? []
    for (const k of kids) {
      rows.push({ node: k, depth })
      if (expandedDocIds.value.has(k.id)) walk(k.id, depth + 1)
    }
  }
  walk(null, 0)
  return rows
})

const toggleExpand = async (docId: string) => {
  if (!uuid.value) return
  const next = new Set(expandedDocIds.value)
  if (next.has(docId)) {
    next.delete(docId)
    expandedDocIds.value = next
    return
  }
  next.add(docId)
  expandedDocIds.value = next
  // Fetch children if not already loaded. loadChildren itself is a no-op
  // when the parent's children are cached or in flight.
  if (!areChildrenLoaded(docId)) {
    await loadChildren(uuid.value, docId)
  }
}

watch(
  uuid,
  async (id) => {
    if (!id) return
    await loadMeta(id)
  },
  { immediate: true },
)

watch(
  activeDocId,
  async (id) => {
    // Skip content fetch when the meta call already 404'd — otherwise we'd
    // fire a second request that overwrites the not-found state with a
    // no-op load.
    if (!id || notFound.value || !uuid.value) return
    await loadDoc(uuid.value, id)
  },
  { immediate: true },
)
</script>

<template>
  <!-- Revoked share / 404 / 5xx: render the same empty state shared-view
       shows on a broken /nc/view URL (see layouts/shared-view.vue). No
       topbar/sidebar so it feels like a top-level error page, matching
       the in-product 404. -->
  <GeneralPageDoesNotExist v-if="notFound" data-testid="nc-shared-doc-not-found" />

  <div v-else class="nc-shared-doc-page w-full h-full flex flex-col bg-nc-bg-default">
    <!-- Top bar: NOCODB wordmark + doc title + theme toggle. Mirrors the
         shared-view layout header so docs and views feel consistent. -->
    <div
      class="nc-shared-doc-topbar flex items-center justify-between px-3 py-2 border-b-1 border-nc-border-gray-medium shrink-0 h-[46px]"
    >
      <!-- flex-1 + min-w-0 so this left group claims all space opposite
           the right-side action buttons (theme toggle + Download). Without
           it, the group sizes to content, the breadcrumb's `max-w-1/4`
           per segment computes against ~0px, and labels collapse to a
           single character (see /doc/<uuid> demo with "Something" →
           "S"). Mirrors how the in-app .nc-doc-page-menu-left uses
           `absolute left-3 right: 120px` to claim a definite width. -->
      <div class="flex items-center gap-6 h-7 flex-1 min-w-0">
        <a
          class="transition-all duration-200 cursor-pointer transform hover:scale-105"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img v-if="isDark" width="96" alt="NocoDB" src="~/assets/img/brand/text.png" class="flex-none min-w-[96px]" />
          <img v-else width="96" alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="flex-none min-w-[96px]" />
        </a>

        <div class="flex items-center gap-2 text-nc-content-gray-emphasis text-sm truncate flex-1 min-w-0">
          <template v-if="isLoading && !activeContent">
            <span data-testid="nc-loading">{{ $t('general.loading') }}</span>
            <component :is="iconMap.reload" class="animate-infinite animate-spin" />
          </template>

          <!-- Notion-style breadcrumb: share-root → ancestors → current
               page, each with a sibling/descendants dropdown. Ancestors
               come out of `meta.tree` (initial manifest + anything the
               deep-link walker / sidebar expansion has loaded). Mirrors
               the in-app DocBreadcrumb shape — see DocBreadcrumbShared. -->
          <DocBreadcrumbShared
            v-else-if="meta?.root && activeDocId"
            :uuid="uuid"
            :root-node="meta.root"
            :active-doc-id="activeDocId"
            :active-icon="topbarIcon"
            :active-title="docTitle"
            :tree="renderableTree"
            :load-children="loadChildren"
            @select="navigateToDoc"
          />
        </div>
      </div>

      <div class="flex items-center gap-3">
        <DashboardMiniSidebarTheme placement="bottom" render-as-btn />

        <NcButton
          v-if="activeContent"
          v-e="['c:doc:share:download:markdown']"
          size="xs"
          type="secondary"
          data-testid="nc-shared-doc-download"
          @click="downloadMarkdown"
        >
          <div class="flex items-center gap-1">
            <GeneralIcon icon="download" class="!w-3.5 !h-3.5" />
            {{ $t('general.download') }}
          </div>
        </NcButton>
      </div>
    </div>

    <!-- Main split: sidebar + content -->
    <div class="flex-1 flex min-h-0">
      <aside
        v-if="sidebarVisible"
        class="nc-shared-doc-sidebar shrink-0 w-64 border-r-1 border-nc-border-gray-light overflow-y-auto p-2"
      >
        <!-- Mirror the in-app sidebar row (Dashboard/TreeView/Documents/Node.vue):
             same 28px row (min/max-h-7 + py-0.5), 13px/500 type ramp,
             24px icon wrapper with a hover-only chevron overlay, indent ramp of
             8 + min(depth, 8)*8 px, and active state in brand-tinted text +
             bg-primary-selected. The chevron-on-hover hit-target toggles
             expansion; everywhere else on the row navigates. -->
        <div
          v-for="row in sidebarRows"
          :key="row.node.id"
          class="nc-shared-doc-tree-row group !rounded-md !py-0.5 !min-h-7 !max-h-7 !my-0.5 select-none text-nc-content-gray-subtle text-bodyDefaultSm font-medium flex items-center gap-1 cursor-pointer hover:(bg-nc-bg-gray-medium text-nc-content-gray-subtle) transition-all ease-in duration-100"
          :class="{ active: row.node.id === activeDocId }"
          :style="{
            // Mirrors the in-app drag-drop indent unit (List.vue INDENT_PX = 24)
            // so a depth-1 row sits ~24px deeper than its parent, matching what
            // the in-app sidebar shows on the screen.
            paddingInlineStart: `${8 + Math.min(row.depth, 8) * 24}px`,
            paddingInlineEnd: '3px',
          }"
          :data-testid="`nc-shared-doc-tree-${row.node.id}`"
          @click="navigateToDoc(row.node.id)"
        >
          <!-- Icon + chevron overlay. The chevron sits on top of the doc icon and fades in
               on row hover; when there are no children it stays muted and non-interactive,
               so the row still looks consistent at every depth. -->
          <div class="flex items-center min-w-6 h-6 flex-none relative">
            <button
              type="button"
              class="nc-shared-doc-tree-expand absolute inset-0 flex items-center justify-center rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-150 z-10"
              :class="
                row.node.has_children
                  ? 'text-nc-content-gray-subtle2 hover:text-nc-content-gray cursor-pointer'
                  : '!text-nc-content-gray-muted cursor-not-allowed'
              "
              :disabled="!row.node.has_children"
              :data-testid="`nc-shared-doc-tree-expand-${row.node.id}`"
              :aria-expanded="expandedDocIds.has(row.node.id)"
              @click.stop="row.node.has_children && toggleExpand(row.node.id)"
            >
              <GeneralLoader v-if="isLoadingChildren(row.node.id)" class="!w-3.5 !h-3.5" />
              <GeneralIcon
                v-else
                icon="ncChevronRight"
                class="!w-3.5 !h-3.5 transform transition-transform duration-200 text-current"
                :class="{ '!rotate-90': expandedDocIds.has(row.node.id) }"
              />
            </button>
            <div class="flex items-center group-hover:opacity-0 transition-opacity duration-150 pointer-events-none">
              <LazyGeneralEmojiPicker
                :key="row.node.icon ?? ''"
                :emoji="row.node.icon ?? undefined"
                :readonly="true"
                size="small"
                class="!text-[16px]"
              >
                <template #default>
                  <GeneralIcon
                    icon="ncFileText"
                    class="!w-4 !text-[16px]"
                    :class="row.node.id === activeDocId ? '!text-nc-brand-600/85' : '!text-nc-gray-600/75'"
                  />
                </template>
              </LazyGeneralEmojiPicker>
            </div>
          </div>
          <span
            class="truncate"
            :class="{ 'font-medium text-nc-content-brand-disabled': row.node.id === activeDocId }"
            :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap' }"
          >
            {{ row.node.title }}
          </span>
        </div>
      </aside>

      <main class="flex-1 min-w-0 overflow-y-auto">
        <div v-if="isLoading && !activeContent" class="max-w-[900px] mx-auto px-10 pt-12 text-center text-nc-content-gray-subtle">
          {{ $t('general.loading') }}…
        </div>
        <template v-else-if="activeContent">
          <!-- Cover banner — mirrors DocEditor's doc-mode cover (full-width
               240px image). Editor renders the cover only in doc mode and
               the public reader runs the editor in cell mode, so we draw
               the banner ourselves above the title row. -->
          <div v-if="coverImageSrc" class="nc-shared-doc-cover" data-testid="nc-shared-doc-cover">
            <img :src="coverImageSrc" class="nc-shared-doc-cover-image" alt="" />
          </div>
          <!-- Title row mirrors DocEditor's inner container (max-w 900 + px-10)
               so it aligns with the prose body below, and uses the same icon
               + title + updated-ago shape DocEditor renders in doc mode. -->
          <div class="max-w-[900px] mx-auto px-10 pb-4" :class="coverImageSrc ? 'pt-8' : 'pt-12'">
            <div class="nc-doc-title-row flex items-center">
              <div class="nc-doc-editor-icon-wrapper">
                <LazyGeneralEmojiPicker
                  :key="activeContent.icon ?? ''"
                  :emoji="activeContent.icon ?? undefined"
                  :readonly="true"
                  class="nc-doc-editor-icon"
                  size="large"
                >
                  <template #default>
                    <GeneralIcon class="text-nc-content-gray-muted !w-7 !h-7" icon="ncFileText" />
                  </template>
                </LazyGeneralEmojiPicker>
              </div>
              <h1 class="nc-doc-title text-3xl font-semibold text-nc-content-gray-extreme m-0">
                {{ activeContent.title || activeNode?.title || $t('general.untitled') }}
              </h1>
            </div>
            <div v-if="updatedAgo" class="nc-doc-subtitle mt-2 text-sm text-nc-content-gray-muted">
              {{ $t('general.updated') }} {{ updatedAgo }}
            </div>
          </div>
          <!-- Read-only PM renderer. `mode='cell' + embedded` makes it take
               content from `initialContent` and skip its breadcrumb / page
               actions; the editor still applies its own 900px max-width and
               px-10 padding internally. -->
          <LazyDocEditor
            :key="activeContent.id"
            ref="docEditorRef"
            mode="cell"
            embedded
            :initial-content="activeContent.content"
            :read-only="true"
          />
          <!-- "Sub documents" panel — mirrors components/doc/SubDocumentsList.vue
               for anonymous reads. The in-app version reads from the docs
               store; here we use the share-scope tree we already loaded. -->
          <!-- pt-2 (vs pt-8 in the in-app component) — DocEditor in
               cell+embedded mode leaves less trailing whitespace than doc
               mode, so the in-app spacing reads as too much here. -->
          <div
            v-if="subDocs.length"
            class="max-w-[900px] mx-auto px-10 nc-shared-doc-sub-documents pt-2 pb-12"
            data-testid="nc-shared-doc-sub-documents"
          >
            <div class="nc-shared-doc-sub-documents-header">
              <span class="nc-shared-doc-sub-documents-title">{{ $t('labels.subDocuments') }}</span>
            </div>
            <div class="nc-shared-doc-sub-documents-list mt-2">
              <div
                v-for="child in subDocs"
                :key="child.id"
                v-e="['c:doc:share:sub-document:open']"
                class="nc-shared-doc-sub-documents-item"
                :data-testid="`nc-shared-doc-sub-documents-item-${child.id}`"
                @click="navigateToDoc(child.id)"
              >
                <div class="nc-shared-doc-sub-documents-icon">
                  <LazyGeneralEmojiPicker
                    :key="child.icon ?? ''"
                    :emoji="child.icon ?? undefined"
                    :readonly="true"
                    size="xsmall"
                    class="!text-[16px]"
                  >
                    <template #default>
                      <GeneralIcon icon="ncFileText" class="!text-[16px] text-nc-content-gray-subtle" />
                    </template>
                  </LazyGeneralEmojiPicker>
                </div>
                <span class="nc-shared-doc-sub-documents-name truncate">
                  {{ child.title || $t('general.untitled') }}
                </span>
              </div>
            </div>
          </div>
        </template>
      </main>
    </div>

    <!-- Noindex meta (Phase 1: always set) -->
    <Head>
      <Meta name="robots" content="noindex, nofollow" />
      <Title>{{ activeContent?.title || meta?.root?.title || 'Shared Document' }}</Title>
    </Head>
  </div>
</template>

<style lang="scss" scoped>
.nc-shared-doc-sidebar {
  background: var(--nc-bg-default);
}

.nc-shared-doc-tree-row {
  user-select: none;

  // Match the in-app active row (ee/components/dashboard/TreeView/Documents/List.vue
  // .nc-documents-menu .active): primary-selected tint in light mode,
  // gray-medium in dark, with a slightly heavier font weight.
  &.active {
    @apply !bg-primary-selected dark:!bg-nc-bg-gray-medium font-medium;
  }
}

// Match DocEditor's cover styling (240px banner, cover-fit). Kept in sync
// with .nc-doc-cover / .nc-doc-cover-image so doc and shared views feel
// the same.
.nc-shared-doc-cover {
  width: 100%;
  height: 240px;
  min-height: 240px;
  flex-shrink: 0;
  overflow: hidden;
}

.nc-shared-doc-cover-image {
  width: 100%;
  height: 240px;
  object-fit: cover;
  object-position: center;
}

// "Sub documents" panel — kept in sync with components/doc/SubDocumentsList.vue
// so the public reader matches the in-app feel.
.nc-shared-doc-sub-documents-header {
  border-bottom: 1px solid var(--nc-border-gray-medium);
}

.nc-shared-doc-sub-documents-title {
  display: inline-block;
  padding-bottom: 6px;
  border-bottom: 2px solid var(--nc-content-gray);
  margin-bottom: -1px;
  @apply text-sm font-semibold text-nc-content-gray;
}

.nc-shared-doc-sub-documents-item {
  @apply flex items-center gap-2 px-1.5 py-1 rounded-md cursor-pointer text-bodyDefaultSm text-nc-content-gray;

  &:hover {
    background: var(--nc-bg-gray-light);
  }
}

.nc-shared-doc-sub-documents-icon {
  @apply flex items-center justify-center w-5 h-5 flex-none;
}

.nc-shared-doc-sub-documents-name {
  @apply flex-1;
}

// DocEditor internals override (public reader only).
//
// DocEditor is built around an internal scroll area — outer `h-full
// overflow-hidden` + inner `h-full overflow-y-auto` so the prose body
// scrolls while the topbar / cover stay pinned. That model breaks here
// because the "Sub documents" panel is a SIBLING of LazyDocEditor inside
// <main>, so the editor taking 100% of main's height pushes the panel
// below the scroll bottom.
//
// Overrides via `:deep()` (Vue's scoped attribute doesn't reach the
// editor's children otherwise) — anchored to .nc-shared-doc-page so no
// other DocEditor mount in the app is affected:
//   - `.nc-doc-editor-body { padding-bottom: 1rem }` trims the editor's
//     `pb-48` empty-state buffer (the `hasSubDocuments` flag reads from
//     useDocumentsStore, which the public reader doesn't populate).
//   - `height: auto` / `overflow: visible` on the editor's outer wrapper
//     + inner scroll area lets <main>'s overflow-y-auto handle all
//     scrolling (cover, content, sub-docs panel scroll as one).
:deep(.nc-doc-editor-body) {
  padding-bottom: 1rem !important;
}

:deep(.nc-doc-editor),
:deep(.nc-doc-editor > .relative),
:deep(.nc-doc-editor .nc-scrollbar-thin) {
  height: auto !important;
  overflow: visible !important;
}
</style>
