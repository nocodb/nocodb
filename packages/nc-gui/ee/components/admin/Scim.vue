<script setup lang="ts">
import { EnterpriseOrgUserRoles } from 'nocodb-sdk'

interface Props {
  orgId?: string
}

const props = withDefaults(defineProps<Props>(), {
  orgId: undefined,
})

const $route = useRoute()

const { t } = useI18n()

const orgId = computed(() => props.orgId || ($route.params.orgId as string))

const {
  scimConfig,
  isLoading: isScimLoading,
  tokenVisible,
  fetchScimConfig,
  initializeScim,
  regenerateToken,
  toggleScim,
  updateDefaultRole,
  deleteScimConfig,
} = useScim(orgId)

const scimAllowedRoles = computed(() => [EnterpriseOrgUserRoles.VIEWER, EnterpriseOrgUserRoles.CREATOR])

const { copy } = useCopy()

const isCopied = ref({
  scimUrl: false,
  scimToken: false,
})

const copyScimUrl = async () => {
  if (!scimConfig.value?.base_url) return
  await copy(scimConfig.value.base_url)
  isCopied.value.scimUrl = true
  setTimeout(() => { isCopied.value.scimUrl = false }, 2000)
}

const copyScimToken = async () => {
  if (!scimConfig.value?.provisioning_token) return
  await copy(scimConfig.value.provisioning_token)
  isCopied.value.scimToken = true
  setTimeout(() => { isCopied.value.scimToken = false }, 2000)
}

const showDeleteScimModal = ref(false)

const { showWarningModal } = useNcConfirmModal()

const handleRegenerateToken = () => {
  showWarningModal({
    title: t('labels.scimRegenerateTokenHeader'),
    content: t('labels.scimRegenerateWarning'),
    okText: t('labels.regenerate'),
    okProps: { type: 'danger' },
    showCancelBtn: true,
    showOkLoading: true,
    okCallback: async () => {
      await regenerateToken()
    },
  })
}

onMounted(async () => {
  await fetchScimConfig()
})
</script>

<template>
  <div class="flex flex-col" data-testid="nc-scim-provisioning">
    <div class="flex-1 max-h-[calc(100vh_-_100px)] overflow-y-auto nc-scrollbar-thin flex flex-col items-center gap-6 p-6">
      <div class="flex flex-col gap-6 w-150">
        <div class="flex justify-between items-center">
          <span class="font-bold text-xl">{{ $t('labels.scimProvisioning') }}</span>
        </div>

        <div class="flex flex-col border-1 rounded-2xl border-nc-border-gray-medium p-6 gap-y-4">
          <!-- Empty state: Configure card -->
          <template v-if="!scimConfig && !isScimLoading">
            <div class="flex items-start justify-between gap-4">
              <div class="flex flex-col gap-2">
                <span class="font-bold text-base">{{ $t('labels.enableScim') }}</span>
                <span class="text-sm text-nc-content-gray-muted">
                  {{ $t('labels.scimNotConfigured') }}
                </span>
                <a
                  href="https://docs.nocodb.com/views/view-types/form/#scim-provisioning"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-sm text-nc-content-gray flex items-center gap-1 hover:text-nc-content-brand mt-1"
                >
                  {{ $t('activity.goToDocs') }}
                  <component :is="iconMap.ncExternalLink" class="w-3.5 h-3.5" />
                </a>
              </div>
              <NcButton
                v-e="['c:scim:enable']"
                :loading="isScimLoading"
                class="flex-shrink-0"
                data-testid="nc-scim-init"
                type="primary"
                size="small"
                @click="initializeScim"
              >
                {{ $t('general.configure') }}
              </NcButton>
            </div>
          </template>

          <!-- Loading spinner -->
          <div v-else-if="isScimLoading && !scimConfig" class="flex items-center justify-center py-8">
            <a-spin />
          </div>

          <!-- Configured state -->
          <template v-else-if="scimConfig">
            <div class="flex font-bold justify-between text-base items-center">
              <span>{{ $t('labels.scimConfiguration') }}</span>
            </div>

            <span class="text-xs text-nc-content-gray-muted -mt-2">
              {{ $t('labels.scimNextSteps') }}
            </span>

          <div class="flex flex-col gap-y-4">
            <!-- Enable/Disable Toggle -->
            <div class="flex items-center justify-between p-3 rounded-lg bg-nc-bg-gray-light">
              <div class="flex flex-col">
                <span class="text-sm font-medium">{{ $t('labels.scimEnabled') }}</span>
                <span class="text-xs text-nc-content-gray-muted">
                  {{ scimConfig.enabled ? $t('labels.scimProvisioningActive') : $t('labels.scimProvisioningPaused') }}
                </span>
              </div>
              <NcSwitch
                v-e="['c:scim:toggle', { enabled: !scimConfig.enabled }]"
                :checked="scimConfig.enabled"
                :loading="isScimLoading"
                data-testid="nc-scim-toggle"
                @change="toggleScim"
              />
            </div>

            <!-- Default Role -->
            <div>
              <div class="flex items-center gap-1.5 mb-2">
                <span class="text-sm font-medium text-nc-content-gray leading-none">{{ $t('labels.scimDefaultRole') }}</span>
                <NcTooltip :title="$t('labels.scimDefaultRoleHint')" placement="right">
                  <component :is="iconMap.info" class="w-3.5 h-3.5 text-nc-content-gray-muted cursor-help leading-none" />
                </NcTooltip>
              </div>
              <div class="nc-scim-role-selector">
                <RolesSelectorV2
                  :role="scimConfig.default_role || EnterpriseOrgUserRoles.VIEWER"
                  :roles="scimAllowedRoles"
                  :on-role-change="(role) => updateDefaultRole(role)"
                  size="md"
                  class="cursor-pointer"
                  data-testid="nc-scim-default-role"
                />
              </div>
            </div>

            <!-- SCIM Endpoint URL -->
            <div>
              <h1 class="text-sm font-medium text-nc-content-gray mb-2">{{ $t('labels.scimEndpoint') }}</h1>
              <div
                class="flex border-nc-border-gray-medium border-1 bg-nc-bg-gray-extralight items-center justify-between py-2 px-4 rounded-lg"
              >
                <span class="text-nc-content-gray text-sm font-mono truncate mr-2">{{ scimConfig.base_url }}</span>
                <NcButton
                  v-e="['c:scim:url:copy']"
                  size="xsmall"
                  type="text"
                  data-testid="nc-scim-copy-url"
                  @click="copyScimUrl"
                >
                  <MdiCheck v-if="isCopied.scimUrl" class="h-3.5 text-green-600" />
                  <component :is="iconMap.copy" v-else class="text-nc-content-gray" />
                </NcButton>
              </div>
            </div>

            <!-- Provisioning Token -->
            <div>
              <h1 class="text-sm font-medium text-nc-content-gray mb-2">{{ $t('labels.provisioningToken') }}</h1>
              <div
                class="flex border-nc-border-gray-medium border-1 bg-nc-bg-gray-extralight items-center justify-between py-2 px-4 rounded-lg"
              >
                <span class="text-nc-content-gray text-sm font-mono">
                  {{
                    tokenVisible && scimConfig.provisioning_token
                      ? scimConfig.provisioning_token
                      : '••••••••••••••••••••••••••••'
                  }}
                </span>
                <div class="flex gap-2">
                  <NcButton
                    v-if="tokenVisible && scimConfig.provisioning_token"
                    v-e="['c:scim:token:copy']"
                    size="xsmall"
                    type="text"
                    data-testid="nc-scim-copy-token"
                    @click="copyScimToken"
                  >
                    <MdiCheck v-if="isCopied.scimToken" class="h-3.5 text-green-600" />
                    <component :is="iconMap.copy" v-else class="text-nc-content-gray" />
                  </NcButton>
                  <NcTooltip :title="$t('labels.scimRegenerateTokenTooltip')">
                    <NcButton
                      v-e="['c:scim:token:regenerate']"
                      size="xsmall"
                      type="secondary"
                      data-testid="nc-scim-regenerate-token"
                      @click="handleRegenerateToken"
                    >
                      <component :is="iconMap.reload" />
                    </NcButton>
                  </NcTooltip>
                </div>
              </div>
              <div
                v-if="tokenVisible && scimConfig.provisioning_token"
                class="text-xs text-orange-600 mt-2 flex items-start gap-1"
              >
                <component :is="iconMap.alertTriangle" class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                <span>{{ $t('labels.scimTokenCopyWarning') }}</span>
              </div>
            </div>

          </div>
          </template>
        </div>

        <!-- Danger Zone: Remove SCIM Config (separate card) -->
        <div v-if="scimConfig" class="flex flex-col border-1 rounded-2xl border-red-200 p-6">
          <div class="flex items-center justify-between">
            <div class="flex flex-col gap-1">
              <span class="text-sm font-medium text-nc-content-gray">{{ $t('labels.disableScim') }}</span>
              <span class="text-xs text-nc-content-gray-muted">{{ $t('labels.scimDeleteWarning') }}</span>
            </div>
            <NcButton
              v-e="['c:scim:delete']"
              class="!text-red-600 !hover:bg-red-50 flex-shrink-0"
              data-testid="nc-scim-delete"
              size="small"
              type="text"
              @click="showDeleteScimModal = true"
            >
              <template #icon>
                <component :is="iconMap.delete" />
              </template>
              {{ $t('general.remove') }}
            </NcButton>
          </div>
        </div>
      </div>

      <GeneralDeleteModal
        v-model:visible="showDeleteScimModal"
        entity-name="SCIM configuration"
        delete-label="Remove"
        :on-delete="async () => { await deleteScimConfig() }"
      >
        <template #entity-preview>
          <div class="text-nc-content-gray">
            {{ $t('labels.scimDeleteWarning') }}
          </div>
        </template>
      </GeneralDeleteModal>

    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-scim-role-selector {
  width: fit-content;
}
</style>

<style lang="scss">
// Override the popover dropdown width for SCIM role selector.
// The popover renders in a portal so scoped styles can't reach it.
.nc-scim-role-selector .nc-roles-selector .nc-list-root {
  min-width: unset !important;
  max-width: 20rem !important;
}
</style>
