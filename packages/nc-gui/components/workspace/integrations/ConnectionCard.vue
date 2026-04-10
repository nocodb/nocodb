<script setup lang="ts">
import type { IntegrationType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import dayjs from 'dayjs'

interface Props {
  integration: IntegrationType
  collaboratorsMap: Map<string, (WorkspaceUserType & { id: string }) | UserType>
  /** 'workspace' (default) or 'base' — passed through to ConnectionActionMenu */
  mode?: 'workspace' | 'base'
  canEdit?: boolean
  canUnlink?: boolean
  baseId?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'workspace',
  canEdit: true,
  canUnlink: false,
})

const emits = defineEmits<{
  (e: 'edit', integration: IntegrationType): void
  (e: 'delete', integration: IntegrationType): void
  (e: 'base-assignment', integration: IntegrationType): void
  (e: 'unlink', integrationId: string): void
}>()

const { isFeatureEnabled } = useBetaFeatureToggle()

const getUserName = (userId?: string) => {
  if (!userId) return ''

  const user = props.collaboratorsMap.get(userId)
  if (!user) return ''

  return extractUserDisplayNameOrEmail(user as Record<string, string>)
}

const formattedDate = computed(() => {
  if (!props.integration.created_at) return ''

  return dayjs(props.integration.created_at).local().format('DD MMM YYYY')
})

const handleCardClick = () => {
  if (!isFeatureEnabled(FEATURE_FLAG.DATA_REFLECTION) && props.integration.sub_type === SyncDataType.NOCODB) {
    return
  }

  emits('edit', props.integration)
}
</script>

<template>
  <div
    v-e="['c:integration:connection-card:click']"
    class="nc-connection-card"
    data-testid="nc-connection-card"
    @click="handleCardClick"
  >
    <div class="flex items-center gap-3 min-w-0">
      <div class="nc-connection-card-icon">
        <GeneralIntegrationIcon :type="integration.sub_type" size="lg" />
      </div>

      <div class="flex-1 min-w-0">
        <NcTooltip class="font-semibold text-sm text-nc-content-gray truncate block" show-on-truncate-only>
          <template #title>{{ integration.title }}</template>
          {{ integration.title }}
        </NcTooltip>

        <div class="flex items-center gap-1.5 text-xs text-nc-content-gray-subtle2 mt-0.5 whitespace-nowrap truncate">
          <div class="flex items-center gap-1">
            <div class="w-1.5 h-1.5 rounded-full bg-green-500 flex-none" />
            <span>{{ $t('general.connected') }}</span>
          </div>
          <template v-if="getUserName(integration.created_by)">
            <div class="w-[2.5px] h-[2.5px] rounded-full bg-nc-content-gray-muted flex-none" />
            <NcTooltip class="truncate max-w-full text-xs nc-user-info-email capitalize" show-on-truncate-only>
              <template #title>{{ getUserName(integration.created_by) }}</template>
              {{ getUserName(integration.created_by) }}
            </NcTooltip>
          </template>
          <template v-if="formattedDate">
            <div class="w-[2.5px] h-[2.5px] rounded-full bg-nc-content-gray-muted flex-none" />
            <span>{{ formattedDate }}</span>
          </template>
        </div>
      </div>
    </div>

    <div v-if="mode === 'workspace' || canEdit || canUnlink" class="nc-connection-card-actions flex-none" @click.stop>
      <WorkspaceIntegrationsConnectionActionMenu
        :integration="integration"
        :mode="mode"
        :can-edit="canEdit"
        :can-unlink="canUnlink"
        :base-id="baseId"
        @delete="emits('delete', $event)"
        @base-assignment="emits('base-assignment', $event)"
        @unlink="emits('unlink', $event)"
      >
        <NcButton size="xs" type="secondary" class="!px-1" @click.stop>
          <GeneralIcon icon="threeDotVertical" />
        </NcButton>
      </WorkspaceIntegrationsConnectionActionMenu>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.nc-connection-card {
  @apply flex items-center justify-between gap-3 border-1 border-nc-border-gray-medium rounded-xl p-3 cursor-pointer transition-all duration-200;

  &:hover {
    @apply bg-nc-bg-gray-extralight;

    box-shadow: 0px 4px 8px -2px rgba(var(--rgb-base), 0.08), 0px 2px 4px -2px rgba(var(--rgb-base), 0.04);
  }

  .nc-connection-card-icon {
    @apply flex-none h-10 w-10 rounded-lg flex items-center justify-center bg-nc-bg-gray-extralight;
  }

  .nc-connection-card-actions {
    @apply opacity-0 transition-opacity duration-150;
  }

  &:hover .nc-connection-card-actions {
    @apply opacity-100;
  }
}
</style>
