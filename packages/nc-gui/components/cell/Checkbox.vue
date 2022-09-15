<script setup lang="ts">
import { ColumnInj, IsFormInj, ReadonlyInj, getMdiIcon, inject } from '#imports'

interface Props {
  modelValue?: boolean | undefined | number
}

interface Emits {
  (event: 'update:modelValue', model: boolean | undefined | number): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

let vModel = $(useVModel(props, 'modelValue', emits))

const column = inject(ColumnInj)

const isForm = inject(IsFormInj)

const readOnly = inject(ReadonlyInj)

const checkboxMeta = $computed(() => {
  return {
    icon: {
      checked: 'mdi-check-circle-outline',
      unchecked: 'mdi-checkbox-blank-circle-outline',
    },
    color: 'primary',
    ...(column?.value?.meta || {}),
  }
})

function onClick() {
  if (!readOnly) {
    vModel = !vModel
  }
}
</script>

<template>
  <div
    class="flex"
    :class="{
      'justify-center': !isForm,
      'w-full': isForm,
      'nc-cell-hover-show': !vModel && !readOnly,
      'opacity-0': readOnly && !vModel,
    }"
    @click="onClick"
  >
    <div class="px-1 pt-1 rounded-full items-center" :class="{ 'bg-gray-100': !vModel }">
      <component
        :is="getMdiIcon(vModel ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
        :style="{
          color: checkboxMeta.color,
        }"
      />
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-cell-hover-show {
  opacity: 0;
  transition: 0.3s opacity;
  &:hover {
    opacity: 0.7;
  }
}
</style>
