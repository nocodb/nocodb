<script lang="ts" setup>
interface Props {
  checked?: boolean
  size?: 'small' | 'default' | 'large'
  disabled?: boolean
  theme?: 'default' | 'ai'
}

const props = withDefaults(defineProps<Props>(), {
  size: 'default',
  disabled: false,
  theme: 'default',
})

const emit = defineEmits(['change', 'update:checked'])

const checked = useVModel(props, 'checked', emit)

const onChange = (e: Event) => {
  emit('change', e, (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <a-checkbox
    v-model:checked="checked"
    class="nc-checkbox"
    :class="`theme-${props.theme}`"
    :disabled="props.disabled"
    @change="onChange"
  >
    <slot />
  </a-checkbox>
</template>

<style>
.nc-checkbox {
  @apply flex flex-row !items-center;

  &.theme-ai {
    .ant-checkbox-input:focus + .ant-checkbox-inner,
    &.ant-checkbox-wrapper:hover .ant-checkbox-inner,
    .ant-checkbox:hover .ant-checkbox-inner {
      @apply border-purple-500;
    }

    & > .ant-checkbox-checked {
      &:not(.ant-checkbox-disabled) > .ant-checkbox-inner {
        @apply bg-purple-500 border-purple-500;
      }
    }
  }
}
.nc-checkbox > .ant-checkbox {
  @apply flex !border-0 !p-0 !h-4 !w-4 !rounded !-mt-1.5 mr-0.75 shadow-sm shadow-gray-100;
}
.nc-checkbox > .ant-checkbox > .ant-checkbox-input {
  @apply !p-0 !h-4 !w-4 !border-0;
}
.nc-checkbox > .ant-checkbox::after {
  @apply !border-0 !h-4 !w-4 !rounded;
}
.nc-checkbox > .ant-checkbox > .ant-checkbox-inner {
  @apply !h-4 !w-4 !rounded;
}
</style>
