<script lang="ts" setup>
import type { ButtonType } from 'ant-design-vue/lib/button'

interface Props {
  label: string
  loadingLabel: string | null
  onSubmit: () => Promise<void>
  disabled: boolean
  loading: boolean
  type: ButtonType | 'danger' | undefined
  size: 'small' | 'medium' | 'large'
}

const props = defineProps<Props>()

const emits = defineEmits(['update:loading'])

const size = computed(() => props.size || 'medium')

const type = computed(() => props.type || 'primary')

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
    @click="props.onSubmit"
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
        <span v-if="loading && props.loadingLabel">{{ props.loadingLabel }}</span>
        <span v-else>{{ props.label }}</span>
      </div>
    </div>
  </a-button>
</template>

<style lang="scss">
.nc-button > .ant-btn-loading-icon {
  display: none !important;
}
</style>
