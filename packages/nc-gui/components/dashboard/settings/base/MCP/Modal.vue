<script setup lang="ts">
interface Props {
  visible: boolean
  token: MCPTokenExtendedType
  showRegenerateButton?: boolean
  showWorkspaceBaseInfo?: boolean
  isAccountLevel?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showRegenerateButton: true,
  showWorkspaceBaseInfo: false,
  isAccountLevel: false,
})

const emits = defineEmits(['close', 'update:visible', 'update:token'])

const modalVisible = useVModel(props, 'visible')

const token = useVModel(props, 'token')

/** A connection whose authority is its scopes names no base, so it is named after itself. */
const isScopedConnection = computed(() => !token.value.base)

const { updateMcpToken } = useMcpSettings()

const regenerateToken = async () => {
  const newToken = await updateMcpToken(token.value, props.isAccountLevel)
  if (newToken) {
    token.value = newToken
  }
}

const closeModal = () => {
  emits('close')
  modalVisible.value = false
}
</script>

<template>
  <NcModal v-model:visible="modalVisible" :show-separator="true" size="large" wrap-class-name="nc-modal-mcp-token-create-edit">
    <template #header>
      <div class="flex w-full items-center p-2 justify-between">
        <div class="flex items-center gap-3 pl-1 flex-1">
          <GeneralIcon class="text-nc-content-gray-emphasis h-5 w-5" icon="mcp" />
          <span class="text-nc-content-gray-emphasis truncate font-semibold text-xl">
            {{ token.title }}
          </span>
        </div>

        <div class="flex justify-end items-center gap-3 pr-0.5 flex-1">
          <NcButton type="text" size="small" data-testid="nc-close-webhook-modal" @click.stop="closeModal">
            <GeneralIcon icon="close" />
          </NcButton>
        </div>
      </div>
    </template>
    <div class="flex bg-nc-bg-default rounded-b-2xl h-[calc(100%_-_66px)]">
      <div
        ref="containerElem"
        class="h-full flex-1 flex flex-col overflow-y-auto scroll-smooth nc-scrollbar-thin px-24 py-6 mx-auto"
      >
        <div class="flex flex-col max-w-[640px] w-full mx-auto gap-3">
          <div class="text-nc-content-gray font-bold leading-6">
            {{ $t('labels.mcpSetup') }}
          </div>

          <!-- Workspace/Base Info (for account-level view) -->
          <div v-if="showWorkspaceBaseInfo" class="flex flex-col gap-2 p-4 bg-nc-bg-gray-extralight rounded-lg">
            <div v-if="isEeUI" class="flex items-center gap-2">
              <span class="text-sm font-semibold text-nc-content-gray-subtle">{{ $t('objects.workspace') }}:</span>
              <span class="text-sm text-nc-content-gray-subtle2">{{ token.workspace?.title || '-' }}</span>
            </div>
            <div class="flex items-center gap-2">
              <span class="text-sm font-semibold text-nc-content-gray-subtle">{{ $t('objects.project') }}:</span>
              <span class="text-sm text-nc-content-gray-subtle2">{{ token.base?.title || '-' }}</span>
            </div>
          </div>

          <NcAlert type="info" class="mt-3 max-w-[640px] w-full mx-auto">
            <template #message>
              {{ $t('labels.mcpTokenVisibilityInfo') }}
            </template>
            <template #description>
              {{ $t('labels.mcpTokenVisibilityInfoDescription') }} <br />
              {{ $t('labels.mcpTokenVisibilityInfoDescription2') }}
            </template>
          </NcAlert>

          <DashboardSettingsBaseMCPSetup
            :token="token"
            :show-workspace-base-info="showWorkspaceBaseInfo"
            :show-regenerate-button="showRegenerateButton"
            :loading="token.loading"
            @regenerate="regenerateToken"
          />
        </div>
      </div>

      <NcModalSupportedDocsSidebar>
        <NcModalSupportedDocs :docs="MCP_SUPPORT_DOCS" />
      </NcModalSupportedDocsSidebar>
    </div>
  </NcModal>
</template>

<style lang="scss">
.nc-modal-mcp-token-create-edit {
  z-index: 1050;
  a {
    @apply !no-underline !text-nc-content-gray-subtle !hover:text-primary;
  }
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }

  .nc-modal-header {
    @apply !mb-0 !pb-0;
  }
}
</style>
