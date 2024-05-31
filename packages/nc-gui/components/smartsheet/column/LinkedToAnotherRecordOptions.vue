<script setup lang="ts">
import { ModelTypes, MssqlUi, RelationTypes, SqliteUi, UITypes } from 'nocodb-sdk'

const props = defineProps<{
  value: any
  isEdit: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const isEdit = toRef(props, 'isEdit')

const meta = inject(MetaInj, ref())

const { setAdditionalValidations, validateInfos, onDataTypeChange, sqlUi, isXcdbBase } = useColumnCreateStoreOrThrow()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

const { t } = useI18n()

if (!isEdit.value) {
  setAdditionalValidations({
    childId: [{ required: true, message: t('general.required') }],
  })
}

const onUpdateDeleteOptions = sqlUi === MssqlUi ? ['NO ACTION'] : ['NO ACTION', 'CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT']

if (!isEdit.value) {
  if (!vModel.value.parentId) vModel.value.parentId = meta.value?.id
  if (!vModel.value.childId) vModel.value.childId = null
  if (!vModel.value.childColumn) vModel.value.childColumn = `${meta.value?.table_name}_id`
  if (!vModel.value.childTable) vModel.value.childTable = meta.value?.table_name
  if (!vModel.value.parentTable) vModel.value.parentTable = vModel.value.rtn || ''
  if (!vModel.value.parentColumn) vModel.value.parentColumn = vModel.value.rcn || ''

  if (!vModel.value.type) vModel.value.type = 'mm'
  if (!vModel.value.onUpdate) vModel.value.onUpdate = onUpdateDeleteOptions[0]
  if (!vModel.value.onDelete) vModel.value.onDelete = onUpdateDeleteOptions[0]
  if (!vModel.value.virtual) vModel.value.virtual = sqlUi === SqliteUi // appInfo.isCloud || sqlUi === SqliteUi
  if (!vModel.value.alias) vModel.value.alias = vModel.value.column_name
}
const advancedOptions = ref(false)

const refTables = computed(() => {
  if (!tables.value || !tables.value.length) {
    return []
  }

  return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
})

const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())

const isLinks = computed(() => vModel.value.uidt === UITypes.Links && vModel.value.type !== RelationTypes.ONE_TO_ONE)

const referenceTableChildId = computed({
  get: () => (isEdit.value ? vModel.value?.colOptions?.fk_related_model_id : vModel.value?.childId) ?? null,
  set: (value) => {
    if (!isEdit.value && value) {
      vModel.value.childId = value
    }
  },
})

const linkType = computed({
  get: () => (isEdit.value ? vModel.value?.colOptions?.type : vModel.value?.type) ?? null,
  set: (value) => {
    if (!isEdit.value && value) {
      vModel.value.type = value
    }
  },
})
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-col gap-4">
      <a-form-item :label="$t('labels.relationType')" v-bind="validateInfos.type" class="nc-ltar-relation-type">
        <a-radio-group v-model:value="linkType" name="type" v-bind="validateInfos.type" :disabled="isEdit">
          <a-radio value="mm">
            <span class="nc-ltar-icon nc-mm-icon">
              <GeneralIcon icon="mm_solid" />
            </span>
            {{ $t('title.manyToMany') }}
          </a-radio>
          <a-radio value="hm">
            <span class="nc-ltar-icon nc-hm-icon">
              <GeneralIcon icon="hm_solid" />
            </span>
            {{ $t('title.hasMany') }}
          </a-radio>
          <a-radio value="oo">
            <span class="nc-ltar-icon nc-oo-icon">
              <GeneralIcon icon="oneToOneSolid" />
            </span>
            {{ $t('title.oneToOne') }}
          </a-radio>
        </a-radio-group>
      </a-form-item>

      <a-form-item class="flex w-full nc-ltar-child-table" v-bind="validateInfos.childId">
        <a-select
          v-model:value="referenceTableChildId"
          show-search
          :disabled="isEdit"
          :filter-option="filterOption"
          placeholder="select table to link"
          dropdown-class-name="nc-dropdown-ltar-child-table"
          @change="onDataTypeChange"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="table of refTables" :key="table.id" :value="table.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralTableIcon :meta="table" class="text-gray-500" />
              </div>
              <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ table.title }}</template>
                <span>{{ table.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </a-select>
      </a-form-item>
    </div>
    <template v-if="!isXcdbBase || isLinks">
      <div>
        <NcButton @click.stop="advancedOptions = !advancedOptions" size="small" type="text" class="!hover:text-gray-700">
          <div class="flex items-center gap-2">
            <span class="first-letter:capitalize">
              {{ $t('title.advancedSettings').toLowerCase() }}
            </span>

            <GeneralIcon :icon="advancedOptions ? 'arrowUp' : 'arrowDown'" class="h-4 w-4" />
          </div>
        </NcButton>
      </div>

      <div v-if="advancedOptions" class="flex flex-col gap-4">
        <LazySmartsheetColumnLinkOptions v-if="isLinks" v-model:value="vModel" />
        <template v-if="!isXcdbBase && !isEdit">
          <div class="flex flex-row space-x-2">
            <a-form-item class="flex w-1/2" :label="$t('labels.onUpdate')">
              <a-select
                v-model:value="vModel.onUpdate"
                :disabled="vModel.virtual"
                name="onUpdate"
                dropdown-class-name="nc-dropdown-on-update"
                @change="onDataTypeChange"
              >
                <template #suffixIcon>
                  <GeneralIcon icon="arrowDown" class="text-gray-700" />
                </template>
                <a-select-option v-for="(option, i) of onUpdateDeleteOptions" :key="i" :value="option">
                  <template v-if="option === 'NO ACTION'">{{ $t('title.links.noAction') }}</template>
                  <template v-else-if="option === 'CASCADE'">{{ $t('title.links.cascade') }}</template>
                  <template v-else-if="option === 'RESTRICT'">{{ $t('title.links.restrict') }}</template>
                  <template v-else-if="option === 'SET NULL'">{{ $t('title.links.setNull') }}</template>
                  <template v-else-if="option === 'SET DEFAULT'">{{ $t('title.links.setDefault') }}</template>
                  <template v-else>
                    {{ option }}
                  </template>
                </a-select-option>
              </a-select>
            </a-form-item>

            <a-form-item class="flex w-1/2" :label="$t('labels.onDelete')">
              <a-select
                v-model:value="vModel.onDelete"
                :disabled="vModel.virtual"
                name="onDelete"
                dropdown-class-name="nc-dropdown-on-delete"
                @change="onDataTypeChange"
              >
                <template #suffixIcon>
                  <GeneralIcon icon="arrowDown" class="text-gray-700" />
                </template>
                <a-select-option v-for="(option, i) of onUpdateDeleteOptions" :key="i" :value="option">
                  <template v-if="option === 'NO ACTION'">{{ $t('title.links.noAction') }}</template>
                  <template v-else-if="option === 'CASCADE'">{{ $t('title.links.cascade') }}</template>
                  <template v-else-if="option === 'RESTRICT'">{{ $t('title.links.restrict') }}</template>
                  <template v-else-if="option === 'SET NULL'">{{ $t('title.links.setNull') }}</template>
                  <template v-else-if="option === 'SET DEFAULT'">{{ $t('title.links.setDefault') }}</template>
                  <template v-else>
                    {{ option }}
                  </template>
                </a-select-option>
              </a-select>
            </a-form-item>
          </div>

          <div class="flex flex-row">
            <a-form-item>
              <div class="flex items-center gap-1">
                <NcSwitch v-model:checked="vModel.virtual" @change="onDataTypeChange">
                  <div class="text-sm text-gray-800 select-none">
                    {{ $t('title.virtualRelation') }}
                  </div>
                </NcSwitch>
              </div>
            </a-form-item>
          </div>
        </template>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
:deep(.nc-ltar-relation-type .ant-radio-group) {
  @apply flex justify-between gap-2 children:(flex-1 m-0 px-2 py-1 border-1 border-gray-200 rounded-lg);

  .ant-radio-wrapper {
    @apply transition-all flex-row-reverse justify-between items-center py-1 pl-1 pr-3;

    &.ant-radio-wrapper-checked:not(.ant-radio-wrapper-disabled) {
      @apply border-brand-500;
    }

    span:not(.ant-radio):not(.nc-ltar-icon) {
      @apply flex-1 pl-0 flex items-center gap-2;
    }
    .ant-radio {
      @apply top-0;
    }

    .nc-ltar-icon {
      @apply inline-flex items-center p-1 rounded-md;
    }
  }
}

:deep(.nc-ltar-relation-type .ant-col.ant-form-item-control) {
  @apply h-8.5;
}
</style>
