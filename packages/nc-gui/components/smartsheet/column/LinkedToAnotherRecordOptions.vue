<script setup lang="ts">
import {
  type LinkToAnotherRecordType,
  ModelTypes,
  PlanFeatureTypes,
  PlanTitles,
  ProjectRoles,
  RelationTypes,
  SqliteUi,
  UITypes,
  ViewTypes,
  WorkspaceUserRoles,
} from 'nocodb-sdk'

const props = defineProps<{
  value: any
  isEdit: boolean
}>()

const emit = defineEmits(['update:value'])

const vModel = useVModel(props, 'value', emit)

const isEdit = toRef(props, 'isEdit')

const meta = inject(MetaInj, ref())

const filterRef = ref()

const crossBase = ref((vModel.value?.colOptions as LinkToAnotherRecordType)?.fk_related_base_id !== vModel.value?.base_id)

const { basesList } = storeToRefs(useBases())

const { setAdditionalValidations, setPostSaveOrUpdateCbk, validateInfos, onDataTypeChange, sqlUi, isXcdbBase, updateFieldName } =
  useColumnCreateStoreOrThrow()

const baseStore = useBase()
const { tables } = storeToRefs(baseStore)

const viewsStore = useViewsStore()
const { viewsByTable } = storeToRefs(viewsStore)

const { t } = useI18n()

const { getPlanTitle } = useEeConfig()

const { metas, getMeta } = useMetas()

if (!isEdit.value) {
  setAdditionalValidations({
    childId: [{ required: true, message: t('general.required') }],
  })
}

const onUpdateDeleteOptions = ['NO ACTION', 'CASCADE', 'RESTRICT', 'SET NULL', 'SET DEFAULT']

if (!isEdit.value) {
  if (!vModel.value.parentId) vModel.value.parentId = meta.value?.id
  if (!vModel.value.childColumn) vModel.value.childColumn = `${meta.value?.table_name}_id`
  if (!vModel.value.childTable) vModel.value.childTable = meta.value?.table_name
  if (!vModel.value.parentTable) vModel.value.parentTable = vModel.value.rtn || ''
  if (!vModel.value.parentColumn) vModel.value.parentColumn = vModel.value.rcn || ''

  if (!vModel.value.type) vModel.value.type = 'mm'
  if (!vModel.value.onUpdate) vModel.value.onUpdate = onUpdateDeleteOptions[0]
  if (!vModel.value.onDelete) vModel.value.onDelete = onUpdateDeleteOptions[0]
  if (!vModel.value.virtual) vModel.value.virtual = sqlUi instanceof SqliteUi // appInfo.isCloud || sqlUi === SqliteUi
  if (!vModel.value.alias) vModel.value.alias = vModel.value.column_name
} else {
  const colOptions = vModel.value?.colOptions as LinkToAnotherRecordType
  if (vModel.value?.meta?.custom && isEeUI) {
    let ref_column_id = colOptions.fk_child_column_id
    let column_id = colOptions.fk_parent_column_id

    // extract ref column id from colOptions
    if (
      colOptions.type === RelationTypes.MANY_TO_MANY ||
      colOptions.type === RelationTypes.BELONGS_TO ||
      vModel?.value?.meta?.bt
    ) {
      ref_column_id = colOptions.fk_parent_column_id
      column_id = colOptions.fk_child_column_id
    }
    vModel.value.custom = {
      ref_model_id: colOptions?.fk_related_model_id,
      base_id: meta.value?.base_id,
      junc_base_id: meta.value?.base_id,
      junc_model_id: colOptions?.fk_mm_model_id,
      junc_ref_column_id: colOptions?.fk_mm_parent_column_id,
      junc_column_id: colOptions?.fk_mm_child_column_id,
      ref_column_id,
      column_id,
    }
  }
  vModel.value.is_custom_link = vModel.value?.meta?.custom

  if (!vModel.value.childViewId) vModel.value.childViewId = vModel.value?.colOptions?.fk_target_view_id || null
}
if (!vModel.value.childId) vModel.value.childId = vModel.value?.colOptions?.fk_related_model_id || null
if (!vModel.value.childViewId) vModel.value.childViewId = vModel.value?.colOptions?.fk_target_view_id || null
if (!vModel.value.type) vModel.value.type = vModel.value?.colOptions?.type || 'mm'

const advancedOptions = ref(false)

const tablesStore = useTablesStore()
const { baseTables } = storeToRefs(tablesStore)

const { isFeatureEnabled } = useBetaFeatureToggle()

const refTables = computed(() => {
  if (isEdit.value) {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const refTableId = referenceTableChildId.value
    if (!metas.value[refTableId]) getMeta(refTableId)
    return [metas.value[refTableId]]
  }

  if (!crossBase.value) {
    if (!tables.value || !tables.value.length) {
      return []
    }

    return tables.value.filter((t) => t.type === ModelTypes.TABLE && t.source_id === meta.value?.source_id)
  }

  if (!baseTables.value.get(vModel.value.ref_base_id)) {
    return []
  }

  return [...baseTables.value.get(vModel.value.ref_base_id).filter((t) => t.type === ModelTypes.TABLE)]
})

const refViews = computed(() => {
  const childId = vModel.value?.is_custom_link ? vModel.value?.custom?.ref_model_id : vModel.value?.childId

  if (!childId) return []
  const views = viewsByTable.value.get(childId)

  return (views || []).filter((v) => v.type !== ViewTypes.FORM)
})

const filterOption = (value: string, option: { key: string }) => option.key.toLowerCase().includes(value.toLowerCase())

const isLinks = computed(() => vModel.value.uidt === UITypes.Links && vModel.value.type !== RelationTypes.ONE_TO_ONE)

watch(
  () => (vModel.value?.is_custom_link ? vModel.value?.custom?.ref_model_id : vModel.value?.childId),
  async (tableId) => {
    if (tableId) {
      getMeta(tableId).catch(() => {
        // ignore
      })
      viewsStore
        .loadViews({
          ignoreLoading: true,
          tableId,
        })
        .catch(() => {
          // ignore
        })
    }
  },
  {
    immediate: true,
  },
)

vModel.value.meta = vModel.value.meta || {}
const limitRecToView = ref(!!vModel.value.childViewId)
const limitRecToCond = computed({
  get() {
    return !!vModel.value.meta?.enableConditions
  },
  set(value) {
    vModel.value.meta = vModel.value.meta || {}
    vModel.value.meta.enableConditions = value
  },
})

const onLimitRecToViewChange = (value: boolean) => {
  if (!value) {
    vModel.value.childViewId = null
  }
}

provide(
  MetaInj,
  computed(() => {
    const childId = vModel.value?.is_custom_link ? vModel.value?.custom?.ref_model_id : vModel.value?.childId
    return metas.value[childId] || {}
  }),
)

onMounted(() => {
  setPostSaveOrUpdateCbk(async ({ colId, column }) => {
    await filterRef.value?.applyChanges(colId || column.id, false)
  })
})

onUnmounted(() => {
  setPostSaveOrUpdateCbk(null)
})

const referenceTableChildId = computed({
  get: () => (isEdit.value ? vModel.value?.colOptions?.fk_related_model_id : vModel.value?.childId) ?? null,
  set: (value) => {
    if (!isEdit.value && value) {
      vModel.value.childId = value
      vModel.value.childTableTitle = refTables.value.find((t) => t.id === value)?.title
    }
  },
})

const linkType = computed({
  get: () => (isEdit.value ? vModel.value?.colOptions?.type : vModel.value?.type) ?? null,
  set: (value) => {
    if (!isEdit.value && value) {
      vModel.value.type = value

      updateFieldName()
    }
  },
})

const referenceBaseId = computed({
  get: () => vModel.value?.ref_base_id ?? (vModel.value?.colOptions as LinkToAnotherRecordType)?.fk_related_base_id,
  set: (value) => {
    if (!isEdit.value && value) {
      vModel.value.ref_base_id = value
    }
  },
})

const handleUpdateRefTable = () => {
  onDataTypeChange()

  nextTick(() => {
    updateFieldName()
  })
}

const onBaseChange = async (baseId: string) => {
  // load tables for the selected base
  await tablesStore.loadProjectTables(baseId)

  // reset current model id value
  if (referenceTableChildId.value) {
    referenceTableChildId.value = null
  }
}

const cusValidators = {
  'custom.column_id': [{ required: true, message: t('general.required') }],
  'custom.ref_model_id': [{ required: true, message: t('general.required') }],
  'custom.ref_column_id': [{ required: true, message: t('general.required') }],
}

const cusJuncTableValidations = {
  'custom.junc_model_id': [{ required: true, message: t('general.required') }],
  'custom.junc_column_id': [{ required: true, message: t('general.required') }],
  'custom.junc_ref_column_id': [{ required: true, message: t('general.required') }],
}

const onCustomSwitchToggle = () => {
  if (vModel.value?.is_custom_link) {
    setAdditionalValidations({
      childId: [],
      ...cusValidators,
      ...(vModel.value.type === RelationTypes.MANY_TO_MANY ? cusJuncTableValidations : {}),
    })
    vModel.value.virtual = true
  } else
    setAdditionalValidations({
      childId: [{ required: true, message: t('general.required') }],
    })
}

const onCustomSwitchLabelClick = () => {
  if (isEdit.value) return

  vModel.value.is_custom_link = !vModel.value.is_custom_link
  onCustomSwitchToggle()
}

const onViewLabelClick = () => {
  if (!vModel.value.childId && !(vModel.value.is_custom_link && vModel.value.custom?.ref_model_id)) return

  limitRecToView.value = !limitRecToView.value
  return onLimitRecToViewChange()
}
const onFilterLabelClick = () => {
  if (!vModel.value.childId && !(vModel.value.is_custom_link && vModel.value.custom?.ref_model_id)) return

  limitRecToCond.value = !limitRecToCond.value
}

const onCrossBaseToggle = () => {
  // reset current model id value if cross base disabled and selected table is not in current base
  if (!crossBase.value) {
    referenceBaseId.value = null
    if (refTables.value.every((t) => t.id !== referenceTableChildId)) {
      referenceTableChildId.value = null
    }
  }
}

// check user have creator or above role to create cross base link to the base
const canCreateCrossBaseLink = (base: { workspace_role: string; base_role: string }) => {
  if (base.project_role) {
    if ([ProjectRoles.CREATOR, ProjectRoles.OWNER].includes(base.project_role)) {
      return true
    }
  } else if (base.workspace_role) {
    if ([WorkspaceUserRoles.CREATOR, WorkspaceUserRoles.OWNER].includes(base.workspace_role)) {
      return true
    }
  }

  return false
}

const toggleCrossBase = () => {
  if (isEdit.value) return

  crossBase.value = !crossBase.value
  onCrossBaseToggle()
}

const handleScrollIntoView = () => {
  filterRef.value?.$el?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    inline: 'nearest',
  })
}
</script>

<template>
  <div class="w-full flex flex-col gap-4">
    <div class="flex flex-col gap-4">
      <a-form-item :label="$t('labels.relationType')" class="nc-ltar-relation-type">
        <a-radio-group v-model:value="linkType" name="type" :disabled="isEdit">
          <a-radio value="mm" data-testid="Many to Many">
            <span class="nc-ltar-icon nc-mm-icon">
              <GeneralIcon icon="mm_solid" />
            </span>
            {{ $t('title.manyToMany') }}
          </a-radio>
          <a-radio value="hm" data-testid="Has Many">
            <span class="nc-ltar-icon nc-hm-icon">
              <GeneralIcon icon="hm_solid" />
            </span>
            {{ $t('title.hasMany') }}
          </a-radio>
          <a-radio value="oo" data-testid="One to One">
            <span class="nc-ltar-icon nc-oo-icon">
              <GeneralIcon icon="oneToOneSolid" />
            </span>
            {{ $t('title.oneToOne') }}
          </a-radio>
        </a-radio-group>
      </a-form-item>
    </div>
    <div v-if="isFeatureEnabled(FEATURE_FLAG.CUSTOM_LINK) && isEeUI">
      <a-switch
        v-model:checked="vModel.is_custom_link"
        :disabled="isEdit"
        :is-edit="isEdit"
        size="small"
        name="Custom"
        @change="onCustomSwitchToggle"
      />
      <span
        class="ml-3"
        :class="{
          'cursor-pointer': !isEdit,
        }"
        @click="onCustomSwitchLabelClick"
        >Advanced Link</span
      >
    </div>
    <div v-if="isEeUI && vModel.is_custom_link">
      <LazySmartsheetColumnLinkAdvancedOptions v-model:value="vModel" :is-edit="isEdit" :meta="meta" />
    </div>
    <template v-else>
      <template v-if="isFeatureEnabled(FEATURE_FLAG.CROSS_BASE_LINK)">
        <div>
          <a-switch
            v-model:checked="crossBase"
            :disabled="isEdit"
            :is-edit="isEdit"
            size="small"
            name="crossBase"
            @change="onCrossBaseToggle"
          />

          <a-tooltip>
            <template v-if="!isEdit" #title>{{ $t('tooltip.crossBase') }}</template>
            <span
              class="ml-3"
              :class="{
                'cursor-pointer': !isEdit,
              }"
              @click="toggleCrossBase"
              @dblclick="onCustomSwitchLabelClick"
              >{{ $t('labels.crossBase') }}</span
            >
          </a-tooltip>
        </div>

        <a-form-item v-if="crossBase" class="flex w-full pb-2 nc-ltar-child-table" v-bind="validateInfos.childBaseId">
          <a-select
            v-model:value="referenceBaseId"
            show-search
            :disabled="isEdit"
            :filter-option="filterOption"
            placeholder="Select base"
            dropdown-class-name="nc-dropdown-ltar-child-table"
            @change="onBaseChange(referenceBaseId)"
          >
            <template #suffixIcon>
              <GeneralIcon icon="arrowDown" class="text-gray-700" />
            </template>
            <a-select-option
              v-for="base of basesList"
              :key="base.title"
              :disabled="!canCreateCrossBaseLink(base)"
              :value="base.id"
            >
              <a-tooltip>
                <template v-if="!canCreateCrossBaseLink(base)" #title>
                  You can only link to tables in bases where you have creator access or above.
                </template>
                <div class="flex w-full items-center gap-2">
                  <div class="min-w-5 flex items-center justify-center">
                    <GeneralProjectIcon :color="parseProp(base.meta).iconColor" :type="base.type" class="nc-project-icon" />
                  </div>
                  <NcTooltip class="flex-1 truncate" show-on-truncate-only>
                    <template #title>{{ base.title }}</template>
                    <span>{{ base.title }}</span>
                  </NcTooltip>

                  <div class="flex gap-2 items-center">
                    <div v-if="base?.id === meta?.base_id" class="text-nc-content-gray-muted leading-4.5 text-xs">
                      {{ $t('labels.currentBase') }}
                    </div>
                  </div>
                </div>
              </a-tooltip>
            </a-select-option>
          </a-select>
        </a-form-item>
      </template>
      <a-form-item class="flex w-full pb-2 nc-ltar-child-table" v-bind="validateInfos.childId">
        <a-select
          v-model:value="referenceTableChildId"
          show-search
          :disabled="isEdit"
          :filter-option="filterOption"
          placeholder="select table to link"
          dropdown-class-name="nc-dropdown-ltar-child-table"
          @change="handleUpdateRefTable"
        >
          <template #suffixIcon>
            <GeneralIcon icon="arrowDown" class="text-gray-700" />
          </template>
          <a-select-option v-for="table of refTables" :key="table.title" :value="table.id">
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
    </template>

    <div class="flex flex-col gap-2">
      <div class="flex gap-2 items-center">
        <a-switch
          v-model:checked="limitRecToView"
          v-e="['c:link:limit-record-by-view', { status: limitRecToView }]"
          size="small"
          :disabled="!vModel.childId && !(vModel.is_custom_link && vModel.custom?.ref_model_id)"
          @change="onLimitRecToViewChange"
        ></a-switch>
        <span
          v-e="['c:link:limit-record-by-view', { status: limitRecToView }]"
          class="text-s cursor-pointer"
          data-testid="nc-limit-record-view"
          @click="onViewLabelClick"
          >{{ $t('labels.limitRecordSelectionToView') }}</span
        >
      </div>
      <a-form-item v-if="limitRecToView" class="!pl-8 flex w-full pb-2 mt-4 space-y-2 nc-ltar-child-view">
        <NcSelect
          v-model:value="vModel.childViewId"
          :placeholder="$t('labels.selectView')"
          show-search
          :filter-option="filterOption"
          dropdown-class-name="nc-dropdown-ltar-child-view"
        >
          <a-select-option v-for="view of refViews" :key="view.title" :value="view.id">
            <div class="flex w-full items-center gap-2">
              <div class="min-w-5 flex items-center justify-center">
                <GeneralViewIcon :meta="view" class="text-gray-500" />
              </div>
              <span v-if="view.is_default">{{ $t('labels.defaultView') }}</span>
              <NcTooltip v-else class="flex-1 truncate" show-on-truncate-only>
                <template #title>{{ view.title }}</template>
                <span>{{ view.title }}</span>
              </NcTooltip>
            </div>
          </a-select-option>
        </NcSelect>
      </a-form-item>
    </div>

    <template v-if="isEeUI">
      <div class="flex flex-col gap-2">
        <PaymentUpgradeBadgeProvider :feature="PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER">
          <template #default="{ click }">
            <div class="flex gap-2 items-center">
              <a-switch
                v-e="['c:link:limit-record-by-filter', { status: limitRecToCond }]"
                :checked="limitRecToCond"
                :disabled="!vModel.childId && !(vModel.is_custom_link && vModel.custom?.ref_model_id)"
                size="small"
                @change="
                  (value) => {
                    if (value && click(PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER)) return

                    onFilterLabelClick()
                  }
                "
              ></a-switch>
              <span
                v-e="['c:link:limit-record-by-filter', { status: limitRecToCond }]"
                data-testid="nc-limit-record-filters"
                class="cursor-pointer"
                @click="click(PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER, () => onFilterLabelClick())"
              >
                {{ $t('labels.limitRecordSelectionToFilters') }}
              </span>
              <LazyPaymentUpgradeBadge
                v-if="!limitRecToCond"
                :feature="PlanFeatureTypes.FEATURE_LTAR_LIMIT_SELECTION_BY_FILTER"
                :content="
                  $t('upgrade.upgradeToAddLimitRecordSelection', {
                    plan: getPlanTitle(PlanTitles.PLUS),
                  })
                "
              />
            </div>
          </template>
        </PaymentUpgradeBadgeProvider>
        <div v-if="limitRecToCond" class="overflow-auto nc-scrollbar-thin">
          <LazySmartsheetToolbarColumnFilter
            ref="filterRef"
            v-model="vModel.filters"
            class="!pl-8 !p-0 max-w-620px"
            :auto-save="false"
            :show-loading="false"
            :link="true"
            :root-meta="meta"
            :link-col-id="vModel.id"
            @add-filter="handleScrollIntoView"
            @add-filter-group="handleScrollIntoView"
          />
        </div>
      </div>
    </template>
    <template v-if="(!isXcdbBase && !isEdit) || isLinks">
      <div>
        <NcButton
          size="small"
          type="text"
          class="!text-gray-500 !hover:text-gray-700"
          @click.stop="advancedOptions = !advancedOptions"
        >
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
                <NcSwitch v-model:checked="vModel.virtual" :disabled="vModel.is_custom_link" @change="onDataTypeChange">
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
:deep(.nc-filter-grid) {
  @apply !pr-0;
}

:deep(.nc-ltar-relation-type .ant-radio-group) {
  @apply flex justify-between gap-2 children:(flex-1 m-0 px-2 py-1 border-1 border-gray-300 rounded-lg);

  .ant-radio-wrapper {
    @apply transition-all flex-row-reverse justify-between items-center py-1 pl-1 pr-3;

    &.ant-radio-wrapper-checked:not(.ant-radio-wrapper-disabled):focus-within {
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

<!-- todo: remove later
<style lang="scss" scoped>
.nc-ltar-relation-type-radio-group {
  .nc-ltar-icon {
    @apply flex items-center p-1 rounded;

    &.nc-mm-icon {
      @apply bg-pink-500;
    }
    &.nc-hm-icon {
      @apply bg-orange-500;
    }
    &.nc-oo-icon {
      @apply bg-purple-500;
      :deep(svg path) {
        @apply stroke-purple-50;
      }
    }
  }

  :deep(.ant-radio-wrapper) {
    @apply px-3 py-2 flex items-center mr-0;

    &:not(:last-child) {
      @apply border-b border-gray-200;
    }
  }

  :deep(.ant-radio) {
    @apply top-0;
    & + span {
      @apply flex items-center gap-2;
    }
  }
}
</style>
-->
