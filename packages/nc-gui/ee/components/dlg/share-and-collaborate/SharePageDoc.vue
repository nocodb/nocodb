<script lang="ts" setup>
const { dashboardUrl } = useDashboard()

const documentsStore = useDocumentsStore()
const { activeDocument } = storeToRefs(documentsStore)

const { isPrivateBase } = storeToRefs(useBase())
const { activeProjectId } = storeToRefs(useBases())
const { activeWorkspaceId } = storeToRefs(useWorkspace())

const { t } = useI18n()
const { $api, $e } = useNuxtApp()

const isUpdating = ref({
  public: false,
  subtree: false,
})

const restrictedSharing = computed(() => isPrivateBase.value)

const isPublicShared = computed(() => {
  if (restrictedSharing.value) return false
  return !!activeDocument.value?.uuid
})

const includeSubtree = computed(() => {
  // Default true when share is enabled — backend seeds this on first share.
  const meta = activeDocument.value?.meta as any
  return meta?.share?.include_subtree ?? true
})

const url = computed(() => sharedDocUrl() ?? '')

function sharedDocUrl() {
  if (!activeDocument.value?.uuid) return null
  return `${dashboardUrl.value}/doc/${activeDocument.value.uuid}`
}

// Patch the local reactive doc so the UI updates immediately. The store's
// activeDocument is reactive — assigning to its fields propagates.
const patchDoc = (patch: Partial<NonNullable<typeof activeDocument.value>>) => {
  if (!activeDocument.value) return
  Object.assign(activeDocument.value, patch)
}

const toggleShare = async () => {
  if (!activeDocument.value?.id || !activeProjectId.value) return
  if (isUpdating.value.public) return

  isUpdating.value.public = true
  try {
    if (isPublicShared.value) {
      await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value,
        { operation: 'documentUnshare' },
        { docId: activeDocument.value.id },
      )
      $e('c:doc:share:disable')
      patchDoc({ uuid: null })
      message.success(t('msg.info.docShareDisabled'))
    } else {
      const res = (await $api.internal.postOperation(
        activeWorkspaceId.value!,
        activeProjectId.value,
        { operation: 'documentShare' },
        { docId: activeDocument.value.id },
      )) as { uuid: string; include_subtree: boolean }
      $e('c:doc:share:enable')
      const meta = { ...(activeDocument.value.meta ?? {}) } as any
      meta.share = { include_subtree: res.include_subtree }
      patchDoc({ uuid: res.uuid, meta })
      message.success(t('msg.info.docShareEnabled'))
    }
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.public = false
  }
}

const toggleSubtree = async () => {
  if (!activeDocument.value?.id || !activeProjectId.value) return
  if (isUpdating.value.subtree) return

  const nextValue = !includeSubtree.value
  isUpdating.value.subtree = true
  try {
    await $api.internal.postOperation(
      activeWorkspaceId.value!,
      activeProjectId.value,
      { operation: 'documentShareUpdate' },
      { docId: activeDocument.value.id, include_subtree: nextValue },
    )
    $e('c:doc:share:subtree:toggle', { include_subtree: nextValue })
    const meta = { ...(activeDocument.value.meta ?? {}) } as any
    meta.share = { ...(meta.share ?? {}), include_subtree: nextValue }
    patchDoc({ meta })
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  } finally {
    isUpdating.value.subtree = false
  }
}
</script>

<template>
  <div class="flex flex-col py-2 px-3 mb-1">
    <div class="flex flex-col w-full mt-2.5 px-3 py-2.5 border-nc-border-gray-medium border-1 rounded-md gap-y-2">
      <!-- Master share toggle -->
      <div class="flex flex-row w-full justify-between py-0.5">
        <div class="text-nc-content-gray-emphasis font-medium">
          {{ $t('activity.enabledPublicViewing') }}
        </div>
        <a-switch
          v-if="!restrictedSharing"
          v-e="['c:share:doc:enable:toggle']"
          :checked="isPublicShared"
          :loading="isUpdating.public"
          class="share-doc-toggle !mt-0.25"
          data-testid="share-doc-toggle"
          @click="toggleShare"
        />
        <div v-else class="text-nc-content-gray-muted">{{ $t('labels.sharingRestricted') }}</div>
      </div>

      <template v-if="isPublicShared">
        <div class="mt-0.5 border-t-1 border-nc-border-gray-light pt-3">
          <GeneralCopyUrl v-model:url="url" />
        </div>

        <!-- Search engines are blocked from the public page in Phase 1 -->
        <div class="flex flex-row items-center gap-x-2 mt-1 py-2 px-3 bg-nc-bg-gray-extralight rounded-md text-nc-content-gray-subtle">
          <GeneralIcon icon="info" class="flex-none !w-3.5 !h-3.5" />
          <div class="flex-1 text-bodySm">{{ $t('msg.info.docShareNoindex') }}</div>
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
        </div>
      </template>
    </div>
  </div>
</template>
