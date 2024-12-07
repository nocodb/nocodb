<script lang="ts" setup>
import type { ButtonType } from 'ant-design-vue/lib/button'
import { useSlots } from 'vue'
import type { GeneralLoaderProps } from '../general/Loader.vue'

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
  showAsDisabled?: boolean
  type?: ButtonType | 'danger' | 'secondary' | undefined
  size?: NcButtonSize
  loaderSize?: GeneralLoaderProps['size']
  centered?: boolean
  fullWidth?: boolean
  iconOnly?: boolean
  iconPosition?: 'left' | 'right'
  theme?: 'default' | 'ai'
  bordered?: boolean
  shadow?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  showAsDisabled: false,
  size: 'medium',
  loaderSize: 'medium',
  type: 'primary',
  fullWidth: false,
  centered: true,
  iconPosition: 'left',
  theme: 'default',
  bordered: true,
  shadow: true,
})

const emits = defineEmits(['update:loading'])

const slots = useSlots()

const NcButton = ref<HTMLElement | null>(null)

const { size, loaderSize, type, theme, bordered } = toRefs(props)

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
    :class="{
      'small': size === 'small',
      'medium': size === 'medium',
      'xsmall': size === 'xsmall',
      'xxsmall': size === 'xxsmall',
      'size-xs': size === 'xs',
      'focused': isFocused,
      'theme-default': theme === 'default',
      'theme-ai': theme === 'ai',
      'bordered': bordered,
      'nc-btn-shadow': shadow,
      'nc-show-as-disabled': props.showAsDisabled,
    }"
    :disabled="props.disabled"
    :loading="loading"
    :tabindex="props.disabled ? -1 : 0"
    :type="type"
    class="nc-button"
    @blur="onBlur"
    @focus="onFocus"
  >
    <div
      :class="{
        'justify-center': props.centered,
        'justify-start': !props.centered,
      }"
      class="flex flex-row gap-x-2.5 nc-btn-inner w-full"
    >
      <template v-if="iconPosition === 'left'">
        <slot v-if="loading" name="loadingIcon">
          <GeneralLoader class="flex !bg-inherit !text-inherit" :size="loaderSize" />
        </slot>

        <slot v-else name="icon" />
      </template>
      <div
        v-if="!(size === 'xxsmall' && loading) && !props.iconOnly"
        :class="{
          'font-medium': type === 'primary' || type === 'danger',
          'w-full': props.fullWidth,
        }"
        class="flex flex-row items-center"
      >
        <slot v-if="loading && slots.loading" name="loading" />

        <slot v-else />
      </div>
      <template v-if="iconPosition === 'right'">
        <slot v-if="loading" name="loadingIcon">
          <GeneralLoader class="flex !bg-inherit !text-inherit" :size="loaderSize" />
        </slot>

        <slot v-else name="icon" />
      </template>
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
  @apply !xs:(outline-none);

  &.nc-btn-shadow {
    box-shadow: 0px 3px 1px -2px rgba(0, 0, 0, 0.06), 0px 5px 3px -2px rgba(0, 0, 0, 0.02);
  }
  outline: none;
}

.desktop {
  .nc-button.ant-btn.focused {
    &.theme-default {
      box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #3069fe;
    }

    &.theme-ai {
      box-shadow: 0px 0px 0px 2px #fff, 0px 0px 0px 4px #7d26cd;
    }
  }

  .nc-button.ant-btn-text.focused {
    &.theme-default {
      @apply text-brand-500;
    }

    &.theme-ai {
      @apply text-nc-content-purple-dark;
    }
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

.nc-button.ant-btn.size-xs {
  @apply px-2 py-0 h-7 min-w-7 rounded-lg text-small leading-[18px];

  & > div {
    @apply gap-x-2;
  }
}
.nc-button.ant-btn.xsmall {
  @apply p-0.25 h-6.25 min-w-6.25 rounded-md;
}

.nc-button.ant-btn.xxsmall {
  @apply p-0 h-5.75 min-w-5.75 rounded-md;
}

.nc-button.ant-btn[disabled],
.ant-btn-text.nc-button.ant-btn[disabled] {
  box-shadow: none !important;

  @apply border-0 !cursor-not-allowed;

  &.theme-default {
    @apply bg-gray-50 text-gray-300 md:(hover:bg-gray-50);
  }

  &.theme-ai {
    @apply bg-purple-50 text-purple-300 md:(hover:bg-purple-50);
  }
}

.nc-button.ant-btn.nc-show-as-disabled,
.ant-btn-text.nc-button.ant-btn.nc-show-as-disabled {
  box-shadow: none !important;

  @apply border-0;

  &.theme-default {
    @apply bg-gray-50 text-gray-300 md:(hover:bg-gray-50);
  }

  &.theme-ai {
    @apply bg-purple-50 text-purple-300 md:(hover:bg-purple-50);
  }
}

.nc-button.ant-btn-text.ant-btn[disabled],
.nc-button.ant-btn-text.ant-btn.nc-show-as-disabled {
  &.theme-default,
  &.theme-ai {
    @apply bg-transparent hover:bg-transparent;
  }
}

.nc-button.ant-btn-secondary[disabled],
.nc-button.ant-btn-secondary.nc-show-as-disabled {
  @apply border-1;

  &:not(.bordered) {
    @apply border-transparent;
  }

  &.theme-default {
    @apply bg-white hover:bg-white border-gray-100 text-gray-300;

    &.bordered {
      @apply border-gray-100;
    }
  }

  &.theme-ai {
    @apply bg-purple-50 hover:bg-purple-50  text-purple-300;

    &.bordered {
      @apply border-purple-100;
    }
  }
}

.nc-button.ant-btn-primary {
  @apply border-0 xs:(hover:border-0) text-white;

  &.theme-default {
    @apply bg-brand-500 md:(hover:bg-brand-600);
  }

  &.theme-ai {
    @apply bg-purple-700 md:(hover:bg-purple-800);
  }
}

.nc-button.ant-btn-secondary {
  @apply border-1;

  &:not(.bordered) {
    @apply border-transparent;
  }

  &.theme-default {
    @apply bg-white text-gray-700 md:(hover:bg-gray-100);

    &.bordered {
      @apply border-gray-200;
    }
  }

  &.theme-ai {
    @apply bg-purple-50  text-purple-700 md:(hover:bg-purple-100);

    &.bordered {
      @apply border-purple-200;
    }
  }
}

.nc-button.ant-btn-danger {
  @apply bg-red-500 border-0 hover:border-0 md:(hover:bg-red-600);
}

.nc-button.ant-btn-text {
  box-shadow: none;

  @apply bg-transparent border-0;

  &.theme-default {
    @apply text-gray-700 hover:text-gray-900 hover:bg-gray-100;
  }

  &.theme-ai {
    @apply text-nc-content-purple-dark hover:text-nc-content-purple-dark hover:bg-nc-bg-purple-dark;
  }

  &:focus {
    box-shadow: none;
  }
}
</style>
