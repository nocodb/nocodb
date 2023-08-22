<script setup lang="ts">
import {
  ActiveCellInj,
  ColumnInj,
  IsFormInj,
  ReadonlyInj,
  getMdiIcon,
  inject,
  parseProp,
  useProject,
  useSelectedCellKeyupListener,
} from '#imports'

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

const { isMssql } = useProject()

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
    ...parseProp(column?.value?.meta),
  }
})

let vModel = $computed<boolean | number>({
  get: () => !!props.modelValue && props.modelValue !== '0' && props.modelValue !== 0,
  set: (val: any) => emits('update:modelValue', isMssql(column?.value?.base_id) ? +val : val),
})

function onClick(force?: boolean, event?: MouseEvent) {
  if (
    (event?.target as HTMLElement)?.classList?.contains('nc-checkbox') ||
    (event?.target as HTMLElement)?.closest('.nc-checkbox')
  ) {
    return
  }
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
    class="flex cursor-pointer w-full h-full"
    :class="{
      'justify-center': !isForm,
      'w-full': isForm,
      'nc-cell-hover-show': !vModel && !readOnly,
      'opacity-0': readOnly && !vModel,
    }"
    @click="onClick(false, $event)"
  >
    <div class="p-1 rounded-full items-center" :class="{ 'bg-gray-100': !vModel, '!ml-[-8px]': readOnly }">
      <Transition name="layout" mode="out-in" :duration="100">
        <component
          :is="getMdiIcon(vModel ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
          class="nc-checkbox"
          :style="{
            color: checkboxMeta.color,
          }"
          @click="onClick(true)"
        />
      </Transition>
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-cell-hover-show {
  opacity: 0.3;
  transition: 0.3s opacity;

  &:hover {
    opacity: 0.7;
  }
}
</style>
