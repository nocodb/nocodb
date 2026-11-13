<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    checked?: boolean
    disabled?: boolean
    size?: 'default' | 'large' | 'medium' | 'small' | 'xsmall' | 'xxsmall'
    placement?: 'left' | 'right'
    loading?: boolean
    contentWrapperClass?: string
  }>(),
  {
    size: 'small',
    placement: 'left',
    loading: false,
    contentWrapperClass: '',
  },
)

const emit = defineEmits(['change', 'update:checked'])

const checked = useVModel(props, 'checked', emit)

const { loading, disabled } = toRefs(props)

const switchSize = computed(() => (['default', 'small'].includes(props.size) ? props.size : undefined))

const onChange = (e: boolean, updateValue = false) => {
  if (loading.value || disabled.value) return

  if (updateValue) {
    checked.value = e
  }

  emit('change', e)
}
</script>

<template>
  <span
    v-if="placement === 'right' && $slots.default"
    class="pr-2"
    :class="[
      contentWrapperClass,
      {
        'cursor-not-allowed opacity-60': disabled,
        'cursor-pointer': !disabled,
      },
    ]"
    @click="onChange(!checked, true)"
  >
    <slot />
  </span>
  <a-switch
    :checked="checked"
    :disabled="disabled"
    class="nc-switch"
    :class="{
      'size-xsmall': size === 'xsmall',
      'size-xxsmall': size === 'xxsmall',
      'size-small': size === 'small',
      'size-large': size === 'large',
      'size-medium': size === 'medium',
    }"
    :loading="loading"
    v-bind="$attrs"
    :size="switchSize"
    @change="onChange"
  >
  </a-switch>
  <span
    v-if="placement === 'left' && $slots.default"
    class="pl-2"
    :class="[
      contentWrapperClass,
      {
        'cursor-not-allowed opacity-60': disabled,
        'cursor-pointer': !disabled,
      },
    ]"
    @click="onChange(!checked, true)"
  >
    <slot />
  </span>
</template>

<style lang="scss" scoped>
// Between ant's default (44x22) and medium (32x18)
.size-large {
  @apply h-5 min-w-[36px] leading-[18px];

  :deep(.ant-switch-handle) {
    @apply h-[16px] w-[16px] top-[2px] left-[calc(100%_-_34px)];

    .ant-switch-loading-icon {
      @apply top-[2px];

      svg.anticon-spin {
        @apply !w-[12px] !h-[12px];
      }
    }
  }

  :deep(.ant-switch-inner) {
    @apply !mr-[6px] !ml-[22px] !my-0;
  }

  &.ant-switch-checked {
    :deep(.ant-switch-handle) {
      @apply left-[calc(100%_-_18px)];
    }

    :deep(.ant-switch-inner) {
      @apply !mr-[22px] !ml-[6px];
    }
  }
}

// Between large (36x20) and small (28x16)
.size-medium {
  @apply h-[18px] min-w-[32px] leading-[16px];

  :deep(.ant-switch-handle) {
    @apply h-[14px] w-[14px] top-[2px] left-[calc(100%_-_30px)];

    .ant-switch-loading-icon {
      @apply top-[1px];

      svg.anticon-spin {
        @apply !w-[11px] !h-[11px];
      }
    }
  }

  :deep(.ant-switch-inner) {
    @apply !mr-[5px] !ml-[20px] !my-0;
  }

  &.ant-switch-checked {
    :deep(.ant-switch-handle) {
      @apply left-[calc(100%_-_16px)];
    }

    :deep(.ant-switch-inner) {
      @apply !mr-[20px] !ml-[5px];
    }
  }
}

.size-small {
  @apply h-4 min-w-[28px] leading-[14px];

  :deep(.ant-switch-handle) {
    @apply h-[12px] w-[12px] top-[2px] left-[calc(100%_-_26px)];

    .ant-switch-loading-icon {
      @apply top-[1px];

      svg.anticon-spin {
        @apply !w-[10px] !h-[10px];
      }
    }
  }

  :deep(.ant-switch-inner) {
    @apply !mr-[5px] !ml-[18px] !my-0;
  }

  &.ant-switch-checked {
    :deep(.ant-switch-handle) {
      @apply left-[calc(100%_-_14px)];
    }

    :deep(.ant-switch-inner) {
      @apply !mr-[18px] !ml-[5px];
    }
  }
}

.size-xsmall {
  @apply h-3.5 min-w-[26px] leading-[14px];

  :deep(.ant-switch-handle) {
    @apply h-[10px] w-[10px] top-[2px] left-[calc(100%_-_24px)];

    .ant-switch-loading-icon {
      @apply top-[1px];

      svg.anticon-spin {
        @apply !w-[8px] !h-[8px];
      }
    }
  }

  :deep(.ant-switch-inner) {
    @apply !mr-[5px] !ml-[18px] !my-0;
  }

  &.ant-switch-checked {
    :deep(.ant-switch-handle) {
      @apply left-[calc(100%_-_12px)];
    }

    :deep(.ant-switch-inner) {
      @apply !mr-[18px] !ml-[5px];
    }
  }
}
.size-xxsmall {
  @apply h-2.5 min-w-[18px] leading-[12px];

  :deep(.ant-switch-handle) {
    @apply h-[6px] w-[6px] top-[2px] left-[calc(100%_-_16px)];

    .ant-switch-loading-icon {
      @apply top-[1px];

      svg.anticon-spin {
        @apply !w-[4px] !h-[4px];
      }
    }
  }

  :deep(.ant-switch-inner) {
    @apply !mr-[4px] !ml-[8px] !my-0;
  }

  &.ant-switch-checked {
    :deep(.ant-switch-handle) {
      @apply left-[calc(100%_-_8px)];
    }

    :deep(.ant-switch-inner) {
      @apply !mr-[12px] !ml-[4px];
    }
  }
}
</style>
