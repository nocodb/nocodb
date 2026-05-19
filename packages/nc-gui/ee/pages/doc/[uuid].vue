<script setup lang="ts">
import type { PublicDocNode } from 'nocodb-sdk'

/**
 * Public reader for shared docs (/doc/<uuid>).
 *
 * Loads the share manifest (root + subtree titles) on mount, then renders
 * the doc content for the currently-selected node. Subtree navigation is
 * driven by a `?p=<docId>` query param so deep-links to descendants work.
 *
 * Anonymous-friendly: no auth, no headers required unless the share is
 * password-protected.
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
const activeDocId = computed(() => (route.query.p as string) || meta.value?.root?.id)

const {
  meta,
  activeContent,
  isLoading,
  requiresPassword,
  password,
  setPassword,
  loadMeta,
  loadDoc,
} = useSharedDoc()

const passwordInput = ref('')
const passwordError = ref(false)

const renderableTree = computed<PublicDocNode[]>(() => meta.value?.tree ?? [])

// Map for quick title lookup when rendering breadcrumbs / titles.
const nodesById = computed(() => {
  const m = new Map<string, PublicDocNode>()
  for (const n of renderableTree.value) m.set(n.id, n)
  return m
})

const activeNode = computed(() =>
  activeDocId.value ? nodesById.value.get(activeDocId.value) : null,
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
  const qs = password.value ? `?xc-password=${encodeURIComponent(password.value)}` : ''
  return `${base}/api/v2/public/shared-doc/${uuid.value}/doc/${activeDocId.value}/attachment/${encodeURIComponent(fileRefId)}${qs}`
}

// In-app DocEditor renders the cover image in doc mode only — the public
// reader runs the editor in cell mode, so we render the cover here instead
// to keep the shared chrome (cover + icon + title + subtitle) consistent.
const coverImageSrc = computed(() => {
  const refId = activeContent.value?.cover_image_file_ref_id
  return refId ? buildAttachmentUrl(refId) : ''
})

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
  computed(() =>
    uuid.value && activeDocId.value
      ? { sharedDocUuid: uuid.value, docId: activeDocId.value, password: password.value }
      : null,
  ),
)

const submitPassword = async () => {
  setPassword(passwordInput.value)
  passwordError.value = false
  const ok = await loadMeta(uuid.value)
  if (!ok) passwordError.value = true
}

const navigateToDoc = (docId: string) => {
  router.replace({
    query: { ...route.query, p: docId === meta.value?.root?.id ? undefined : docId },
  })
}

// Build a flat sidebar with simple indentation by parent_id depth. Anything
// fancier (collapsible nodes, drag, etc.) can come later — this is the
// minimum needed for navigation.
interface TreeRow {
  node: PublicDocNode
  depth: number
}

const sidebarRows = computed<TreeRow[]>(() => {
  const rows: TreeRow[] = []
  const childrenByParent = new Map<string | null, PublicDocNode[]>()
  for (const n of renderableTree.value) {
    const key = n.parent_id ?? null
    const list = childrenByParent.get(key) ?? []
    list.push(n)
    childrenByParent.set(key, list)
  }
  for (const list of childrenByParent.values()) {
    list.sort((a, b) => (a.order || 0) - (b.order || 0))
  }

  const walk = (parent: string | null, depth: number) => {
    const kids = childrenByParent.get(parent) ?? []
    for (const k of kids) {
      rows.push({ node: k, depth })
      walk(k.id, depth + 1)
    }
  }

  walk(null, 0)
  return rows
})

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
    if (!id || requiresPassword.value || !uuid.value) return
    await loadDoc(uuid.value, id)
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-shared-doc-page w-full h-full flex flex-col bg-nc-bg-default">
    <!-- Top bar: NOCODB wordmark + doc title + theme toggle. Mirrors the
         shared-view layout header so docs and views feel consistent. -->
    <div
      class="nc-shared-doc-topbar flex items-center justify-between px-3 py-2 border-b-1 border-nc-border-gray-medium shrink-0 h-[46px]"
    >
      <div class="flex items-center gap-6 h-7 max-w-[calc(100%_-_120px)]">
        <a
          class="transition-all duration-200 cursor-pointer transform hover:scale-105"
          href="https://github.com/nocodb/nocodb"
          target="_blank"
          rel="noopener noreferrer"
        >
          <img v-if="isDark" width="96" alt="NocoDB" src="~/assets/img/brand/text.png" class="flex-none min-w-[96px]" />
          <img v-else width="96" alt="NocoDB" src="~/assets/img/brand/nocodb.png" class="flex-none min-w-[96px]" />
        </a>

        <div class="flex items-center gap-2 text-nc-content-gray-emphasis text-sm truncate">
          <template v-if="isLoading && !activeContent">
            <span data-testid="nc-loading">{{ $t('general.loading') }}</span>
            <component :is="iconMap.reload" class="animate-infinite animate-spin" />
          </template>

          <div v-else class="text-sm font-semibold truncate flex gap-2 items-center">
            <GeneralIcon icon="ncFileText" class="!w-4 !h-4 ml-0.5 text-nc-content-gray-subtle" />
            <span class="truncate">{{ activeContent?.title || activeNode?.title || meta?.root?.title || $t('general.untitled') }}</span>
          </div>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <DashboardMiniSidebarTheme placement="bottom" render-as-btn />

        <NcButton
          v-if="activeContent && !requiresPassword"
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

    <!-- Password gate -->
    <div
      v-if="requiresPassword"
      class="flex-1 flex items-center justify-center px-4"
      data-testid="nc-shared-doc-password-gate"
    >
      <div class="w-full max-w-sm flex flex-col gap-3 p-6 rounded-lg border-1 border-nc-border-gray-medium">
        <div class="flex items-center gap-2">
          <GeneralIcon icon="ncLock" class="text-nc-content-gray-subtle" />
          <div class="font-medium">{{ $t('msg.info.docShareEnterPassword') }}</div>
        </div>
        <a-input-password
          v-model:value="passwordInput"
          :placeholder="$t('placeholder.password.enter')"
          autocomplete="current-password"
          data-testid="nc-shared-doc-password-input"
          @press-enter="submitPassword"
        />
        <div v-if="passwordError" class="text-bodySm text-nc-content-red-dark">
          {{ $t('msg.error.invalidPassword') }}
        </div>
        <NcButton
          type="primary"
          :disabled="!passwordInput"
          data-testid="nc-shared-doc-password-submit"
          @click="submitPassword"
        >
          {{ $t('general.continue') }}
        </NcButton>
      </div>
    </div>

    <!-- Main split: sidebar + content -->
    <div v-else class="flex-1 flex min-h-0">
      <aside
        v-if="sidebarVisible"
        class="nc-shared-doc-sidebar shrink-0 w-64 border-r-1 border-nc-border-gray-light overflow-y-auto p-2"
      >
        <div
          v-for="row in sidebarRows"
          :key="row.node.id"
          class="nc-shared-doc-tree-row flex items-center gap-1 px-2 py-1 rounded cursor-pointer hover:bg-nc-bg-gray-light"
          :class="{ 'bg-nc-bg-gray-light font-medium': row.node.id === activeDocId }"
          :style="{ paddingInlineStart: `${row.depth * 12 + 8}px` }"
          :data-testid="`nc-shared-doc-tree-${row.node.id}`"
          @click="navigateToDoc(row.node.id)"
        >
          <GeneralIcon icon="ncFileText" class="!w-3.5 !h-3.5 text-nc-content-gray-subtle" />
          <span class="truncate text-bodySm">{{ row.node.title }}</span>
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
          <div
            class="max-w-[900px] mx-auto px-10 pb-4"
            :class="coverImageSrc ? 'pt-8' : 'pt-12'"
          >
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
</style>
