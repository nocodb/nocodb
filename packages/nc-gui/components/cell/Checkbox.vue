<script setup lang="ts">
import {
  ActiveCellInj,
  ColumnInj,
  EditColumnInj,
  IsFormInj,
  ReadonlyInj,
  getMdiIcon,
  inject,
  parseProp,
  useBase,
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

const { isMssql } = useBase()

const column = inject(ColumnInj)

const isForm = inject(IsFormInj)

const isEditColumnMenu = inject(EditColumnInj, ref(false))

const isGallery = inject(IsGalleryInj, ref(false))

const readOnly = inject(ReadonlyInj)

const isExpandedFormOpen = inject(IsExpandedFormOpenInj, ref(false))

const checkboxMeta = computed(() => {
  return {
    icon: {
      checked: 'mdi-check-circle-outline',
      unchecked: 'mdi-checkbox-blank-circle-outline',
    },
    color: 'primary',
    ...parseProp(column?.value?.meta),
  }
})

const vModel = computed<boolean | number>({
  get: () => !!props.modelValue && props.modelValue !== '0' && props.modelValue !== 0 && props.modelValue !== 'false',
  set: (val: any) => emits('update:modelValue', isMssql(column?.value?.source_id) ? +val : val),
})

function onClick(force?: boolean, event?: MouseEvent) {
  if (
    (event?.target as HTMLElement)?.classList?.contains('nc-checkbox') ||
    (event?.target as HTMLElement)?.closest('.nc-checkbox')
  ) {
    return
  }
  if (!readOnly?.value && (force || active.value)) {
    vModel.value = !vModel.value
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
    class="flex cursor-pointer w-full h-full items-center"
    :class="{
      'w-full flex-start pl-2': isForm || isGallery || isExpandedFormOpen,
      'w-full justify-center': !isForm && !isGallery && !isExpandedFormOpen,
      'nc-cell-hover-show': !vModel && !readOnly,
      'opacity-0': readOnly && !vModel,
    }"
    @click="onClick(false, $event)"
  >
    <div
      class="items-center"
      :class="{ 'w-full justify-start': isEditColumnMenu || isGallery || isForm, 'py-2': isEditColumnMenu }"
      @click="onClick(true)"
    >
      <Transition name="layout" mode="out-in" :duration="100">
        <component
          :is="getMdiIcon(vModel ? checkboxMeta.icon.checked : checkboxMeta.icon.unchecked)"
          class="nc-checkbox"
          :style="{
            color: checkboxMeta.color,
          }"
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
