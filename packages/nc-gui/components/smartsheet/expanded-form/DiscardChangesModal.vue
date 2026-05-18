<script setup lang="ts">
interface Props {
  modelValue: boolean
  loading?: boolean
}

withDefaults(defineProps<Props>(), {
  loading: false,
})

const emits = defineEmits<{
  'update:modelValue': [value: boolean]
  'discard': []
  'save-and-continue': []
}>()

// Disable mask click + Escape when the side panel is open — a silent
// dismiss there would leave the panel parked on the old (dirty) row while
// the grid is on a new row. The legacy modal expanded form keeps defaults.
const panelStore = useExpandedFormPanel()

const allowDismiss = computed(() => !panelStore?.isOpen.value)

const onVisibleChange = (v: boolean) => {
  emits('update:modelValue', v)
}
</script>

<template>
  <NcModal
    :visible="modelValue"
    size="xs"
    height="auto"
    :mask-closable="allowDismiss"
    :keyboard="allowDismiss"
    @update:visible="onVisibleChange"
  >
    <div>
      <div class="flex flex-row items-center gap-x-2 text-base font-bold">
        {{ $t('labels.saveChanges') }}
      </div>
      <div class="flex font-medium mt-2">
        {{ $t('activity.doYouWantToSaveTheChanges') }}
      </div>
      <div class="flex flex-row justify-end gap-x-2 mt-5">
        <NcButton type="secondary" size="small" @click="emits('discard')">
          {{ $t('labels.discard') }}
        </NcButton>
        <NcButton type="primary" size="small" :loading="loading" @click="emits('save-and-continue')">
          {{ $t('labels.saveChanges') }}
        </NcButton>
      </div>
    </div>
  </NcModal>
</template>
