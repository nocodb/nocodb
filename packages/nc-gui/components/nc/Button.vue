<script lang="ts" setup>
import type { ButtonType } from 'ant-design-vue/lib/button'
import { useSlots } from 'vue'
import type { NcButtonSize } from '~/lib'

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
  type?: ButtonType | 'danger' | 'secondary' | undefined
  size?: NcButtonSize
  centered?: boolean
  iconOnly?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  size: 'medium',
  type: 'primary',
  centered: true,
})

const emits = defineEmits(['update:loading'])

const slots = useSlots()

const NcButton = ref<HTMLElement | null>(null)

const size = computed(() => props.size)

const type = computed(() => props.type)

const loading = useVModel(props, 'loading', emits)

const isFocused = ref(false)
const isClicked = ref(false)

const onFocus = (e: FocusEvent) => {
  // Only focus when coming from another element which is not a mouse click
  nextTick(() => {
    if (isClicked.value) {
      isFocused.value = false
    } else {
      const relatedTarget = e.relatedTarget as HTMLElement | null

      isFocused.value = !!relatedTarget
    }

    isClicked.value = false
  })
}

const onBlur = () => {
  isFocused.value = false
  isClicked.value = false
}

useEventListener(NcButton, 'mousedown', () => {
  isClicked.value = true
})
</script>

<template>
  <a-button
    ref="NcButton"
    :disabled="props.disabled"
    :loading="loading"
    :type="type"
    class="nc-button"
    :class="{
      small: size === 'small',
      medium: size === 'medium',
      xsmall: size === 'xsmall',
      xxsmall: size === 'xxsmall',
      focused: isFocused,
    }"
    @focus="onFocus"
    @blur="onBlur"
  >
    <div
      class="flex flex-row gap-x-2.5 w-full"
      :class="{
        'justify-center': props.centered,
        'justify-start': !props.centered,
      }"
    >
      <GeneralLoader
        v-if="loading"
        size="medium"
        class="flex !bg-inherit"
        :class="{
          '!text-white': type === 'primary' || type === 'danger',
          '!text-gray-800': type !== 'primary' && type !== 'danger',
        }"
      />

      <slot v-else name="icon" />
      <div
        v-if="!(size === 'xxsmall' && loading) && !props.iconOnly"
        class="flex flex-row items-center"
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
.ant-btn:before {
  display: none !important;
}

.nc-button {
  // Not Icon
  :not(.nc-icon):not(.material-symbols) {
    line-height: 0.95;
  }
  > .ant-btn-loading-icon {
    display: none !important;
  }
}

.nc-button {
  @apply !xs:(outline-none)

  box-shadow: 0px 5px 3px -2px rgba(0, 0, 0, 0.02), 0px 3px 1px -2px rgba(0, 0, 0, 0.06);
  outline: none;
}

.desktop {
  .nc-button.ant-btn.focused {
    box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
  }

  .nc-button.ant-btn-text.focused {
    @apply text-brand-500;
  }
}

.nc-button.ant-btn {
  @apply rounded-lg font-medium;
}

.nc-button.ant-btn.small {
  @apply py-1 px-1.75 h-8 min-w-8;
}

.nc-button.ant-btn.medium {
  @apply py-2 px-4 h-10 min-w-10 xs:(h-10.5 max-h-10.5 min-w-10.5 !px-3);
}

.nc-button.ant-btn.xsmall {
  @apply p-0.25 h-6.25 min-w-6.25 rounded-md;
}

.nc-button.ant-btn.xxsmall {
  @apply p-0 h-5.75 min-w-5.75 rounded-md;
}

.nc-button.ant-btn[disabled] {
  box-shadow: none !important;
  @apply bg-gray-50 border-0 text-gray-300 cursor-not-allowed md:(hover:bg-gray-50);
}

.nc-button.ant-btn-text.ant-btn[disabled] {
  @apply bg-transparent hover:bg-transparent;
}

.nc-button.ant-btn-secondary[disabled] {
  @apply bg-white hover:bg-white border-1 border-gray-100 text-gray-300;
}

.nc-button.ant-btn-primary {
  @apply bg-brand-500 border-0 text-white xs:(hover:border-0) md:(hover:bg-brand-600);
}

.nc-button.ant-btn-secondary {
  @apply bg-white border-1 border-gray-200 text-gray-700 md:(hover:bg-gray-100);
}

.nc-button.ant-btn-danger {
  @apply bg-red-500 border-0 hover:border-0 md:(hover:bg-red-600);
}

.nc-button.ant-btn-text {
  box-shadow: none;

  @apply bg-transparent border-0 text-gray-700 hover:text-gray-900 hover:bg-gray-100;

  &:focus {
    box-shadow: none;
  }
}
</style>
