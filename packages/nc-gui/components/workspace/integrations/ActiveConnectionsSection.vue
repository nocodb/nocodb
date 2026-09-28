<script setup lang="ts">
import dayjs from 'dayjs'
import type { IntegrationType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import { IntegrationsType, SyncDataType } from 'nocodb-sdk'

interface Props {
  connections: IntegrationType[]
  totalCount: number
  maxVisible?: number
  searchQuery?: string
  showDivider?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  maxVisible: 6,
  searchQuery: '',
  showDivider: false,
})

const emits = defineEmits<{
  (e: 'view-all'): void
}>()

const { t } = useI18n()

const { isFeatureEnabled } = useBetaFeatureToggle()

const { editIntegration, deleteIntegration, getIntegration, loadIntegrations, deleteConfirmText, successConfirmModal } =
  useIntegrationStore()

const { allCollaborators } = storeToRefs(useWorkspace())

const { bases } = storeToRefs(useBases())

const collaboratorsMap = computed<Map<string, (WorkspaceUserType & { id: string }) | UserType>>(() => {
  const map = new Map()

  allCollaborators.value?.forEach((coll) => {
    if (coll?.id) {
      map.set(coll.id, coll)
    }
  })

  return map
})

const filteredConnections = computed(() => {
  const query = props.searchQuery.trim().toLowerCase()

  return (props.connections || []).filter((i) => {
    if (IntegrationsType.Sync === i.type) return false
    if (query && !i.title?.toLowerCase().includes(query)) return false
    return true
  })
})

const visibleConnections = computed(() => {
  return filteredConnections.value.slice(0, props.maxVisible)
})

const filteredTotalCount = computed(() => filteredConnections.value.length)

const overflowCount = computed(() => {
  return Math.max(0, filteredTotalCount.value - props.maxVisible)
})

// Delete integration handling
const isDeleteModalOpen = ref(false)
const isLoadingGetLinkedSources = ref(false)
const toBeDeletedIntegration = ref<
  | (IntegrationType & {
      sources?: {
        id: string
        alias: string
        project_title: string
        base_id: string
      }[]
    })
  | null
>(null)

// NocoDB's own connection is only editable while data reflection is on.
const canOpenEdit = (integration: IntegrationType) =>
  isFeatureEnabled(FEATURE_FLAG.DATA_REFLECTION) || integration.sub_type !== SyncDataType.NOCODB

/** "Added <date> by <name>", skipping whichever half is unknown. */
function connectionMeta(connection: IntegrationType) {
  const parts: string[] = []

  if (connection.created_at) {
    parts.push(t('labels.addedOnDate', { date: dayjs(connection.created_at).local().format('DD MMM YYYY') }))
  }

  const by: { display_name?: string; email?: string } | undefined = collaboratorsMap.value?.get(connection.created_by as string)
  const name = by?.display_name || by?.email

  if (name) parts.push(t('labels.byUser', { user: name }))

  return parts.join(' · ')
}

const openDeleteIntegration = async (integration: IntegrationType) => {
  isLoadingGetLinkedSources.value = true
  deleteConfirmText.value = null
  isDeleteModalOpen.value = true
  toBeDeletedIntegration.value = integration

  const connectionDetails = await getIntegration(integration, {
    includeSources: true,
  })
  if (toBeDeletedIntegration.value) {
    toBeDeletedIntegration.value.sources = connectionDetails?.sources || []
  }
  isLoadingGetLinkedSources.value = false
}

const onDeleteConfirm = async () => {
  const isDeleted = await deleteIntegration(toBeDeletedIntegration.value, true)

  if (isDeleted) {
    for (const source of toBeDeletedIntegration.value?.sources || []) {
      if (!source.base_id || !source.id || (source.base_id && !bases.value.get(source.base_id))) {
        continue
      }

      const base = bases.value.get(source.base_id)

      if (!Array.isArray(base?.sources)) {
        continue
      }

      bases.value.set(source.base_id, {
        ...(base || {}),
        sources: [...base.sources.filter((s) => s.id !== source.id)],
      })
    }
  }
}

// Base assignment dialog state
const isBaseAssignmentOpen = ref(false)
const baseAssignmentIntegration = ref<IntegrationType | null>(null)

const openBaseAssignment = (integration: IntegrationType) => {
  baseAssignmentIntegration.value = integration
  isBaseAssignmentOpen.value = true
}

const onBaseAssignmentUpdated = () => {
  loadIntegrations()
}

const handleEdit = (integration: IntegrationType) => {
  editIntegration(integration)
}
</script>

<template>
  <div v-show="filteredConnections.length" class="nc-active-connections-section" style="container-type: inline-size">
    <!-- Header: same shape as the base pane's "Your connections". -->
    <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-bodyDefault font-semibold text-nc-content-gray-emphasis mb-0">
          {{ t('labels.yourConnections') }}
        </h3>
        <NcBadge
          v-if="filteredTotalCount"
          :border="false"
          class="bg-nc-bg-brand-inverted text-nc-content-gray-subtle2 text-xs min-w-5 !h-5 flex justify-center"
        >
          {{ filteredTotalCount }}
        </NcBadge>
      </div>

      <NcButton
        v-if="filteredTotalCount > 0"
        v-e="['c:integration:view-all-connections']"
        type="text"
        size="small"
        class="nc-manage-link !text-nc-content-brand"
        @click="emits('view-all')"
      >
        {{ t('general.manage') }}
        <GeneralIcon icon="arrowRight" class="ml-1" />
      </NcButton>
    </div>

    <!-- A list, not cards: these are records to scan and act on. -->
    <div class="nc-connection-list">
      <div
        v-for="connection in visibleConnections"
        :key="connection.id"
        class="nc-connection-row"
        :data-testid="`nc-connection-row-${connection.id}`"
        @click="canOpenEdit(connection) && handleEdit(connection)"
      >
        <span class="nc-connection-row-icon">
          <GeneralIntegrationIcon :type="connection.sub_type" />
        </span>

        <div class="flex-1 min-w-0 flex flex-col">
          <NcTooltip class="text-bodyDefaultSm font-semibold text-nc-content-gray truncate" show-on-truncate-only>
            {{ connection.title }}
          </NcTooltip>
          <span class="text-bodySm text-nc-content-gray-muted truncate">{{ connectionMeta(connection) }}</span>
        </div>

        <div class="flex-none" @click.stop>
          <WorkspaceIntegrationsConnectionActionMenu
            :integration="connection"
            @delete="openDeleteIntegration"
            @base-assignment="openBaseAssignment"
          >
            <NcButton size="xs" type="text" class="!px-1" @click.stop>
              <GeneralIcon icon="threeDotVertical" />
            </NcButton>
          </WorkspaceIntegrationsConnectionActionMenu>
        </div>
      </div>

      <button
        v-if="overflowCount > 0"
        v-e="['c:integration:view-all-connections']"
        type="button"
        class="nc-connection-expander"
        data-testid="nc-connections-expander"
        @click="emits('view-all')"
      >
        <GeneralIcon icon="chevronDown" class="w-4 h-4" />
        {{ t('labels.showMoreConnections', { count: overflowCount }) }}
      </button>
    </div>

    <NcDivider v-if="showDivider" class="!mt-6 !mb-0" />

    <!-- Delete confirmation modal -->
    <GeneralDeleteModal
      v-model:visible="isDeleteModalOpen"
      :entity-name="$t('general.connection')"
      :on-delete="onDeleteConfirm"
      :delete-label="$t('general.delete')"
      :show-default-delete-msg="!isLoadingGetLinkedSources && !toBeDeletedIntegration?.sources?.length"
    >
      <template #entity-preview>
        <template v-if="isLoadingGetLinkedSources">
          <div class="rounded-lg overflow-hidden">
            <a-skeleton-input active class="h-9 !rounded-md !w-full" />
          </div>
          <div class="rounded-lg overflow-hidden mt-2">
            <a-skeleton-input active class="h-9 !rounded-md !w-full" />
          </div>
        </template>
        <div v-else-if="toBeDeletedIntegration" class="w-full flex flex-col text-nc-content-gray">
          <div
            class="flex flex-row items-center py-2 px-3.25 bg-nc-bg-gray-extralight rounded-lg text-nc-content-inverted-secondary mb-4"
          >
            <GeneralIntegrationIcon :type="toBeDeletedIntegration.sub_type" />
            <div
              class="text-ellipsis overflow-hidden select-none w-full pl-3"
              :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
            >
              {{ toBeDeletedIntegration.title }}
            </div>
          </div>
          <div
            v-if="toBeDeletedIntegration?.sources?.length"
            class="flex flex-col pb-2 text-small leading-[18px] text-nc-content-gray-muted"
          >
            <div class="mb-1">{{ $t('msg.deleteIntegrationSourcesWarning') }}</div>
            <ul class="!list-disc ml-6 mb-0">
              <li v-for="(source, idx) of toBeDeletedIntegration.sources" :key="idx" class="marker:text-nc-content-gray-muted">
                <div class="flex items-center gap-1">
                  <GeneralProjectIcon
                    type="database"
                    class="!grayscale min-w-5 flex-none"
                    :style="{ filter: 'grayscale(100%) brightness(115%)' }"
                  />
                  <NcTooltip class="!truncate !max-w-[45%] flex-none" show-on-truncate-only>
                    <template #title>{{ source.project_title }}</template>
                    {{ source.project_title }}
                  </NcTooltip>
                  >
                  <GeneralBaseLogo class="!grayscale min-w-4 flex-none" :style="{ filter: 'grayscale(100%) brightness(115%)' }" />
                  <NcTooltip class="truncate !max-w-[45%] capitalize" show-on-truncate-only>
                    <template #title>{{ source.alias }}</template>
                    {{ source.alias }}
                  </NcTooltip>
                </div>
              </li>
            </ul>
            <div class="mt-2">{{ $t('msg.deleteIntegrationProceedConfirm') }}</div>
          </div>
        </div>
      </template>
    </GeneralDeleteModal>

    <!-- Success modal -->
    <NcModal v-model:visible="successConfirmModal.isOpen" centered size="small" @keydown.esc="successConfirmModal.isOpen = false">
      <div class="flex gap-4">
        <div>
          <GeneralIcon icon="circleCheckSolid" class="flex-none !text-green-700 mt-0.5 !h-6 !w-6" />
        </div>
        <div class="flex flex-col gap-3">
          <div class="flex">
            <h3 class="!m-0 text-base font-weight-700 flex-1">{{ successConfirmModal.title }}</h3>
            <NcButton size="xsmall" type="text" @click="successConfirmModal.isOpen = false">
              <GeneralIcon icon="close" class="text-nc-content-gray-subtle2" />
            </NcButton>
          </div>
          <div class="text-sm text-nc-content-inverted-secondary">{{ successConfirmModal.description }}</div>
          <a
            target="_blank"
            href="https://nocodb.com/docs/product-docs/data-sources/connect-to-data-source"
            rel="noopener noreferrer"
          >
            {{ $t('msg.learnMore') }}
          </a>
        </div>
      </div>
    </NcModal>

    <!-- Base assignment dialog (EE) -->
    <WorkspaceIntegrationsBaseAssignment
      v-if="baseAssignmentIntegration"
      v-model:visible="isBaseAssignmentOpen"
      :integration="baseAssignmentIntegration"
      @updated="onBaseAssignmentUpdated"
    />
  </div>
</template>

<style lang="scss" scoped>
.nc-active-connections-section {
  .nc-connection-overflow-card {
    @apply flex flex-col items-center justify-center gap-1 border-1 border-dashed border-nc-border-gray-medium rounded-xl p-3 cursor-pointer transition-all duration-200;

    &:hover {
      @apply bg-nc-bg-gray-extralight border-nc-border-gray-dark;
    }
  }
}

/* Mirrors the base settings pane's "Your connections" list. */
.nc-connection-list {
  @apply flex flex-col rounded-xl border-1 border-nc-border-gray-medium overflow-hidden;
}

.nc-connection-row {
  @apply flex items-center gap-3 px-3 py-2.5 cursor-pointer transition-colors duration-150
    border-b-1 border-nc-border-gray-light;

  &:last-child {
    @apply border-b-0;
  }

  &:hover {
    @apply bg-nc-bg-gray-extralight;
  }
}

.nc-connection-row-icon {
  @apply flex-none flex items-center justify-center h-8 w-8 rounded-lg overflow-hidden bg-nc-bg-gray-extralight;

  :deep(svg),
  :deep(img) {
    width: 18px !important;
    height: 18px !important;
    object-fit: contain;
  }
}

.nc-connection-expander {
  @apply flex items-center justify-center gap-1.5 w-full py-2.5 cursor-pointer bg-transparent
    border-0 border-t-1 border-nc-border-gray-light text-bodySm text-nc-content-gray-subtle2;

  &:hover {
    @apply bg-nc-bg-gray-extralight text-nc-content-gray;
  }
}

// `font-normal` resolves to 500 in this theme, so a real 400 is written out.
.nc-manage-link {
  font-weight: 400 !important;
}
</style>
