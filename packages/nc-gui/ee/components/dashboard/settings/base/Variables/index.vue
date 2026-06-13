<script setup lang="ts">
import { BaseVariableInheritance, BaseVariableValueType, PlanFeatureTypes, PlanTitles } from 'nocodb-sdk'
import type { BaseVariableType } from 'nocodb-sdk'

const { t } = useI18n()

const baseStore = useBase()

const { isManagedAppInstaller, isSandbox } = storeToRefs(baseStore)

const { blockBaseVariables, showUpgradeToUseBaseVariables } = useEeConfig()

const { isUIAllowed } = useRoles()

const canCreateVariable = computed(() => isUIAllowed('baseVariableCreate'))

const canUpdateVariable = computed(() => isUIAllowed('baseVariableUpdate'))

const canDeleteVariable = computed(() => isUIAllowed('baseVariableDelete'))

const canRevertVariable = computed(() => isUIAllowed('baseVariableRevertToDefault'))

// Sandbox: fully read-only mirror from master
// Managed app instance: can override editable/required values
const isSandboxBase = computed(() => isSandbox.value)

const isManagedAppInstance = computed(() => isManagedAppInstaller.value)

const isDerivedBase = computed(() => isSandboxBase.value || isManagedAppInstance.value)

// Authors (non-derived) get full CRUD
const isAuthor = computed(() => !isDerivedBase.value)

const { variables, isLoading, listVariables, deleteVariable, revertToDefault } = useBaseVariables()

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('BaseVariable')

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => sortDirection.value,
  set: (value: Record<string, SordDirectionType>) => {
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const entries = Object.entries(value)
    if (entries.length > 0) {
      const [field, direction] = entries[0]
      saveOrUpdateSort({ field, direction })
    }
  },
})

const sortedVariables = computed(() => handleGetSortedData(variables.value, sorts.value))

const columns = computed(() => {
  const cols: NcTableColumnProps[] = [
    {
      key: 'key',
      title: t('labels.variableKey'),
      name: 'Key',
      minWidth: 200,
      padding: '12px 24px',
      showOrderBy: true,
      dataIndex: 'key',
    },
    {
      key: 'value',
      title: t('labels.variableValue'),
      minWidth: 200,
      padding: '12px 24px',
      dataIndex: 'value',
    },
    {
      key: 'inheritance',
      title: t('labels.variableInheritance'),
      width: 140,
      minWidth: 140,
      showOrderBy: true,
      dataIndex: 'inheritance',
    },
    {
      key: 'type',
      title: t('labels.variableType'),
      width: 120,
      minWidth: 120,
      dataIndex: 'type',
    },
  ]

  const hasAnyRowAction =
    (isAuthor.value && canDeleteVariable.value) ||
    (isSandboxBase.value && canDeleteVariable.value) ||
    (isManagedAppInstance.value && canRevertVariable.value)

  if (hasAnyRowAction) {
    cols.push({
      key: 'action',
      title: t('general.action'),
      width: 100,
      minWidth: 100,
      justify: 'justify-end',
      align: 'center',
    })
  }

  return cols
})

const isEditModalVisible = ref(false)

const activeVariable = ref<BaseVariableType | null>(null)

const isFixedReadonly = ref(false)

const handleOpenModal = (variable?: BaseVariableType) => {
  // Creating requires create permission; editing an existing variable requires update permission
  const requiredPerm = variable ? canUpdateVariable.value : canCreateVariable.value
  if (!requiredPerm) return

  if (blockBaseVariables.value) {
    showUpgradeToUseBaseVariables({ triggerSource: 'base-settings-base-variables' })
    return
  }
  isFixedReadonly.value = !!(isDerivedBase.value && variable?.inheritance === BaseVariableInheritance.FIXED)
  activeVariable.value = variable || null
  isEditModalVisible.value = true
}

const handleCloseModal = async () => {
  activeVariable.value = null
  isEditModalVisible.value = false
  await listVariables()
}

const handleRevert = async (variable: BaseVariableType) => {
  if (!canRevertVariable.value) return
  if (blockBaseVariables.value) {
    showUpgradeToUseBaseVariables({ triggerSource: 'base-settings-base-variables' })
    return
  }
  if (variable.id) {
    await revertToDefault(variable.id)
  }
}

const { showWarningModal } = useNcConfirmModal()

const confirmDelete = (variable: BaseVariableType) => {
  if (!canDeleteVariable.value) return
  if (blockBaseVariables.value) {
    showUpgradeToUseBaseVariables({ triggerSource: 'base-settings-base-variables' })
    return
  }
  showWarningModal({
    title: `${t('general.delete')} ${variable.key}?`,
    content: t('labels.deleteVariableConfirmation'),
    showCancelBtn: true,
    okCallback: async () => {
      if (variable.id) {
        await deleteVariable(variable.id)
      }
    },
  })
}

const getInheritanceLabel = (inheritance?: string) => {
  switch (inheritance) {
    case BaseVariableInheritance.FIXED:
      return t('labels.inheritanceFixed')
    case BaseVariableInheritance.EDITABLE:
      return t('labels.inheritanceEditable')
    case BaseVariableInheritance.REQUIRED:
      return t('labels.inheritanceRequired')
    default:
      return inheritance || ''
  }
}

const getInheritanceColor = (inheritance?: string) => {
  switch (inheritance) {
    case BaseVariableInheritance.FIXED:
      return 'text-nc-content-gray-subtle'
    case BaseVariableInheritance.EDITABLE:
      return 'text-nc-content-brand'
    case BaseVariableInheritance.REQUIRED:
      return 'text-nc-content-red-dark'
    default:
      return ''
  }
}

onMounted(async () => {
  loadSorts()
  await listVariables()
})
</script>

<template>
  <div class="flex flex-col w-full">
    <div class="flex items-center justify-between mb-4">
      <div class="text-nc-content-gray-subtle text-sm">
        {{ isSandboxBase ? $t('labels.variablesSyncedFromMaster') : isManagedAppInstance ? t('msg.info.setupRequired') : '' }}
      </div>
      <PaymentUpgradeBadgeProvider
        v-if="(isAuthor || isSandboxBase) && canCreateVariable"
        :feature="PlanFeatureTypes.FEATURE_BASE_VARIABLES"
      >
        <template #default="{ click }">
          <NcButton
            type="primary"
            size="small"
            data-testid="nc-new-variable-btn"
            @click="click(PlanFeatureTypes.FEATURE_BASE_VARIABLES, () => handleOpenModal())"
          >
            <div class="flex items-center gap-2">
              <GeneralIcon icon="plus" />
              {{ t('labels.newVariable') }}
              <LazyPaymentUpgradeBadge
                :feature="PlanFeatureTypes.FEATURE_BASE_VARIABLES"
                :plan-title="PlanTitles.PLUS"
                :limit-or-feature="PlanFeatureTypes.FEATURE_BASE_VARIABLES"
                :content="$t('upgrade.upgradeToUseBaseVariablesSubtitle', { plan: PlanTitles.PLUS })"
                :title="$t('upgrade.upgradeToUseBaseVariables')"
              />
            </div>
          </NcButton>
        </template>
      </PaymentUpgradeBadgeProvider>
    </div>

    <GeneralLoader v-if="isLoading" size="xlarge" />

    <NcTable
      v-else
      v-model:order-by="orderBy"
      :columns="columns"
      header-row-height="44px"
      row-height="44px"
      :data="sortedVariables"
      class="h-full"
      body-row-class-name="nc-base-variable-item group no-border-last"
      @row-click="handleOpenModal"
    >
      <template #bodyCell="{ column, record: variable }">
        <template v-if="column.key === 'key'">
          <div class="flex items-center gap-2">
            <NcTooltip class="truncate text-nc-content-gray font-semibold text-sm">
              {{ variable.key }}
              <template #title>
                {{ variable.description || variable.key }}
              </template>
            </NcTooltip>
            <GeneralIcon
              v-if="variable.type === BaseVariableValueType.SECRET"
              icon="lock"
              class="text-nc-content-gray-subtle flex-none w-3.5 h-3.5"
            />
            <NcTooltip v-if="isManagedAppInstance && variable.inheritance === BaseVariableInheritance.FIXED">
              <template #title> {{ $t('labels.fixedByMaster') }} </template>
              <GeneralIcon icon="lock" class="text-nc-content-gray-subtle2 flex-none w-3.5 h-3.5" />
            </NcTooltip>
          </div>
        </template>

        <template v-if="column.key === 'value'">
          <!-- Managed app instance: non-overridden editable shows "Using default" -->
          <span
            v-if="isManagedAppInstance && variable.inheritance === BaseVariableInheritance.EDITABLE && !variable.is_overridden"
            class="text-nc-content-gray-subtle2 text-sm truncate italic"
          >
            {{ $t('labels.usingDefault') }}
          </span>
          <!-- Secrets always masked; fixed masked on managed app instances -->
          <span
            v-else-if="
              variable.type === BaseVariableValueType.SECRET ||
              (isManagedAppInstance && variable.inheritance === BaseVariableInheritance.FIXED)
            "
            class="text-nc-content-gray-subtle2 text-sm truncate"
          >
            ••••••••
          </span>
          <span v-else class="text-nc-content-gray-subtle2 text-sm truncate">
            {{ variable.value || '-' }}
          </span>
        </template>

        <template v-if="column.key === 'inheritance'">
          <span :class="getInheritanceColor(variable.inheritance)" class="text-sm capitalize">
            {{ getInheritanceLabel(variable.inheritance) }}
          </span>
        </template>

        <template v-if="column.key === 'type'">
          <span class="text-nc-content-gray-subtle2 text-sm capitalize">
            {{ variable.type || 'text' }}
          </span>
        </template>

        <template v-if="column.key === 'action'">
          <div class="flex items-center justify-end gap-1">
            <!-- Author / Sandbox: delete button (sandbox can't delete fixed) -->
            <NcButton
              v-if="canDeleteVariable && (isAuthor || (isSandboxBase && variable.inheritance !== BaseVariableInheritance.FIXED))"
              type="text"
              size="xs"
              class="!opacity-0 group-hover:!opacity-100 pointer-events-none group-hover:pointer-events-auto"
              data-testid="nc-variable-delete-btn"
              @click.stop="confirmDelete(variable)"
            >
              <GeneralIcon icon="delete" class="text-nc-content-red-dark" />
            </NcButton>
            <!-- Managed app instance: revert button for overridden variables -->
            <NcTooltip v-if="canRevertVariable && isManagedAppInstance && variable.is_overridden">
              <template #title> {{ $t('labels.revertToDefault') }} </template>
              <NcButton
                type="text"
                size="xs"
                class="!opacity-0 group-hover:!opacity-100 pointer-events-none group-hover:pointer-events-auto"
                data-testid="nc-variable-revert-btn"
                @click.stop="handleRevert(variable)"
              >
                <GeneralIcon icon="ncRotateCcw" class="text-nc-content-gray-subtle" />
              </NcButton>
            </NcTooltip>
          </div>
        </template>
      </template>
    </NcTable>

    <DashboardSettingsBaseVariablesEditOrAdd
      v-if="isEditModalVisible"
      :variable="activeVariable"
      :is-author="isAuthor"
      :readonly="isFixedReadonly"
      :visible="isEditModalVisible"
      @close="handleCloseModal"
    />
  </div>
</template>
