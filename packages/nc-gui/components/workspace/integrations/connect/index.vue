<script setup lang="ts">
const { activeWorkspace } = storeToRefs(useWorkspace())

const { $api } = useNuxtApp()

const { appInfo } = useGlobal()

const { base: activeBase } = storeToRefs(useBase())

const connectionDetails = ref()

const getConnectionDetails = async () => {
  if (!activeWorkspace.value?.id) return

  const res = await $api.internal.getOperation(activeWorkspace.value.id, 'nc', {
    operation: 'getDataReflection',
  })

  connectionDetails.value = res
}

const createConnectionDetails = async () => {
  if (!activeWorkspace.value?.id) return

  try {
    const res = await $api.internal.postOperation(
      activeWorkspace.value.id,
      'nc',
      {
        operation: 'createDataReflection',
      },
      {},
    )
    connectionDetails.value = res
    ;(activeWorkspace.value as any).data_reflection_enabled = true
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const deleteConnectionDetails = async () => {
  if (!activeWorkspace.value?.id) return

  try {
    await $api.internal.postOperation(activeWorkspace.value.id, 'nc', {
      operation: 'deleteDataReflection',
    })
    connectionDetails.value = null
    ;(activeWorkspace.value as any).data_reflection_enabled = false
  } catch (e) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

const host = computed(() =>
  connectionDetails.value?.host || appInfo.value.ncSiteUrl ? `${new URL(appInfo.value.ncSiteUrl).hostname}` : '',
)

const connectionUrl = computed(() => {
  return `postgresql://${connectionDetails.value.username}:${connectionDetails.value.password}@${host.value}:${connectionDetails.value.port}/${connectionDetails.value.database}`
})

onMounted(async () => {
  await getConnectionDetails()
})
</script>

<template>
  <div v-if="!activeWorkspace.data_reflection_enabled" class="flex flex-col gap-8 w-full h-full items-center justify-center">
    <span class="text-lg font-bold">Connect with your favorite tools</span>
    <span class="text-sm text-neutral-500">Integrate with your favourite tools by bypassing our APIs</span>
    <NcButton class="!rounded-md" type="primary" @click="createConnectionDetails"> Get Connection Details </NcButton>
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
                      <a-input :value="'NocoDB Default'" disabled />
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
                      <LazyWorkspaceIntegrationsConnectCopyInput v-model="connectionUrl" class="nc-connection-url" />
                    </a-form-item>
                  </a-col>
                </a-row>

                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="Host">
                      <LazyWorkspaceIntegrationsConnectCopyInput v-model="host" class="nc-connection-host" />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="Port">
                      <LazyWorkspaceIntegrationsConnectCopyInput v-model="connectionDetails.port" class="nc-connection-port" />
                    </a-form-item>
                  </a-col>
                </a-row>

                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="Username">
                      <LazyWorkspaceIntegrationsConnectCopyInput
                        v-model="connectionDetails.username"
                        class="nc-connection-username"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="Password">
                      <LazyWorkspaceIntegrationsConnectCopyInput
                        v-model="connectionDetails.password"
                        password
                        class="nc-connection-password"
                      />
                    </a-form-item>
                  </a-col>
                </a-row>

                <a-row :gutter="24">
                  <a-col :span="12">
                    <a-form-item label="Database">
                      <LazyWorkspaceIntegrationsConnectCopyInput
                        v-model="connectionDetails.database"
                        class="nc-connection-database"
                      />
                    </a-form-item>
                  </a-col>
                  <a-col :span="12">
                    <a-form-item label="Schema">
                      <LazyWorkspaceIntegrationsConnectCopyInput v-model="activeBase.id" class="nc-connection-schema" />
                    </a-form-item>
                  </a-col>
                </a-row>
              </div>
              <div class="w-full flex items-center justify-center mt-4">
                <NcButton class="w-1/2" type="danger" @click="deleteConnectionDetails">Disable Connection</NcButton>
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
</template>

<style lang="scss" scoped>
.connection-details-left-panel {
  @apply p-6 flex-1 flex justify-center;
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
