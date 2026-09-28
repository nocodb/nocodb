<script lang="ts" setup>
/**
 * Share base, lifted out of the Share modal and into the base menu.
 *
 * Handing out a public read-only link to a whole base is a base-level admin act,
 * not something the person trying to add a colleague should trip over. The body
 * is the same component the modal used.
 */
const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = useVModel(props, 'modelValue', emit)

const { base, isPrivateBase } = storeToRefs(useBase())
</script>

<template>
  <NcModal
    v-model:visible="dialogShow"
    :show-separator="false"
    size="small"
    width="min(calc(100vw - 32px), 640px)"
    class="nc-share-base-dlg"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-col w-full gap-1">
        <div class="flex w-full items-start justify-between gap-4">
          <div class="flex-1 min-w-0 text-base font-semibold text-nc-content-gray-emphasis">
            {{ $t('labels.shareNamed', { name: base?.title }) }}
          </div>
          <!-- -my-1 pulls the 32px button onto the title's 24px line box: up 4px to
               centre the glyph, and back to a 24px margin box so the subtitle
               keeps its spacing. -->
          <NcButton
            type="text"
            size="small"
            class="!px-2 flex-none -my-1"
            data-testid="nc-share-base-close-btn"
            @click="dialogShow = false"
          >
            <GeneralIcon icon="close" class="h-4 w-4" />
          </NcButton>
        </div>
        <div class="text-bodySm text-nc-content-gray-muted">{{ $t('msg.info.sharePublicLinkSubtitle') }}</div>
      </div>
    </template>

    <!-- Above the toggle, and outside #header: the header wrapper sets
         `text-base md:text-lg`, which the body does not. `mx-3` matches the
         `px-3` on the body component's root so both edges line up with the card. -->
    <div
      v-if="isPrivateBase"
      class="inline-flex items-center gap-x-2 mx-3 px-2 py-1 text-nc-content-gray-muted bg-nc-bg-gray-light rounded-md"
      data-testid="nc-share-base-private-restricted"
    >
      <div class="flex items-center justify-center h-4 w-4">
        <GeneralIcon icon="ncBasePrivate" class="flex-none w-3.5 h-3.5" />
      </div>
      <div class="flex-1">{{ $t('msg.privateBaseShareRestrictedMsg') }}</div>
    </div>

    <LazyDlgShareAndCollaborateShareBase />
  </NcModal>
</template>
