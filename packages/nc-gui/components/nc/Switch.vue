<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    checked: boolean
    disabled?: boolean
    size?: 'default' | 'small' | 'xsmall' | 'xxsmall'
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
.size-xsmall {
  @apply h-3.5 min-w-[26px] leading-[14px];

  :deep(.ant-switch-handle) {
    @apply h-[10px] w-[10px] top-[2px] left-[calc(100%_-_24px)];
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
