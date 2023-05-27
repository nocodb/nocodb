<script lang="ts" setup>
import type { SelectValue } from 'ant-design-vue/es/select'
import type { IdAndTitle } from '../../types'

const props = defineProps<{
  idAndTitleTupleList?: Readonly<IdAndTitle[] | null>
  modelValue?: string
  id?: string
}>()
const emit = defineEmits<Emits>()
interface Emits {
  (event: 'changeSelectedValue', model: string): void
}
const selectedId = ref<string>('')
watch(
  () => props.modelValue,
  (newValue) => {
    selectedId.value = newValue || ''
  },
  { immediate: true },
)

const optionsForSelectBoxes = computed(() => {
  return props.idAndTitleTupleList?.map((idAndTitle: IdAndTitle) => {
    return {
      name: idAndTitle.title,
      value: idAndTitle.id,
    }
  })
})

const handleChange = (value: SelectValue) => {
  const selectedElement = props.idAndTitleTupleList?.find((idAndTitle) => idAndTitle.id === value)
  if (selectedElement) {
    emit('changeSelectedValue', selectedElement.id)
  }
}

const allDataIsReady = computed(() => {
  return props.idAndTitleTupleList
})
</script>

<template>
  <template v-if="allDataIsReady">
    <a-select
      :id="props.id"
      ref="select"
      v-model:value="selectedId"
      show-search
      class="nc-id-with-title-select-box"
      @change="handleChange"
    >
      <a-select-option v-for="opt of optionsForSelectBoxes" :key="opt.name" :value="opt.value">
        <div class="flex gap-1 items-center">
          {{ opt.name }}
        </div>
      </a-select-option>
    </a-select>
  </template>
</template>

<style>
.nc-id-with-title-select-box {
  min-width: 5rem;
}
</style>
