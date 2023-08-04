<script lang="ts" setup>
import type { ButtonType } from 'ant-design-vue/lib/button'
import { useSlots } from 'vue'

interface Props {
  loading?: boolean
  disabled?: boolean
  type?: ButtonType | 'danger' | undefined
  size?: 'small' | 'medium' | 'large'
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
</script>

<template>
  <a-button
    :disabled="props.disabled"
    :loading="loading"
    :type="type"
    class="!rounded-lg nc-button"
    :class="{
      '!py-1 !h-8': size === 'small',
      '!py-2 !h-10': size === 'medium',
    }"
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
.nc-button > .ant-btn-loading-icon {
  display: none !important;
}
</style>
