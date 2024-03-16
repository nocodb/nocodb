<script lang="ts" setup>
const props = withDefaults(
  defineProps<{ checked: boolean; disabled?: boolean; size?: 'default' | 'small'; loading?: boolean }>(),
  {
    size: 'small',
  },
)
const emit = defineEmits(['change', 'update:checked'])
const checked = useVModel(props, 'checked', emit)

const loading = computed(() => props.loading)

const onChange = (e: boolean) => {
  emit('change', e)
}
</script>

<template>
  <a-switch
    v-model:checked="checked"
    :disabled="disabled"
    :loading="loading"
    :size="size"
    class="nc-switch"
    v-bind="$attrs"
    @change="onChange"
  >
  </a-switch>
  <span v-if="$slots.default" class="cursor-pointer pl-2" @click="checked = !checked">
    <slot />
  </span>
</template>
