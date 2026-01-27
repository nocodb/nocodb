<script lang="ts" setup>
import type { ColumnType } from 'nocodb-sdk'
import { ViewLockType } from 'nocodb-sdk'
import { SmartsheetHeaderIcon } from '#components'

interface Props {
  modelValue?: Ref<any>
  columns?: ComputedRef<ColumnType[]>
  isLoadingFilter?: Ref<boolean>
}

interface Emits {
  (
    event: 'update:modelValue',
    model: {
      modelValue?: Ref<any>
      columns?: ColumnType[]
    },
  ): void
  (event: 'change', model?: boolean): void
  (event: 'remove', model: void): void
}

const props = defineProps({
  modelValue: ref({
    is_set_as_background: false,
    fk_column_id: '',
    type: 'row',
  }),
  columns: computed(() => []),
  isLoadingFilter: ref(false),
} as Props as any)

const emits = defineEmits<Emits>()
const vModel = useVModel(props, 'modelValue', emits)

const isLocked = inject(IsLockedInj, ref(false))

const activeView = inject(ActiveViewInj, ref())

const { isUIAllowed } = useRoles()

const { isUserViewOwner } = useViewsStore()

const isPersonalViewOwner = computed(
  () => activeView.value?.lock_type === ViewLockType.Personal && isUserViewOwner(activeView.value),
)

const hasPermission = computed(() => !isLocked.value && (isUIAllowed('rowColourUpdate') || isPersonalViewOwner.value))
</script>

<template>
  <div class="w-[420px] p-4 flex flex-col gap-4">
    <div class="flex flex-col gap-2">
      <div>
        {{ $t('objects.coloring.colourRecordsByField') }}
      </div>

      <a-form-item class="!my-0">
        <NcSelect
          v-model:value="vModel.fk_column_id"
          class="nc-colouring-field-select w-full nc-select-shadow"
          :dropdown-match-select-width="false"
          :disabled="!hasPermission"
          @change="emits('change', true)"
        >
          <a-select-option v-for="(column, idx) of columns" :key="idx" :value="column.id">
            <div class="w-full flex gap-2 items-center">
              <SmartsheetHeaderIcon :column="column" class="!mx-0" />
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>
                  {{ column.title }}
                </template>
                {{ column.title }}
              </NcTooltip>
              <component
                :is="iconMap.check"
                v-if="vModel.fk_column_id === column.id"
                id="nc-selected-item-icon"
                class="text-primary w-4 h-4"
              />
            </div>
          </a-select-option>
        </NcSelect>
      </a-form-item>
    </div>

    <div class="flex flex-col gap-2">
      <div class="flex items-center gap-2 justify-between">
        <NcButton type="text" size="small" :disabled="!hasPermission" @click="emits('remove')">
          {{ $t('labels.removeColouring') }}
        </NcButton>

        <div class="flex items-center cursor-pointer select-none text-nc-content-gray">
          <NcSwitch
            v-model:checked="vModel.is_set_as_background"
            placement="right"
            :loading="props.isLoadingFilter"
            :disabled="!hasPermission"
            @change="emits('change')"
          >
            {{ $t('labels.backgroundColour') }}
          </NcSwitch>
        </div>
      </div>
      
      <div class="flex items-center gap-2 justify-end">
        <span class="text-nc-content-gray text-sm">{{ $t('general.type') }}:</span>
        <NcSelect
          :value="vModel.type || 'row'"
          class="!w-20"
          size="small"
          :disabled="!hasPermission"
          @change="(val) => { vModel.type = val; emits('change'); }"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option value="row">{{ $t('general.row') }}</a-select-option>
          <a-select-option value="cell">{{ $t('general.cell') }}</a-select-option>
        </NcSelect>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-colouring-field-select.nc-select.ant-select) {
  .ant-select-selector {
    @apply !rounded-lg;
  }
}
</style>
