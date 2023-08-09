<script lang="ts" setup>
const props = defineProps<{ checked: boolean; disabled?: boolean }>()

const emit = defineEmits(['change', 'update:checked'])

const checked = useVModel(props, 'checked', emit)

const onChange = (e: boolean) => {
  emit('change', e)
}
</script>

<template>
  <a-switch v-model:checked="checked" :disabled="props.disabled" class="nc-switch" size="small" @change="onChange">
    <slot />
  </a-switch>
</template>
