<script lang="ts" setup>
import { type ColumnType, ROW_COLORING_MODE } from 'nocodb-sdk'
import { clearRowColouringCache } from '../../../../../components/smartsheet/grid/canvas/utils/canvas'
import type { NcListItemType } from '../../../../../components/nc/List/index.vue'

interface Props {
  rowColoringMode?: ROW_COLORING_MODE
  isOpen?: boolean
  columns?: ColumnType[]
}

interface Emits {
  (event: 'update:rowColoringMode', model: ROW_COLORING_MODE): void
  (event: 'change', model: ROW_COLORING_MODE): void
}

interface ListOptionType extends NcListItemType {
  description: string
  icon: IconMapKey
  value: ROW_COLORING_MODE
}

const props = defineProps<Props>()
const emits = defineEmits<Emits>()

const rowColoringModeVModel = useVModel(props, 'rowColoringMode', emits)

const isOpenVModel = useVModel(props, 'isOpen', emits)

const { columns } = toRefs(props)

const isLocked = inject(IsLockedInj, ref(false))

const { t } = useI18n()

const { user } = useGlobal()

const { isUIAllowed } = useRoles()

const hasPermission = computed(() => isUIAllowed('rowColourUpdate'))

const chooseOption = (option: ROW_COLORING_MODE) => {
  clearRowColouringCache()

  rowColoringModeVModel.value = option

  emits('change', option)
}

const isOptionsDisabled = computed(() => isLocked.value || !hasPermission.value)

const listOptions = computed<ListOptionType[]>(() => [
  {
    label: t('objects.coloring.usingSingleSelectField'),
    description: t('objects.coloring.usingSingleSelectFieldDescription'),
    icon: 'cellSingleSelect',
    value: ROW_COLORING_MODE.SELECT,
    ncItemDisabled: !columns.value?.length || isOptionsDisabled.value,
    ncItemTooltip: !columns.value?.length ? t('objects.coloring.usingSingleSelectFieldTooltip') : '',
  },
  {
    label: t('objects.coloring.usingConditions'),
    description: t('objects.coloring.usingConditionsDescription'),
    icon: 'ncConditions',
    value: ROW_COLORING_MODE.FILTER,
    ncItemDisabled: isOptionsDisabled.value,
  },
])
</script>

<template>
  <div
    :class="{
      'nc-locked-view': isLocked,
    }"
  >
    <template v-if="!rowColoringModeVModel">
      <div class="flex flex-col overflow-hidden animate-animated animate-fadeIn" style="animation-duration: 0.3s">
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
          :is-locked="isOptionsDisabled"
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

    <GeneralLockedViewFooter
      v-if="isLocked || !hasPermission"
      :show-icon="isLocked"
      :show-unlock-button="isLocked"
      @on-open="isOpenVModel = false"
    >
      <template v-if="!isLocked" #title>
        Editing restricted for <span class="capitalize"> {{ Object.keys(user.base_roles)?.[0] ?? ProjectRoles.NO_ACCESS }}</span>
      </template>
    </GeneralLockedViewFooter>
  </div>
</template>
