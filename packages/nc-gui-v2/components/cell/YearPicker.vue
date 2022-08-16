<script setup lang="ts">
import dayjs from 'dayjs'
import { computed, inject, onClickOutside, ref, watch } from '#imports'

interface Props {
  modelValue?: number | string | null
}

const { modelValue } = defineProps<Props>()

const emit = defineEmits(['update:modelValue'])

const readOnly = inject(ReadonlyInj, false)

let isYearInvalid = $ref(false)

const localState = $computed({
  get() {
    if (!modelValue) {
      return undefined
    }

    const yearDate = dayjs(modelValue.toString(), 'YYYY')
    if (!yearDate.isValid()) {
      isYearInvalid = true
      return undefined
    }

    return yearDate
  },
  set(val?: dayjs.Dayjs) {
    if (!val) {
      emit('update:modelValue', null)
      return
    }

    if (val?.isValid()) {
      emit('update:modelValue', Number(val.format('YYYY')))
    }
  },
})

const open = ref<boolean>(false)

const randomClass = `picker_${Math.floor(Math.random() * 99999)}`
watch(
  open,
  (next) => {
    if (next) {
      onClickOutside(document.querySelector(`.${randomClass}`)! as HTMLDivElement, () => (open.value = false))
    }
  },
  { flush: 'post' },
)

const placeholder = computed(() => (isYearInvalid ? 'Invalid year' : readOnly ? 'Select year' : ''))
</script>

<template>
  <a-date-picker
    v-model:value="localState"
    picker="year"
    :bordered="false"
    class="!w-full px-1"
    :placeholder="placeholder"
    :allow-clear="!readOnly"
    :input-read-only="true"
    :open="readOnly ? false : open"
    :dropdown-class-name="randomClass"
    @click="open = !open"
    @change="open = !open"
  >
    <template #suffixIcon></template>
  </a-date-picker>
</template>
