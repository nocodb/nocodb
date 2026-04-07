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

const roleOptions = [
  { label: t('objects.roleType.viewer'), value: EnterpriseOrgUserRoles.VIEWER },
  { label: t('objects.roleType.creator'), value: EnterpriseOrgUserRoles.CREATOR },
]

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

const showRegenerateTokenModal = ref(false)
const showDeleteScimModal = ref(false)

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
          <div class="flex font-bold justify-between text-base items-center">
            <span>{{ $t('labels.scimConfiguration') }}</span>
            <NcButton
              v-if="!scimConfig"
              v-e="['c:scim:enable']"
              :loading="isScimLoading"
              data-testid="nc-scim-init"
              size="small"
              type="secondary"
              @click="initializeScim"
            >
              <template #icon>
                <component :is="iconMap.plus" />
              </template>
              {{ $t('labels.enableScim') }}
            </NcButton>
          </div>

          <div v-if="scimConfig" class="flex flex-col gap-y-4">
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
              <h1 class="text-sm font-medium text-nc-content-gray mb-2">{{ $t('labels.scimDefaultRole') }}</h1>
              <NcSelect
                :value="scimConfig.default_role || EnterpriseOrgUserRoles.VIEWER"
                :options="roleOptions"
                class="w-60"
                data-testid="nc-scim-default-role"
                @change="updateDefaultRole($event)"
              />
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
                      @click="showRegenerateTokenModal = true"
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

            <!-- Delete SCIM Config -->
            <div class="pt-2 border-t border-nc-border-gray-light">
              <NcButton
                v-e="['c:scim:delete']"
                danger
                data-testid="nc-scim-delete"
                size="small"
                type="text"
                @click="showDeleteScimModal = true"
              >
                <template #icon>
                  <component :is="iconMap.delete" />
                </template>
                {{ $t('labels.disableScim') }}
              </NcButton>
            </div>
          </div>

          <span v-if="!scimConfig && !isScimLoading" class="text-nc-content-gray-muted text-sm">
            {{ $t('labels.scimNotConfigured', { action: $t('labels.enableScim') }) }}
          </span>

          <div v-if="isScimLoading && !scimConfig" class="flex items-center justify-center py-8">
            <a-spin />
          </div>
        </div>
      </div>

      <GeneralDeleteModal
        v-model:visible="showDeleteScimModal"
        entity-name="SCIM configuration"
        delete-label="Disable"
        :on-delete="async () => { await deleteScimConfig() }"
      >
        <template #entity-preview>
          <div class="text-nc-content-gray">
            {{ $t('labels.scimDeleteWarning') }}
          </div>
        </template>
      </GeneralDeleteModal>

      <GeneralDeleteModal
        v-model:visible="showRegenerateTokenModal"
        entity-name="provisioning token"
        delete-label="Regenerate"
        :on-delete="async () => { await regenerateToken() }"
      >
        <template #entity-preview>
          <div class="text-nc-content-gray">
            {{ $t('labels.scimRegenerateWarning') }}
          </div>
        </template>
      </GeneralDeleteModal>
    </div>
  </div>
</template>
