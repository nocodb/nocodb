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

const { base } = storeToRefs(useBase())
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

    <LazyDlgShareAndCollaborateShareBase />
  </NcModal>
</template>
