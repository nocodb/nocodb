<script lang="ts" setup>
import { ROW_COLORING_MODE } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../../../components/smartsheet/grid/canvas/utils/canvas'

interface Props {
  rowColoringMode?: ROW_COLORING_MODE
  isOpen?: boolean
}

interface Emits {
  (event: 'update:rowColoringMode', model: ROW_COLORING_MODE): void
  (event: 'change', model: ROW_COLORING_MODE): void
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const rowColoringModeVModel = useVModel(props, 'rowColoringMode', emits)

const isOpenVModel = useVModel(props, 'isOpen', emits)

const isLocked = inject(IsLockedInj, ref(false))

const { t } = useI18n()

const { isUIAllowed } = useRoles()

const hasPermission = computed(() => isUIAllowed('rowColourUpdate'))

const chooseOption = (option: ROW_COLORING_MODE) => {
  clearRowColouringCache()

  rowColoringModeVModel.value = option

  emits('change', option)
}

const listOptions: { label: string; description: string; icon: IconMapKey; value: ROW_COLORING_MODE }[] = [
  {
    label: t('objects.coloring.usingSingleSelectField'),
    description: t('objects.coloring.usingSingleSelectFieldDescription'),
    icon: 'singleSelect',
    value: ROW_COLORING_MODE.SELECT,
  },

  {
    label: t('objects.coloring.usingConditions'),
    description: t('objects.coloring.usingConditionsDescription'),
    icon: 'ncConditions',
    value: ROW_COLORING_MODE.FILTER,
  },
]
</script>

<template>
  <div
    :class="{
      'nc-locked-view': isLocked,
    }"
  >
    <template v-if="!rowColoringModeVModel">
      <div class="bg-white flex flex-col overflow-hidden animate-animated animate-fadeIn" style="animation-duration: 0.3s">
        <LazyNcList
          :open="isOpenVModel"
          :value="rowColoringModeVModel"
          :list="listOptions"
          option-value-key="value"
          option-label-key="label"
          class="min-w-80 !w-auto"
          :item-height="60"
          item-full-width
          :close-on-select="false"
          stop-propagation-on-item-click
          item-class-name="!px-4"
          :is-locked="isLocked || !hasPermission"
          @update:value="chooseOption"
        >
          <template #listItem="{ option }">
            <div class="flex items-start gap-2 text-nc-content-gray">
              <div class="h-5 flex items-center">
                <component :is="iconMap[option.icon]" class="h-4 w-4 flex-none" />
              </div>
              <div class="flex flex-col gap-1">
                <span class="text-caption">{{ option.label }}</span>
                <span class="text-bodyDefaultSm text-nc-content-gray-muted">{{ option.description }}</span>
              </div>
            </div>
          </template>
        </LazyNcList>
      </div>
    </template>
    <template v-else-if="rowColoringModeVModel === ROW_COLORING_MODE.FILTER">
      <slot name="filter"></slot>
    </template>
    <template v-else-if="rowColoringModeVModel === ROW_COLORING_MODE.SELECT">
      <slot name="select"></slot>
    </template>

    <GeneralLockedViewFooter v-if="isLocked" @on-open="isOpenVModel = false" />
  </div>
</template>
