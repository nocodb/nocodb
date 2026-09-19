<script setup lang="ts">
interface Props {
  disabled?: boolean
  isViewToolbar?: boolean
}

const { disabled, isViewToolbar } = defineProps<Props>()

const { isMobileMode, getMainUrl } = useGlobal()

const { visibility, showShareModal } = storeToRefs(useShare())

const { activeTable } = storeToRefs(useTablesStore())

const { base, isSharedBase, isPrivateBase } = storeToRefs(useBase())

const { hideSharedBaseBtn } = storeToRefs(useConfigStore())

const { $e } = useNuxtApp()

const { isUIAllowed } = useRoles()

/**
 * A private base has nothing to offer below Editor: every row of the modal is
 * hidden for a commenter or a viewer there, so the button would open an empty
 * dialog. Elsewhere every member has at least the email invite and the members
 * doorway, so it is shown from Viewer up.
 */
const canShare = computed(() =>
  isPrivateBase.value
    ? isUIAllowed('viewShare')
    : isUIAllowed('userInvite') || isUIAllowed('baseShare') || isUIAllowed('viewShare'),
)

const route = useRoute()

useEventListener(document, 'keydown', async (e: KeyboardEvent) => {
  const cmdOrCtrl = isMac() ? e.metaKey : e.ctrlKey
  if (e.altKey && !e.shiftKey && !cmdOrCtrl) {
    switch (e.keyCode) {
      case 73: {
        // ALT + I
        if (!isDrawerOrModalExist()) {
          $e('c:shortcut', { key: 'ALT + I' })
          showShareModal.value = true
        }
        break
      }
    }
  }
})

const copySharedBase = async () => {
  const baseUrl = getMainUrl()
  window.open(`${baseUrl || ''}/copy-shared-base?base=${route.params.baseId}`, '_blank', 'noopener,noreferrer')
}
</script>

<template>
  <div
    v-if="!isSharedBase && canShare && visibility !== 'hidden' && (activeTable || base)"
    class="nc-share-base-button flex flex-col justify-center"
    data-testid="share-base-button"
    :data-sharetype="visibility"
  >
    <NcButton
      v-e="['c:share:open']"
      :size="isMobileMode ? 'medium' : 'small'"
      class="z-10 !rounded-lg"
      :class="{
        '!px-2': !isMobileMode,
        '!px-0 !max-w-8.5 !min-w-8.5': isMobileMode,
      }"
      type="primary"
      :disabled="disabled"
      @click="showShareModal = true"
    >
      <div v-if="!isMobileMode" class="flex flex-row items-center w-full gap-x-1.5">
        <!-- The button opens an invite-first modal, so a padlock said the opposite
             of what pressing it does. A globe still earns its place: "this base is
             already on the web" is real state worth seeing before you click. -->
        <GeneralIcon v-if="visibility === 'public'" icon="ncGlobe" class="flex-none h-3.5 w-3.5" />
        <!-- The glyph is drawn pointing up-right; 45° clockwise lands it on the horizontal. -->
        <GeneralIcon v-else icon="ncSend" class="flex-none h-3.5 w-3.5 rotate-45" />
        <div class="flex">{{ $t('activity.share') }}</div>
      </div>
      <GeneralIcon v-else icon="mobileShare" />
    </NcButton>
  </div>

  <template v-else-if="isSharedBase && !hideSharedBaseBtn">
    <div class="flex-1"></div>
    <div class="flex flex-col justify-center h-full">
      <div class="flex flex-row items-center w-full">
        <NcButton
          class="z-10 !rounded-lg !px-2 !bg-[#ff133e]"
          size="small"
          type="primary"
          :disabled="disabled"
          @click="copySharedBase"
        >
          <GeneralIcon class="mr-1" icon="duplicate" />
          Copy Base
        </NcButton>
      </div>
    </div>
  </template>

  <LazyDlgShareAndCollaborateView :is-view-toolbar="isViewToolbar" />
</template>
