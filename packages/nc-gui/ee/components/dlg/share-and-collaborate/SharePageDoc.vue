<script lang="ts" setup>
import { getDocShareMeta, PermissionEntity, PermissionKey } from 'nocodb-sdk'

const { dashboardUrl } = useDashboard()

const documentsStore = useDocumentsStore()
const { activeDocument } = storeToRefs(documentsStore)
const { applyDocPatch } = documentsStore

const { isPrivateBase } = storeToRefs(useBase())
const { activeProjectId } = storeToRefs(useBases())
const { activeWorkspaceId } = storeToRefs(useWorkspace())
const { showShareModal } = storeToRefs(useShare())

const { t } = useI18n()
const { $api, $e } = useNuxtApp()

const isUpdating = ref({
  public: false,
  subtree: false,
  visibility: false,
})

const restrictedSharing = computed(() => isPrivateBase.value)

// Public sharing is blocked when the doc has custom DOCUMENT_VISIBILITY
// permissions. The owner deliberately restricted who can see this doc
// inside the workspace; handing the world a public URL would bypass that
// restriction. Backend share endpoint enforces the same rule — this flag
// is purely UX so the toggle can be disabled up-front instead of failing
// after the user clicks. Edit-only permissions don't block; only
// visibility (`has_visibility_permission`) matters here.
const isBlockedByVisibility = computed(() => !!activeDocument.value?.has_visibility_permission)

const isPublicShared = computed(() => {
  if (restrictedSharing.value) return false
  return !!activeDocument.value?.uuid
})

const includeSubtree = computed(() => {
  // Default true when share is enabled — backend seeds this on first share.
  return getDocShareMeta(activeDocument.value?.meta).include_subtree ?? true
})

const url = computed(() => sharedDocUrl() ?? '')

function sharedDocUrl() {
  if (!activeDocument.value?.uuid) return null
  return `${dashboardUrl.value}/doc/${activeDocument.value.uuid}`
}

const toggleShare = async () => {
  const docId = activeDocument.value?.id
  const baseId = activeProjectId.value
  if (!docId || !baseId) return
  if (isUpdating.value.public) return

  isUpdating.value.public = true
  try {
    if (isPublicShared.value) {
      await $api.internal.postOperation(activeWorkspaceId.value!, baseId, { operation: 'documentUnshare' }, { docId })
      $e('c:doc:share:disable')
      applyDocPatch(baseId, docId, { uuid: null })
      message.toast(t('msg.info.docShareDisabled'))
    } else {
      const res = (await $api.internal.postOperation(
        activeWorkspaceId.value!,
        baseId,
        { operation: 'documentShare' },
        { docId },
      )) as { uuid: string; include_subtree: boolean }
      $e('c:doc:share:enable')
      const meta = {
        ...(activeDocument.value?.meta ?? {}),
        share: { include_subtree: res.include_subtree },
      }
      applyDocPatch(baseId, docId, { uuid: res.uuid, meta })
      message.toast(t('msg.info.docShareEnabled'))
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.public = false
  }
}

const toggleSubtree = async () => {
  const docId = activeDocument.value?.id
  const baseId = activeProjectId.value
  if (!docId || !baseId) return
  if (isUpdating.value.subtree) return

  const nextValue = !includeSubtree.value
  isUpdating.value.subtree = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value!,
      baseId,
      { operation: 'documentShareUpdate' },
      { docId, include_subtree: nextValue },
    )
    $e('c:doc:share:subtree:toggle', { include_subtree: nextValue })
    const meta = {
      ...(activeDocument.value?.meta ?? {}),
      share: { ...getDocShareMeta(activeDocument.value?.meta), include_subtree: nextValue },
    }
    applyDocPatch(baseId, docId, { meta })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.subtree = false
  }
}

// Drop the doc's explicit DOCUMENT_VISIBILITY row so the share toggle
// becomes available again. Surfaced inline in the blocked-state notice
// — the Share UI is Creator+ gated and dropPermission is Creator+, so
// every user who can see this notice can also act on it.
const onResetVisibility = async () => {
  const docId = activeDocument.value?.id
  const baseId = activeProjectId.value
  if (!docId || !baseId || !activeWorkspaceId.value) return
  if (isUpdating.value.visibility) return

  isUpdating.value.visibility = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value,
      baseId,
      { operation: 'dropPermission' },
      {
        entity: PermissionEntity.DOCUMENT,
        entity_id: docId,
        permission: PermissionKey.DOCUMENT_VISIBILITY,
      },
    )
    $e('c:doc:share:visibility:reset')
    applyDocPatch(baseId, docId, { has_visibility_permission: false })
    message.toast(t('msg.info.docShareVisibilityReset'))
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.visibility = false
  }
}

// Refresh the active doc whenever the share modal opens. Permissions can
// change between when the doc was first loaded into the docs store and
// when the user clicks Share — without this refresh, the toggle reads
// from stale state (e.g., would still appear enabled after a Creator-only
// visibility row was added). One small GET per modal open is cheap; the
// backend's request-time visibility re-check would catch the case as a
// fallback, but the UX is to disable the toggle up-front.
watch(showShareModal, async (visible) => {
  if (!visible) return
  const docId = activeDocument.value?.id
  const baseId = activeProjectId.value
  if (!docId || !baseId || !activeWorkspaceId.value) return
  try {
    const fresh = (await $api.internal.getOperation(activeWorkspaceId.value, baseId, {
      operation: 'documentGet',
      docId,
    })) as { has_visibility_permission?: boolean; uuid?: string | null; meta?: Record<string, any> }
    applyDocPatch(baseId, docId, {
      has_visibility_permission: !!fresh?.has_visibility_permission,
      uuid: fresh?.uuid ?? null,
      ...(fresh?.meta ? { meta: fresh.meta } : {}),
    })
  } catch {
    // Silent — the modal still renders against the stale state, and the
    // backend share endpoint will refuse if visibility is now restricted.
  }
})
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-nc-border-gray-medium border-1 rounded-md gap-y-2">
      <!-- Master share toggle -->
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="text-nc-content-gray-emphasis font-medium">
          {{ $t('activity.enabledPublicViewing') }}
        </div>
        <!-- Disabled switch when blocked by custom visibility — no tooltip
             because the inline notice below carries the same message (with
             an actionable link), making a hover-only tooltip redundant. -->
        <a-switch
          v-if="!restrictedSharing && isBlockedByVisibility"
          :checked="false"
          disabled
          class="share-doc-toggle !mt-0.25"
          data-testid="share-doc-toggle"
        />
        <a-switch
          v-else-if="!restrictedSharing"
          v-e="['c:share:doc:enable:toggle']"
          :checked="isPublicShared"
          :loading="isUpdating.public"
          class="share-doc-toggle !mt-0.25"
          data-testid="share-doc-toggle"
          @click="toggleShare"
        />
        <div v-else class="text-nc-content-gray-muted">{{ $t('labels.sharingRestricted') }}</div>
      </div>

      <!-- Inline notice when the toggle is blocked by custom visibility,
           so the reason is visible without hovering the disabled switch. -->
      <div
        v-if="!restrictedSharing && isBlockedByVisibility"
        class="flex flex-row items-start gap-x-2 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md text-nc-content-gray-subtle"
        data-testid="nc-share-doc-blocked-notice"
      >
        <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5 mt-0.5" />
        <i18n-t keypath="msg.info.docShareBlockedByVisibility" tag="div" class="flex-1 text-bodySm">
          <template #resetVisibility>
            <a
              v-e="['c:doc:share:visibility:reset']"
              class="text-nc-content-brand underline cursor-pointer"
              :class="{ 'pointer-events-none opacity-60': isUpdating.visibility }"
              data-testid="nc-share-doc-reset-visibility"
              @click="onResetVisibility"
              >{{ $t('labels.resetVisibilityToDefault') }}</a
            >
          </template>
        </i18n-t>
      </div>

      <!-- A doc that was previously shared keeps its uuid even after a
           visibility permission is added later, so `isPublicShared` alone
           would still surface the URL / subtree section. Hide both while
           visibility is restricted — the backend's request-time check
           refuses to serve the URL anyway, so showing it would mislead
           the owner into thinking the share is live. -->
      <template v-if="isPublicShared && !isBlockedByVisibility">
        <div class="mt-0.5 border-t-1 border-nc-border-gray-light pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>

        <!-- Include sub-pages -->
        <div class="flex flex-col justify-between mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md">
          <div class="flex flex-row items-center justify-between">
            <div class="text-nc-content-gray-extreme">
              {{ $t('labels.includeSubPages') }}
            </div>
            <a-switch
              v-e="['c:share:doc:subtree:toggle']"
              :checked="includeSubtree"
              :loading="isUpdating.subtree"
              class="share-doc-subtree-toggle !mt-0.25"
              data-testid="share-doc-subtree-toggle"
              size="small"
              @click="toggleSubtree"
            />
          </div>
          <!-- Note: backend skips sub-pages (and their descendants) with
               custom visibility permissions when subtree is on. Only
               render when the doc actually has children — for a leaf
               doc the subtree toggle is moot and the note is noise. -->
          <div
            v-if="includeSubtree && !!activeDocument?.has_children"
            class="flex flex-row items-start gap-x-2 mt-2 text-nc-content-gray-subtle"
            data-testid="nc-share-doc-subtree-note"
          >
            <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5 mt-0.5" />
            <div class="flex-1 text-bodySm">{{ $t('msg.info.docShareSubtreeExcludesRestricted') }}</div>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>
