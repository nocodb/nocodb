<script setup lang="ts">
import type { IntegrationType, UserType, WorkspaceUserType } from 'nocodb-sdk'
import { IntegrationsType } from 'nocodb-sdk'

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
    <!-- Section header -->
    <div class="flex items-center justify-between mb-4">
      <div class="flex items-center gap-2">
        <h3 class="text-sm font-weight-700 text-nc-content-gray-subtle mb-0">
          {{ t('general.activeConnections') }}
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
        type="link"
        size="small"
        class="!text-nc-content-brand !p-0 !h-auto !min-h-0"
        inner-class="hover:underline"
        @click="emits('view-all')"
      >
        {{ t('general.viewAllConnections') }}
        <GeneralIcon icon="arrowRight" class="ml-1" />
      </NcButton>
    </div>

    <!-- Connection cards grid -->
    <div class="nc-connection-cards-grid grid grid-cols-1 gap-3">
      <WorkspaceIntegrationsConnectionCard
        v-for="connection in visibleConnections"
        :key="connection.id"
        :integration="connection"
        :collaborators-map="collaboratorsMap"
        @edit="handleEdit"
        @delete="openDeleteIntegration"
        @base-assignment="openBaseAssignment"
      />

      <!-- Overflow card -->
      <div
        v-if="overflowCount > 0"
        v-e="['c:integration:view-all-connections']"
        class="nc-connection-overflow-card"
        @click="emits('view-all')"
      >
        <div class="text-sm font-semibold text-nc-content-gray">+{{ overflowCount }} {{ t('general.more') }}</div>
        <div class="text-xs text-nc-content-gray-subtle2">
          {{ t('general.viewAllConnections') }}
        </div>
      </div>
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
  .nc-connection-cards-grid {
    @supports not (container-type: inline-size) {
      @media (min-width: 540px) {
        @apply grid-cols-2;
      }

      @media (min-width: 1024px) {
        @apply grid-cols-3;
      }

      @media (min-width: 1440px) {
        @apply grid-cols-4;
      }
    }

    @container (min-width: 540px) {
      @apply grid-cols-2;
    }

    @container (min-width: 820px) {
      @apply grid-cols-3;
    }

    @container (min-width: 1140px) {
      @apply grid-cols-4;
    }
  }

  .nc-connection-overflow-card {
    @apply flex flex-col items-center justify-center gap-1 border-1 border-dashed border-nc-border-gray-medium rounded-xl p-3 cursor-pointer transition-all duration-200;

    &:hover {
      @apply bg-nc-bg-gray-extralight border-nc-border-gray-dark;
    }
  }
}
</style>
