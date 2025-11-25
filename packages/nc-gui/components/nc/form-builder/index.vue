<script lang="ts" setup>
import { type FormBuilderElement, type IntegrationType } from 'nocodb-sdk'
import { FORM_BUILDER_NON_CATEGORIZED, FormBuilderInputType, iconMap } from '#imports'

const emit = defineEmits(['change'])

const workflowContext = inject(WorkflowVariableInj, null)

const {
  form,
  formState,
  formSchema,
  formElementsCategorized,
  isLoading,
  validateInfos,
  deepReference,
  setFormState,
  loadOptions,
  getFieldOptions,
  getIsLoadingFieldOptions,
} = useFormBuilderHelperOrThrow()

const { loadIntegrations, addIntegration, integrations, eventBus, pageMode, IntegrationsPageMode } =
  useProvideIntegrationViewStore()

const selectMode = (field: FormBuilderElement) => {
  return field.selectMode === 'multipleWithInput' ? 'tags' : field.selectMode === 'multiple' ? 'multiple' : undefined
}

const haveIntegrationInput = computed(() => {
  return unref(formSchema)?.some((field) => field.type === FormBuilderInputType.SelectIntegration)
})

const filteredIntegrations = computed(() => {
  if (!haveIntegrationInput.value) return {}

  return (unref(formSchema) || [])
    .filter((field) => field.type === FormBuilderInputType.SelectIntegration && field.model)
    .reduce((acc, field) => {
      acc[field.model!] = integrations.value.filter((integration) => {
        if (field.integrationFilter) {
          return (
            (!field.integrationFilter.type || field.integrationFilter.type === integration.type) &&
            (!field.integrationFilter.sub_type || field.integrationFilter.sub_type === integration.sub_type)
          )
        }
        return true
      })
      return acc
    }, {} as Record<string, IntegrationType[]>)
})

const integrationOptions = computed(() => {
  if (!haveIntegrationInput.value) return {}

  return Object.keys(filteredIntegrations.value).reduce((acc, key) => {
    acc[key] = filteredIntegrations.value[key]!.map((integration) => ({
      label: integration.title as string,
      value: integration.id as string,
    }))
    return acc
  }, {} as Record<string, { label: string; value: string }[]>)
})

const activeModel = ref<string | null>(null)

const handleAddNewConnection = (field: FormBuilderElement) => {
  const model = field.model!

  if (field.integrationFilter) {
    const filteredIntegtegrations = allIntegrations.filter((i) => {
      if (field.integrationFilter) {
        return (
          (!field.integrationFilter.type || field.integrationFilter.type === i.type) &&
          (!field.integrationFilter.sub_type || field.integrationFilter.sub_type === i.sub_type)
        )
      }
      return true
    })

    if (filteredIntegtegrations?.length === 1) {
      addIntegration(filteredIntegtegrations[0]!, false)

      activeModel.value = null

      nextTick(() => {
        activeModel.value = model
      })

      return
    }
  }
  activeModel.value = null

  nextTick(() => {
    pageMode.value = IntegrationsPageMode.LIST
    activeModel.value = model
  })
}

const workflowVariables = computed(() => {
  if (!workflowContext?.selectedNodeId?.value || !workflowContext?.getAvailableVariablesFlat) {
    return []
  }
  return workflowContext.getAvailableVariablesFlat(workflowContext.selectedNodeId.value)
})

// Get grouped workflow variables for WorkflowInput fields
const workflowVariablesGrouped = computed(() => {
  if (!workflowContext?.selectedNodeId?.value || !workflowContext?.getAvailableVariables) {
    return []
  }
  return workflowContext.getAvailableVariables(workflowContext.selectedNodeId.value)
})

const filterIntegration = computed(() => {
  if (!activeModel.value) return { type: () => true, sub_type: () => true }

  const field = (unref(formSchema) || []).find((field) => field.model === activeModel.value)

  return {
    type: (f: IntegrationCategoryItemType) => {
      return !!(!field?.integrationFilter?.type || f.value === field?.integrationFilter?.type)
    },
    sub_type: (f: IntegrationItemType) => {
      return !!(!field?.integrationFilter?.sub_type || f.sub_type === field?.integrationFilter?.sub_type)
    },
  }
})

const setFormStateWithEmit = (path: string, value: any) => {
  setFormState(path, value)
  emit('change', path, value)
}

const integegrationEventHandler = (event: IntegrationStoreEvents, payload: any) => {
  if (event === IntegrationStoreEvents.INTEGRATION_ADD && payload?.id && activeModel.value) {
    setFormStateWithEmit(activeModel.value, payload.id)
    activeModel.value = null
  }
}

eventBus.on(integegrationEventHandler)

onBeforeUnmount(() => {
  eventBus.off(integegrationEventHandler)
})

watch(
  () => unref(formSchema),
  async () => {
    // if integration field is available, load the integration state
    if (haveIntegrationInput.value) {
      await loadIntegrations()
    }
  },
  { immediate: true },
)
</script>

<template>
  <div class="nc-form-builder nc-scrollbar-thin relative">
    <a-form ref="form" :model="formState" hide-required-mark layout="vertical" class="flex flex-col gap-8 !pb-2">
      <template v-for="category in Object.keys(formElementsCategorized)" :key="category">
        <div class="nc-form-section">
          <div v-if="category !== FORM_BUILDER_NON_CATEGORIZED" class="nc-form-section-title">{{ category }}</div>
          <div class="nc-form-section-body-grid">
            <template v-for="field in formElementsCategorized[category]" :key="field.model">
              <div
                v-if="field.type === FormBuilderInputType.Space"
                :style="{
                  gridColumn: `span ${field.span || 24}`,
                }"
              ></div>

              <a-form-item
                v-else
                v-bind="validateInfos[field.model]"
                class="nc-form-item"
                :style="{
                  gridColumn: `span ${field.span || 24}`,
                }"
                :required="false"
                :data-testid="`nc-form-input-${field.model}`"
              >
                <template v-if="![FormBuilderInputType.Switch, FormBuilderInputType.Checkbox].includes(field.type)" #label>
                  <div class="flex items-center gap-1 w-full">
                    <div class="flex-1 flex items-center gap-1">
                      <span>{{ field.label }}</span>
                      <span
                        v-if="
                          field.required &&
                          ![
                            FormBuilderInputType.Select,
                            FormBuilderInputType.SelectIntegration,
                            FormBuilderInputType.SelectBase,
                          ].includes(field.type)
                        "
                        class="text-nc-content-red-medium"
                        >*</span
                      >
                      <NcTooltip v-if="field.helpText && field.showHintAsTooltip">
                        <template #title>
                          <div class="text-xs">
                            {{ field.helpText }}
                          </div>
                        </template>
                        <GeneralIcon icon="info" class="text-nc-content-gray-muted h-4" />
                      </NcTooltip>
                    </div>

                    <a
                      v-if="field.docsLink"
                      :href="field.docsLink"
                      target="_blank"
                      rel="noopener noreferrer"
                      class="text-xs justify-self-end no-underline hover:underline"
                    >
                      {{ $t('title.docs') }}
                    </a>
                  </div>
                </template>
                <template v-if="field.type === FormBuilderInputType.Input">
                  <a-input
                    autocomplete="off"
                    class="!w-full"
                    :value="deepReference(field.model)"
                    @update:value="setFormStateWithEmit(field.model, $event)"
                  />
                </template>
                <template v-else-if="field.type === FormBuilderInputType.Password">
                  <a-input-password
                    readonly
                    onfocus="this.removeAttribute('readonly');"
                    onblur="this.setAttribute('readonly', true);"
                    autocomplete="off"
                    :value="deepReference(field.model)"
                    @update:value="setFormStateWithEmit(field.model, $event)"
                  />
                </template>
                <template v-else-if="field.type === FormBuilderInputType.Select">
                  <NcFormBuilderInputMountedWrapper @mounted="loadOptions(field)">
                    <NcSelect
                      :value="deepReference(field.model)"
                      :options="field.fetchOptionsKey ? getFieldOptions(field.model) : field.options"
                      :mode="selectMode(field)"
                      show-search
                      :loading="field.fetchOptionsKey && getIsLoadingFieldOptions(field.model)"
                      @update:value="setFormStateWithEmit(field.model, $event)"
                    />
                  </NcFormBuilderInputMountedWrapper>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.Switch">
                  <div class="flex flex-col px-2" :class="field.border ? 'border-1 rounded-lg shadow' : ''">
                    <div class="flex items-center aa">
                      <NcSwitch
                        :checked="!!deepReference(field.model)"
                        @update:checked="setFormStateWithEmit(field.model, $event)"
                      />
                      <span class="ml-[6px] font-bold">{{ field.label }}</span>
                      <NcTooltip v-if="field.helpText">
                        <template #title>
                          <div class="text-xs">
                            {{ field.helpText }}
                          </div>
                        </template>
                        <GeneralIcon icon="info" class="text-nc-content-gray-muted h-4 ml-1" />
                      </NcTooltip>
                    </div>
                    <div v-if="field.helpText && !field.showHintAsTooltip" class="w-full mt-1 pl-[35px]">
                      <div class="text-xs text-nc-content-gray-muted">{{ field.helpText }}</div>
                    </div>
                  </div>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.SelectIntegration">
                  <a-select
                    :value="deepReference(field.model)"
                    :options="integrationOptions[field.model]"
                    dropdown-match-select-width
                    class="nc-select-shadow"
                    placeholder="Select Integration"
                    allow-clear
                    show-search
                    @update:value="setFormStateWithEmit(field.model, $event)"
                  >
                    <template #suffixIcon>
                      <GeneralIcon icon="ncChevronDown" class="text-nc-content-gray-muted" />
                    </template>
                    <a-select-option
                      v-for="integration in filteredIntegrations[field.model]"
                      :key="integration.id"
                      :value="integration.id"
                    >
                      <div class="w-full flex gap-2 items-center" :data-testid="integration.title">
                        <GeneralIntegrationIcon v-if="integration?.sub_type" :type="integration.sub_type" />
                        <NcTooltip class="flex-1 truncate">
                          <template #title>
                            {{ integration.title }}
                          </template>
                          {{ integration.title }}
                        </NcTooltip>
                        <component
                          :is="iconMap.check"
                          v-if="formState.fk_integration_id === integration.id"
                          id="nc-selected-item-icon"
                          class="text-primary w-4 h-4"
                        />
                      </div>
                    </a-select-option>

                    <template #dropdownRender="{ menuNode: menu }">
                      <component :is="menu" />
                      <a-divider style="margin: 4px 0" />
                      <div
                        class="px-1.5 flex items-center text-nc-content-brand text-sm cursor-pointer"
                        @mousedown.prevent
                        @click="handleAddNewConnection(field)"
                      >
                        <div class="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-nc-bg-gray-light">
                          <GeneralIcon icon="plus" class="flex-none" />
                          {{ $t('general.new') }} {{ $t('general.connection').toLowerCase() }}
                        </div>
                      </div>
                    </template>
                  </a-select>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.SelectBase">
                  <NcFormBuilderInputSelectBase
                    :value="deepReference(field.model)"
                    @update:value="setFormStateWithEmit(field.model, $event)"
                  />
                </template>
                <template v-else-if="field.type === FormBuilderInputType.SelectTable">
                  <NcFormBuilderInputMountedWrapper @mounted="loadOptions(field)">
                    <NcFormBuilderInputSelectTable
                      :multiple="field?.selectMode === 'multiple'"
                      :value="deepReference(field.model)"
                      :options="getFieldOptions(field.model)"
                      @update:value="setFormStateWithEmit(field.model, $event)"
                    />
                  </NcFormBuilderInputMountedWrapper>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.SelectView">
                  <NcFormBuilderInputMountedWrapper @mounted="loadOptions(field)">
                    <NcFormBuilderInputSelectView
                      :multiple="field?.selectMode === 'multiple'"
                      :value="deepReference(field.model)"
                      :options="getFieldOptions(field.model)"
                      @update:value="setFormStateWithEmit(field.model, $event)"
                    />
                  </NcFormBuilderInputMountedWrapper>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.SelectField">
                  <NcFormBuilderInputMountedWrapper @mounted="loadOptions(field)">
                    <NcFormBuilderInputSelectField
                      :multiple="field?.selectMode === 'multiple'"
                      :value="deepReference(field.model)"
                      :options="getFieldOptions(field.model)"
                      @update:value="setFormStateWithEmit(field.model, $event)"
                    />
                  </NcFormBuilderInputMountedWrapper>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.OAuth">
                  <NcFormBuilderInputOAuth
                    :value="deepReference(field.model)"
                    :element="field"
                    :have-value="!!deepReference(field.model)"
                    :form-data="formState"
                    @update:value="setFormStateWithEmit(field.model, $event)"
                  />
                </template>
                <template v-else-if="field.type === FormBuilderInputType.Checkbox">
                  <div
                    class="px-3 py-2 border-1 cursor-pointer rounded-lg shadow-default transition-shadow border-nc-border-gray-medium"
                    @click="setFormStateWithEmit(field.model, !deepReference(field.model))"
                  >
                    <div class="flex gap-3">
                      <NcCheckbox :checked="deepReference(field.model)" />
                      <div class="text-nc-content-gray text-caption">
                        {{ field.label }}
                      </div>
                    </div>
                    <div v-if="field.description" class="text-nc-content-gray-muted text-bodySm mt-1 pl-7.8">
                      {{ field.description }}
                    </div>
                  </div>
                </template>
                <template v-else-if="field.type === FormBuilderInputType.WorkflowInput">
                  <NcFormBuilderInputWorkflowInput
                    :model-value="deepReference(field.model)"
                    :placeholder="field.placeholder"
                    :variables="workflowVariables"
                    :grouped-variables="workflowVariablesGrouped"
                    @update:model-value="setFormStateWithEmit(field.model, $event)"
                  />
                </template>
                <div
                  v-if="field.helpText && field.type !== FormBuilderInputType.Switch && !field.showHintAsTooltip"
                  class="w-full mt-1"
                >
                  <div class="text-xs text-nc-content-gray-muted">{{ field.helpText }}</div>
                </div>
              </a-form-item>
            </template>
          </div>
        </div>
      </template>
    </a-form>
    <template v-if="haveIntegrationInput && activeModel">
      <WorkspaceIntegrationsTab
        is-modal
        :filter-category="filterIntegration.type"
        :filter-integration="filterIntegration.sub_type"
      />
      <WorkspaceIntegrationsEditOrAdd />
    </template>
    <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15">
      <div class="flex items-center justify-center h-full w-full !bg-nc-bg-default !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-item {
  @apply px-0.5;
  margin-bottom: 12px;
}

:deep(.ant-collapse-header) {
  @apply !-mt-4 !p-0 flex items-center !cursor-default children:first:flex;
}

:deep(.ant-collapse-icon-position-right > .ant-collapse-item > .ant-collapse-header .ant-collapse-arrow) {
  @apply !right-0;
}

:deep(.ant-collapse-content-box) {
  @apply !px-0 !pb-0 !pt-3;
}

:deep(.ant-form-item-explain-error) {
  @apply !text-xs;
}

:deep(.ant-divider) {
  @apply m-0;
}

:deep(.ant-form-item-with-help .ant-form-item-explain) {
  @apply !min-h-0;
}

:deep(.ant-select .ant-select-selector .ant-select-selection-item) {
  @apply font-weight-400;
}

.nc-form-builder {
  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input),
  :deep(.ant-select) {
    @apply !appearance-none border-solid rounded-md;
  }

  :deep(.ant-input-password) {
    input {
      @apply !border-none my-0;
    }
  }

  :deep(.ant-form-item-label > label.ant-form-item-required:after) {
    @apply content-['*'] inline-block text-inherit text-nc-content-red-medium ml-1;
  }

  :deep(.ant-form-item-label label) {
    @apply w-full;
  }

  :deep(.ant-form-item) {
    &.ant-form-item-has-error {
      &:not(:has(.ant-input-password)) .ant-input {
        &:not(:hover):not(:focus):not(:disabled) {
          @apply shadow-default;
        }

        &:hover:not(:focus):not(:disabled) {
          @apply shadow-hover;
        }

        &:focus {
          @apply shadow-error ring-0;
        }
      }

      .ant-input-number,
      .ant-input-affix-wrapper.ant-input-password {
        &:not(:hover):not(:focus-within):not(:disabled) {
          @apply shadow-default;
        }

        &:hover:not(:focus-within):not(:disabled) {
          @apply shadow-hover;
        }

        &:focus-within {
          @apply shadow-error ring-0;
        }
      }
    }

    &:not(.ant-form-item-has-error) {
      &:not(:has(.ant-input-password)) .ant-input {
        &:not(:hover):not(:focus):not(:disabled) {
          @apply shadow-default border-nc-border-gray-medium;
        }

        &:hover:not(:focus):not(:disabled) {
          @apply border-nc-border-gray-medium shadow-hover;
        }

        &:focus {
          @apply shadow-selected ring-0;
        }
      }

      .ant-input-number,
      .ant-input-affix-wrapper.ant-input-password {
        &:not(:hover):not(:focus-within):not(:disabled) {
          @apply shadow-default border-nc-border-gray-medium;
        }

        &:hover:not(:focus-within):not(:disabled) {
          @apply border-nc-border-gray-medium shadow-hover;
        }

        &:focus-within {
          @apply shadow-selected ring-0;
        }
      }
    }
  }

  :deep(.ant-row:not(.ant-form-item)) {
    @apply !-mx-1.5;
    & > .ant-col {
      @apply !px-1.5;
    }
  }

  :deep(.ant-form-item) {
    @apply !mb-0;
  }
}
</style>

<style lang="scss"></style>
