<script lang="ts" setup>
import { type FormBuilderElement, type IntegrationType } from 'nocodb-sdk'
import { FORM_BUILDER_NON_CATEGORIZED, FormBuilderInputType, iconMap } from '#imports'

const { form, formState, formSchema, formElementsCategorized, isLoading, validateInfos, deepReference, checkCondition } =
  useFormBuilderHelperOrThrow()

const { loadIntegrations, integrations, eventBus, pageMode, IntegrationsPageMode } = useProvideIntegrationViewStore()

const setFormState = (path: string, value: any) => {
  // update nested prop in formState
  const keys = path.split('.')
  const lastKey = keys.pop()

  if (!lastKey) return

  const target = keys.reduce((acc, key) => {
    if (!acc[key]) {
      acc[key] = {}
    }
    return acc[key]
  }, formState.value)
  target[lastKey] = value
}

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

const handleAddNewConnection = (model: string) => {
  activeModel.value = null
  nextTick(() => {
    pageMode.value = IntegrationsPageMode.LIST
    activeModel.value = model
  })
}

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

eventBus.on((event, payload) => {
  if (event === IntegrationStoreEvents.INTEGRATION_ADD && payload?.id && activeModel.value) {
    setFormState(activeModel.value, payload.id)
    activeModel.value = null
  }
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
    <a-form ref="form" :model="formState" hide-required-mark layout="vertical" class="flex flex-col gap-4">
      <template v-for="category in Object.keys(formElementsCategorized)" :key="category">
        <div class="nc-form-section">
          <div v-if="category !== FORM_BUILDER_NON_CATEGORIZED" class="nc-form-section-title">{{ category }}</div>
          <div class="nc-form-section-body">
            <div class="flex flex-wrap">
              <template v-for="field in formElementsCategorized[category]" :key="field.model">
                <div
                  v-if="field.type === FormBuilderInputType.Space"
                  :style="`width:${+field.width || 100}%`"
                  class="w-full"
                ></div>
                <a-form-item
                  v-else-if="checkCondition(field.condition)"
                  v-bind="validateInfos[field.model]"
                  class="nc-form-item"
                  :style="`width:${+field.width || 100}%`"
                  :required="false"
                  :data-testid="`nc-form-input-${field.model}`"
                >
                  <template v-if="![FormBuilderInputType.Switch].includes(field.type)" #label>
                    <div class="flex items-center gap-1">
                      <span>{{ field.label }}</span>
                      <span v-if="field.required" class="text-red-500">*</span>
                      <NcTooltip v-if="field.helpText && field.showHintAsTooltip">
                        <template #title>
                          <div class="text-xs">
                            {{ field.helpText }}
                          </div>
                        </template>
                        <GeneralIcon icon="info" class="text-gray-500 h-4" />
                      </NcTooltip>
                    </div>
                  </template>
                  <template v-if="field.type === FormBuilderInputType.Input">
                    <a-input
                      autocomplete="off"
                      class="!w-full"
                      :value="deepReference(field.model)"
                      @update:value="setFormState(field.model, $event)"
                    />
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.Password">
                    <a-input-password
                      readonly
                      onfocus="this.removeAttribute('readonly');"
                      onblur="this.setAttribute('readonly', true);"
                      autocomplete="off"
                      :value="deepReference(field.model)"
                      @update:value="setFormState(field.model, $event)"
                    />
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.Select">
                    <NcSelect
                      :value="deepReference(field.model)"
                      :options="field.options"
                      :mode="selectMode(field)"
                      @update:value="setFormState(field.model, $event)"
                    />
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.Switch">
                    <div class="flex flex-col p-2" :class="field.border ? 'border-1 rounded-lg shadow' : ''">
                      <div class="flex items-center">
                        <NcSwitch :checked="!!deepReference(field.model)" @update:checked="setFormState(field.model, $event)" />
                        <span class="ml-[6px] font-bold">{{ field.label }}</span>
                        <NcTooltip v-if="field.helpText">
                          <template #title>
                            <div class="text-xs">
                              {{ field.helpText }}
                            </div>
                          </template>
                          <GeneralIcon icon="info" class="text-gray-500 h-4 ml-1" />
                        </NcTooltip>
                      </div>
                      <div v-if="field.helpText && !field.showHintAsTooltip" class="w-full mt-1 pl-[35px]">
                        <div class="text-xs text-gray-500">{{ field.helpText }}</div>
                      </div>
                    </div>
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.SelectIntegration">
                    <NcSelect
                      :value="deepReference(field.model)"
                      :options="integrationOptions[field.model]"
                      dropdown-match-select-width
                      class="nc-select-shadow"
                      placeholder="Select Integration"
                      allow-clear
                      show-search
                      @update:value="setFormState(field.model, $event)"
                    >
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
                          class="px-1.5 flex items-center text-brand-500 text-sm cursor-pointer"
                          @mousedown.prevent
                          @click="handleAddNewConnection(field.model)"
                        >
                          <div class="w-full flex items-center gap-2 px-2 py-2 rounded-md hover:bg-gray-100">
                            <GeneralIcon icon="plus" class="flex-none" />
                            {{ $t('general.new') }} {{ $t('general.connection').toLowerCase() }}
                          </div>
                        </div>
                      </template>
                    </NcSelect>
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.SelectBase">
                    <NcFormBuilderInputSelectBase
                      :value="deepReference(field.model)"
                      @update:value="setFormState(field.model, $event)"
                    />
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.OAuth">
                    <NcFormBuilderInputOAuth
                      :value="deepReference(field.model)"
                      :element="field"
                      :have-value="!!deepReference(field.model)"
                      @update:value="setFormState(field.model, $event)"
                    />
                  </template>
                  <div
                    v-if="field.helpText && field.type !== FormBuilderInputType.Switch && !field.showHintAsTooltip"
                    class="w-full mt-1"
                  >
                    <div class="text-xs text-gray-500">{{ field.helpText }}</div>
                  </div>
                </a-form-item>
              </template>
            </div>
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
      <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-item {
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

  .nc-form-section {
    @apply flex flex-col gap-3;
  }

  .nc-form-section-title {
    @apply text-sm font-bold text-gray-800;
  }

  .nc-form-section-body {
    @apply flex flex-col gap-3;
  }

  :deep(.ant-form-item-label > label.ant-form-item-required:after) {
    @apply content-['*'] inline-block text-inherit text-red-500 ml-1;
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
          @apply shadow-default border-gray-200;
        }

        &:hover:not(:focus):not(:disabled) {
          @apply border-gray-200 shadow-hover;
        }

        &:focus {
          @apply shadow-selected ring-0;
        }
      }

      .ant-input-number,
      .ant-input-affix-wrapper.ant-input-password {
        &:not(:hover):not(:focus-within):not(:disabled) {
          @apply shadow-default border-gray-200;
        }

        &:hover:not(:focus-within):not(:disabled) {
          @apply border-gray-200 shadow-hover;
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
    @apply !mb-6;
  }
}
</style>

<style lang="scss"></style>
