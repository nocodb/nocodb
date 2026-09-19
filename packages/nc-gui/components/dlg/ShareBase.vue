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
    closable
    class="nc-share-base-dlg"
    @keydown.esc="dialogShow = false"
  >
    <template #header>
      <div class="flex flex-col gap-1">
        <div class="text-base font-semibold text-nc-content-gray-emphasis">
          {{ $t('labels.shareNamed', { name: base?.title }) }}
        </div>
        <div class="text-bodySm text-nc-content-gray-muted">{{ $t('msg.info.sharePublicLinkSubtitle') }}</div>
      </div>
    </template>

    <LazyDlgShareAndCollaborateShareBase />
  </NcModal>
</template>
