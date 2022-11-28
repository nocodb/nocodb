<script lang="ts" setup>
import { useI18n } from '#imports'

const { modelValue } = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const dialogShow = computed({
  get: () => modelValue,
  set: (v) => emit('update:modelValue', v),
})

const { t } = useI18n()
</script>

<template>
  <a-modal
    v-model:visible="dialogShow"
    width="max(30vw, 600px)"
    class="p-2"
    :wrap-class-name="`nc-modal-keyboard-shortcuts ${dialogShow ? 'active' : ''}`"
    @keydown.esc="dialogShow = false"
  >
    <template #title> {{ $t('general.title.keyboardShortcut') }} </template>
    <!-- TODO:   -->
  </a-modal>
</template>
