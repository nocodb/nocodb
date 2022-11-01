<script setup lang="ts">
import { ActiveCellInj, ColumnInj, IsFormInj, ReadonlyInj, getMdiIcon, inject, useSelectedCellKeyupListener } from '#imports'

interface Props {
  // If the previous cell value was a text, the initial checkbox value is a string type
  // otherwise it can be either a boolean, or a string representing a boolean, i.e '0' or '1'
  modelValue?: boolean | string | number | '0' | '1'
}

interface Emits {
  (event: 'update:modelValue', model: boolean): void
}

const props = defineProps<Props>()

const emits = defineEmits<Emits>()

const active = inject(ActiveCellInj, ref(false))

let vModel = $computed({
  get: () => !!props.modelValue && props.modelValue !== '0' && props.modelValue !== 0,
  set: (val) => emits('update:modelValue', val),
})

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

function onClick(force?: boolean) {
  if (!readOnly?.value && (force || active.value)) {
    vModel = !vModel
  }
}

useSelectedCellKeyupListener(active, (e) => {
  switch (e.key) {
    case 'Enter':
      onClick()
      e.stopPropagation()
      break
  }
})
</script>

<template>
  <div
    class="flex cursor-pointer"
    :class="{
      'justify-center': !isForm && !readOnly,
      'w-full': isForm,
      'nc-cell-hover-show': !vModel && !readOnly,
      'opacity-0': readOnly && !vModel,
    }"
    @click="onClick(false)"
  >
    <div class="px-1 pt-1 rounded-full items-center" :class="{ 'bg-gray-100': !vModel, '!ml-[-8px]': readOnly }">
      <Transition name="layout" mode="out-in" :duration="100">
        <component
          :is="getMdiIcon(vModel ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
          :style="{
            color: checkboxMeta.color,
          }"
          @click.stop="onClick(true)"
        />
      </Transition>
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
