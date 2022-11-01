<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import {
  CellUrlDisableOverlayInj,
  ColumnInj,
  EditModeInj,
  computed,
  inject,
  isValidURL,
  message,
  ref,
  useCellUrlConfig,
  useI18n,
  watch,
} from '#imports'

interface Props {
  modelValue?: string | null
}

const { modelValue: value } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const { t } = useI18n()

const column = inject(ColumnInj)!

const editEnabled = inject(EditModeInj)!

const disableOverlay = inject(CellUrlDisableOverlayInj, ref(false))

// Used in the logic of when to display error since we are not storing the url if it's not valid
const localState = ref(value)

const vModel = computed({
  get: () => value,
  set: (val) => {
    localState.value = val
    if (!column.value.meta?.validate || (val && isValidURL(val)) || !val) {
      emit('update:modelValue', val)
    }
  },
})

const isValid = computed(() => value && isValidURL(value))

const url = computed(() => {
  if (!value || !isValidURL(value)) return ''

  /** add url scheme if missing */
  if (/^https?:\/\//.test(value)) return value

  return `https://${value}`
})

const { cellUrlOptions } = useCellUrlConfig(url)

const focus: VNodeRef = (el) => (el as HTMLInputElement)?.focus()

watch(
  () => editEnabled.value,
  () => {
    if (column.value.meta?.validate && !editEnabled.value && localState.value && !isValidURL(localState.value)) {
      message.error(t('msg.error.invalidURL'))
      localState.value = undefined
      return
    }
    localState.value = value
  },
)
</script>

<template>
  <div class="flex flex-row items-center justify-between w-full h-full">
    <input
      v-if="editEnabled"
      :ref="focus"
      v-model="vModel"
      class="outline-none text-sm w-full px-2"
      @blur="editEnabled = false"
      @keydown.down.stop
      @keydown.left.stop
      @keydown.right.stop
      @keydown.up.stop
      @keydown.delete.stop
    />

    <nuxt-link
      v-else-if="isValid && !cellUrlOptions?.overlay"
      no-prefetch
      no-rel
      class="z-3 text-sm underline hover:opacity-75"
      :to="url"
      :target="cellUrlOptions?.behavior === 'replace' ? undefined : '_blank'"
    >
      {{ value }}
    </nuxt-link>

    <nuxt-link
      v-else-if="isValid && !disableOverlay && cellUrlOptions?.overlay"
      no-prefetch
      no-rel
      class="z-3 w-full h-full text-center !no-underline hover:opacity-75"
      :to="url"
      :target="cellUrlOptions?.behavior === 'replace' ? undefined : '_blank'"
    >
      {{ cellUrlOptions.overlay }}
    </nuxt-link>

    <span v-else class="w-9/10 overflow-ellipsis overflow-hidden">{{ value }}</span>

    <div v-if="column.meta?.validate && !isValid && value?.length && !editEnabled" class="mr-1 w-1/10">
      <a-tooltip placement="top">
        <template #title> Invalid URL </template>
        <div class="flex flex-row items-center">
          <MiCircleWarning class="text-red-400 h-4" />
        </div>
      </a-tooltip>
    </div>
  </div>
</template>

<!--
-->
