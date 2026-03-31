<script lang="ts" setup>
interface Props {
  disabled?: boolean
}

withDefaults(defineProps<Props>(), {
  disabled: false,
})

const emits = defineEmits<{
  (event: 'changeIcon'): void
}>()
</script>

<template>
  <NcMenuItem :disabled="disabled" class="nc-menu-item-change-icon" @click="emits('changeIcon')">
    <div class="flex gap-2 items-center">
      <GeneralIcon icon="ncSmile" class="opacity-80" />
      {{ $t('general.changeIcon') }}
    </div>
  </NcMenuItem>
</template>
