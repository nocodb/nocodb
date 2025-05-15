<script setup lang="ts">
import type { IntegrationCategoryType, SyncDataType } from 'nocodb-sdk'

const props = defineProps<{
  open: boolean
  integrationType: IntegrationCategoryType
  integrationSubType: SyncDataType
}>()

const emits = defineEmits(['update:open'])

const {
  connectionDetails,
  connectionUrl,
  connectionHost,
  selectedBase,
  createConnectionDetails,
  getConnectionDetails,
  deleteConnectionDetails,
  dataReflectionEnabled,
} = useDataReflection()

onMounted(async () => {
  await getConnectionDetails()
})
</script>

<template>
  <WorkspaceIntegrationsFormsEditOrAddCommonWrapper v-bind="props" @update:open="emits('update:open', $event)">
    <template v-if="dataReflectionEnabled" #headerRightExtra>
      <NcButton type="danger" size="small" @click="deleteConnectionDetails">Disable connection</NcButton>
    </template>
    <template #leftPanel="{ class: leftPanelClass }">
      <div :class="leftPanelClass">
        <div
          v-if="!dataReflectionEnabled"
          class="nc-nocodb-connection-details-placeholder flex flex-col gap-8 w-full h-full items-center justify-center text-center mt-10"
        >
          <img
            src="~assets/img/placeholder/nocodb-pg-integration.png"
            class="!w-full !max-w-[864px] flex-none"
            alt="NocoDb X Pg integration"
          />
          <span class="text-base font-bold">Connect with your favorite tools</span>
          <span class="text-sm text-nc-content-gray-subtle2">Integrate with your favourite tools by bypassing our APIs</span>
          <NcButton size="small" type="primary" @click="createConnectionDetails"> Get connection details </NcButton>
          <div>
            <!-- For spacing  -->
          </div>
        </div>
        <div v-else class="connection-details bg-white relative h-full flex flex-col w-full">
          <div class="h-full max-h-[calc(100%_-_65px)] flex">
            <div class="connection-details-left-panel nc-scrollbar-thin relative">
              <div v-if="connectionDetails" class="h-full w-[768px] mx-auto">
                <a-form
                  ref="form"
                  :model="connectionDetails"
                  hide-required-mark
                  name="external-base-create-form"
                  layout="vertical"
                  no-style
                  class="flex flex-col gap-5.5"
                >
                  <div class="nc-form-section">
                    <div class="nc-form-section-title">General</div>
                    <div class="nc-form-section-body">
                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="Connection name">
                            <a-input value="NocoDB" disabled />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </div>
                  </div>
                  <div class="nc-form-section">
                    <div class="flex items-center justify-between">
                      <div class="nc-form-section-title">Connection details</div>
                    </div>

                    <div class="nc-form-section-body">
                      <a-row :gutter="24">
                        <a-col :span="24">
                          <a-form-item label="Connection URL">
                            <LazyGeneralCopyInput v-model="connectionUrl" class="nc-connection-url" />
                          </a-form-item>
                        </a-col>
                      </a-row>

                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="Host">
                            <LazyGeneralCopyInput v-model="connectionHost" class="nc-connection-host" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="12">
                          <a-form-item label="Port">
                            <LazyGeneralCopyInput v-model="connectionDetails.port" class="nc-connection-port" />
                          </a-form-item>
                        </a-col>
                      </a-row>

                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="Username">
                            <LazyGeneralCopyInput v-model="connectionDetails.username" class="nc-connection-username" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="12">
                          <a-form-item label="Password">
                            <LazyGeneralCopyInput v-model="connectionDetails.password" password class="nc-connection-password" />
                          </a-form-item>
                        </a-col>
                      </a-row>

                      <a-row :gutter="24">
                        <a-col :span="12">
                          <a-form-item label="Database">
                            <LazyGeneralCopyInput v-model="connectionDetails.database" class="nc-connection-database" />
                          </a-form-item>
                        </a-col>
                        <a-col :span="12">
                          <a-form-item label="Schema">
                            <LazyWorkspaceIntegrationsConnectSchemaInput v-model="selectedBase" class="nc-connection-schema" />
                          </a-form-item>
                        </a-col>
                      </a-row>
                    </div>
                  </div>

                  <div>
                    <!-- For spacing -->
                  </div>
                </a-form>
              </div>
              <general-overlay v-else :model-value="true" inline transition class="!bg-opacity-15">
                <div class="flex items-center justify-center h-full w-full !bg-white !bg-opacity-85 z-1000">
                  <a-spin size="large" />
                </div>
              </general-overlay>
            </div>
          </div>
        </div>
      </div>
    </template>
    <template v-if="!dataReflectionEnabled" #rightPanel> </template>
  </WorkspaceIntegrationsFormsEditOrAddCommonWrapper>
</template>

<style lang="scss" scoped>
.connection-details-left-panel {
  @apply flex-1 flex justify-center;
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

:deep(.ant-form-item) {
  @apply mb-0;
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

.connection-details {
  :deep(.ant-input-affix-wrapper),
  :deep(.ant-input),
  :deep(.ant-select) {
    @apply !appearance-none border-solid rounded-md;

    &:disabled {
      @apply bg-nc-bg-gray-extralight text-nc-content-gray-muted border-nc-border-gray-medium;
    }
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

  .nc-connection-json-editor {
    @apply min-h-[300px] max-h-[600px];
    resize: vertical;
    overflow-y: auto;
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

<style lang="scss">
.nc-edit-or-add-integration-left-panel {
  &:has(.nc-nocodb-connection-details-placeholder) {
    @apply bg-nc-bg-gray-extralight;
  }
}
</style>
