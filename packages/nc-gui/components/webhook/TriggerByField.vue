<script setup lang="ts">
import type { ColumnType } from 'nocodb-sdk'
import { isVirtualCol } from 'nocodb-sdk'
interface Props {
  columns: ColumnType[]
  triggerField?: boolean
  triggerFields?: string[]
}

const props = defineProps<Props>()

const emits = defineEmits(['update:triggerFields', 'update:triggerField'])

const columns = toRef(props, 'columns')

const triggerFields = useVModel(props, 'triggerFields', emits, { defaultValue: [] })
const triggerField = useVModel(props, 'triggerField', emits)

const isDropdownOpen = ref(false)

const computedTags = computed(() => {
  return triggerFields.value?.map((colId) => {
    return columns.value.find((k) => k.id === colId)
  })
})

const removeColumnId = (colId: string) => {
  triggerFields.value = triggerFields.value?.filter((k) => k !== colId)
}
</script>

<template>
  <div class="w-full flex items-center justify-between h-[28px]">
    <label class="cursor-pointer flex items-center" @click.prevent="triggerField = !triggerField">
      <NcSwitch :checked="triggerField" class="nc-check-box-trigger-field">
        <span class="!text-gray-700 font-semibold"> Trigger only when specific fields change </span>
      </NcSwitch>
    </label>
    <NcDropdown v-if="triggerField" v-model:visible="isDropdownOpen" overlay-class-name="!pt-0">
      <NcButton
        size="xs"
        type="secondary"
        :class="{
          '!shadow-selected !border-brand-500': isDropdownOpen,
        }"
      >
        <div class="flex items-center justify-center gap-2">
          <GeneralIcon icon="plus" />
          {{ $t('activity.addFieldFromFormView') }}
        </div>
      </NcButton>
      <template #overlay>
        <NcList
          v-model:value="triggerFields"
          v-model:open="isDropdownOpen"
          class="nc-list-field"
          is-multi-select
          :close-on-select="false"
          :list="columns"
          variant="small"
          option-value-key="id"
          option-label-key="title"
        >
          <template #headerExtraRight>
            <NcBadge :border="false" color="brand" class="mr-2"> {{ triggerFields.length }} fields </NcBadge>
          </template>

          <template #listItem="{ option }">
            <div class="flex items-center w-full truncate gap-3 text-nc-content-gray-subtle hover:text-black transition-colors">
              <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(option)" :column-meta="option" />
              <SmartsheetHeaderCellIcon v-else :column-meta="option" />

              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>
                  {{ option?.title }}
                </template>
                <div class="flex-1 font-550 leading-5 text-small">
                  {{ option?.title }}
                </div>
              </NcTooltip>

              <NcCheckbox :checked="!!triggerFields.includes(option.id)" />
            </div>
          </template>
        </NcList>
      </template>
    </NcDropdown>
  </div>
  <div v-if="triggerField">
    <div v-if="triggerFields?.length" class="mt-2 gap-2 flex flex-wrap min-h-5.5">
      <div
        v-for="col of computedTags"
        :key="col.id"
        class="bg-nc-bg-gray-medium text-nc-content-gray-subtle2 px-1 py-0.5 rounded-md flex gap-1 items-center"
      >
        <SmartsheetHeaderVirtualCellIcon v-if="isVirtualCol(col)" :column-meta="col" />
        <SmartsheetHeaderCellIcon v-else :column-meta="col" />
        <div class="text-[13px] font-default leading-4.5">
          {{ col.title }}
        </div>

        <div class="w-0.25 h-4 bg-nc-border-gray-dark" />

        <GeneralIcon class="cursor-pointer opacity-70 hover:opacity-100" icon="close" @click="removeColumnId(col.id)" />
      </div>
    </div>
    <div v-else class="flex flex-row text-gray-400 mt-2">
      {{ $t('title.noFieldsSelected') }}
    </div>
  </div>
</template>

<style scoped lang="scss">
.nc-list-field {
  :deep(.nc-list-item) {
    .ant-checkbox-checked .ant-checkbox-inner {
      background-color: #3366ff !important;
      border-color: #3366ff !important;
    }

    .ant-checkbox {
      @apply !mr-0;
    }

    .nc-icon {
      @apply mx-0;
    }
  }
}
.nc-dropdown {
  [prefixcls='ant-dropdown-menu'] {
    @apply !pt-1;
  }
}
</style>
