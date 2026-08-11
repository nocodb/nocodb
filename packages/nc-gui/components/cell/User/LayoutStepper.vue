<script lang="ts" setup>
import type { UserFieldRecordType } from 'nocodb-sdk'
import type { CellStepperOption } from '~/components/cell/LayoutStepper.vue'

interface Props {
  options: UserFieldRecordType[]
  /** Selected user id (single-user mode only). */
  modelValue?: string
  format?: 'radio' | 'number'
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: undefined,
  format: 'radio',
  disabled: false,
})

const emits = defineEmits<{
  'update:modelValue': [value: string | null]
}>()

const { getColor } = useTheme()

/** Keyed on id — matches getSelectedUsers and the list layout's radio. */
const stepperOptions = computed<CellStepperOption[]>(() =>
  props.options
    .filter((op) => !!op.id)
    .map((op) => ({
      key: op.id!,
      title: extractUserDisplayNameOrEmail(op),
      searchText: op.email,
    })),
)

const usersByKey = computed(() => new Map(props.options.filter((op) => !!op.id).map((op) => [op.id!, op])))
</script>

<template>
  <CellLayoutStepper
    :options="stepperOptions"
    :model-value="modelValue"
    :format="format"
    :disabled="disabled"
    @update:model-value="(value) => emits('update:modelValue', value)"
  >
    <!-- Users have no option colors — the selected chip gets the standard gray
         user-tag fill, unselected chips stay plain outlines. -->
    <template #chip="{ option, selected, inMenu }">
      <a-tag
        class="nc-stepper-user-chip rounded-tag max-w-full !pl-0 !m-0"
        :class="{ 'nc-stepper-user-chip-plain': !(selected || inMenu) }"
        :color="selected || inMenu ? getColor('var(--nc-bg-gray-medium)', 'var(--nc-bg-gray-light)') : undefined"
      >
        <span class="flex items-stretch gap-2 text-small text-nc-content-gray">
          <div class="flex-none">
            <GeneralUserIcon :user="usersByKey.get(option.key)" size="auto" class="!text-[0.5rem] !h-[16.8px]" />
          </div>
          <NcTooltip class="truncate max-w-full" show-on-truncate-only>
            <template #title>
              {{ option.title }}
            </template>
            <span
              class="text-ellipsis overflow-hidden"
              :style="{
                wordBreak: 'keep-all',
                whiteSpace: 'nowrap',
                display: 'inline',
              }"
            >
              {{ option.title }}
            </span>
          </NcTooltip>
        </span>
      </a-tag>
    </template>
  </CellLayoutStepper>
</template>

<style lang="scss" scoped>
.rounded-tag {
  @apply py-[1px] px-2 rounded-[12px];
}

.nc-stepper-user-chip-plain {
  border: 1px solid var(--nc-border-gray-medium) !important;
  background: var(--nc-bg-default) !important;
}
</style>
