<script lang="ts" setup>
import type { ButtonType } from 'ant-design-vue/lib/button'
import { useSlots } from 'vue'

/**
 * @description
 * Button component
 *
 * @example
 * <NcButton type="primary" size="medium" :loading="loading" @click="onClick">
 *  Save
 *  <template #loading> Saving </template>
 * </NcButton>
 */

interface Props {
  loading?: boolean
  disabled?: boolean
  type?: ButtonType | 'danger' | undefined
  size?: 'xsmall' | 'small' | 'medium'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'medium',
  type: 'primary',
})

const emits = defineEmits(['update:loading'])

const slots = useSlots()

const size = computed(() => props.size)

const type = computed(() => props.type)

const loading = useVModel(props, 'loading', emits)

const isFocused = ref(false)
const isClicked = ref(false)

const onFocus = () => {
  // Only focus when coming from another element which is not a mouse click
  nextTick(() => {
    if (isClicked.value) {
      isFocused.value = false
    } else {
      isFocused.value = true
    }

    isClicked.value = false
  })
}

const onBlur = () => {
  isFocused.value = false
  isClicked.value = false
}
</script>

<template>
  <a-button
    :disabled="props.disabled"
    :loading="loading"
    :type="type"
    class="nc-button"
    :class="{
      small: size === 'small',
      medium: size === 'medium',
      xsmall: size === 'xsmall',
      focused: isFocused,
    }"
    @focus="onFocus"
    @blur="onBlur"
    @mousedown="isClicked = true"
  >
    <div class="flex flex-row gap-x-2.5 justify-center">
      <GeneralLoader v-if="loading" size="medium" class="flex !text-white" loader-class="!text-white" />

      <slot v-else name="icon" />

      <div
        class="flex"
        :class="{
          'font-medium': type === 'primary' || type === 'danger',
        }"
      >
        <slot v-if="loading && slots.loading" name="loading" />

        <slot v-else />
      </div>
    </div>
  </a-button>
</template>

<style lang="scss">
.nc-button {
  > .ant-btn-loading-icon {
    display: none !important;
  }
}

.nc-button {
  box-shadow: 0px 5px 3px -2px rgba(0, 0, 0, 0.02), 0px 3px 1px -2px rgba(0, 0, 0, 0.06);
  outline: none;
}

.nc-button.ant-btn.focused {
  box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
}

.nc-button.ant-btn {
  @apply rounded-lg  font-medium;
}

.nc-button.ant-btn.small {
  @apply py-1 px-1.75 h-8 min-w-8;
}

.nc-button.ant-btn.medium {
  @apply py-2 px-3 h-10 min-w-10;
}

.nc-button.ant-btn.xsmall {
  @apply p-0.25 h-6.25 w-6.25;
}

.nc-button.ant-btn[disabled] {
  box-shadow: none !important;
  @apply bg-gray-50 hover:bg-gray-50 border-0 text-gray-300 cursor-not-allowed;
}

.nc-button.ant-btn-secondary[disabled] {
  @apply bg-white hover:bg-white border-1 border-gray-100 text-gray-300;
}

.nc-button.ant-btn-primary {
  @apply bg-brand-500 border-0 text-white;

  &:hover {
    @apply bg-brand-600 border-0;
  }
}

.nc-button.ant-btn-secondary {
  @apply bg-white border-1 border-gray-200 text-gray-700;

  &:hover {
    @apply bg-gray-50;
  }
}

.nc-button.ant-btn-danger {
  @apply bg-red-500 border-0;

  &:hover {
    @apply bg-red-600 border-0;
  }
}

.nc-button.ant-btn-text {
  box-shadow: none;

  @apply bg-transparent border-0 text-gray-700 hover:bg-gray-50;

  &:focus {
    box-shadow: none;
  }
}

.nc-button.ant-btn-text.focused {
  @apply text-brand-500;
}
</style>
