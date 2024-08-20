<script lang="ts" setup>
const { form, formState, formElementsCategorized, isLoading, validateInfos } = useFormBuilderHelperOrThrow()

const deepReference = (path: string): any => {
  return path.split('.').reduce((acc, key) => acc[key], formState.value)
}

const updateFormState = (path: string, value: any) => {
  // update nested prop in formState
  const keys = path.split('.')
  const lastKey = keys.pop()

  if (!lastKey) return

  const target = keys.reduce((acc, key) => acc[key], formState.value)
  target[lastKey] = value
}
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
                  v-else
                  :label="[FormBuilderInputType.Switch].includes(field.type) ? undefined : field.label"
                  v-bind="validateInfos[field.model]"
                  class="nc-form-item"
                  :style="`width:${+field.width || 100}%`"
                >
                  <template v-if="field.type === FormBuilderInputType.Input">
                    <a-input :value="deepReference(field.model)" @update:value="updateFormState(field.model, $event)" />
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.Select">
                    <NcSelect
                      :value="deepReference(field.model)"
                      :options="field.options"
                      @update:value="updateFormState(field.model, $event)"
                    />
                  </template>
                  <template v-else-if="field.type === FormBuilderInputType.Switch">
                    <div class="flex flex-col p-2" :class="field.border ? 'border-1 rounded-lg' : ''">
                      <div class="flex items-center">
                        <NcSwitch
                          :checked="!!deepReference(field.model)"
                          @update:checked="updateFormState(field.model, $event)"
                        />
                        <span class="ml-[6px] font-bold">{{ field.label }}</span>
                      </div>
                      <div v-if="field.helpText" class="w-full mt-1 ml-[35px]">
                        <div class="text-xs text-gray-500">{{ field.helpText }}</div>
                      </div>
                    </div>
                  </template>
                  <div v-if="field.helpText && field.type !== FormBuilderInputType.Switch" class="w-full mt-1">
                    <div class="text-xs text-gray-500">{{ field.helpText }}</div>
                  </div>
                </a-form-item>
              </template>
            </div>
          </div>
        </div>
      </template>
    </a-form>
    <general-overlay :model-value="isLoading" inline transition class="!bg-opacity-15">
      <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
        <a-spin size="large" />
      </div>
    </general-overlay>
  </div>
</template>

<style lang="scss" scoped>
.nc-form-item {
  padding-right: 24px;
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
}
</style>

<style lang="scss"></style>
