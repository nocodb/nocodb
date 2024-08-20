<script lang="ts" setup>
const props = defineProps<{ loadDatasourceInfo?: boolean; baseId?: string }>()

const { loadDatasourceInfo, baseId } = toRefs(props)

const { pageMode, IntegrationsPageMode, integrationType, activeIntegration } = useIntegrationStore()

const isEditOrAddIntegrationModalOpen = computed({
  get: () => {
    return pageMode.value === IntegrationsPageMode.ADD || pageMode.value === IntegrationsPageMode.EDIT
  },
  set: (value: boolean) => {
    if (!value) {
      pageMode.value = null
    }
  },
})

const connectionType = computed(() => {
  switch (
    pageMode.value === IntegrationsPageMode.EDIT
      ? activeIntegration.value?.sub_type || activeIntegration.value?.config?.client
      : activeIntegration.value?.type
  ) {
    case integrationType.PostgreSQL:
      return ClientType.PG
    case integrationType.MySQL:
      return ClientType.MYSQL
    case integrationType.SQLITE:
      return ClientType.SQLITE
    default: {
      return undefined
    }
  }
})
</script>

<template>
  <NcModal
    v-model:visible="isEditOrAddIntegrationModalOpen"
    size="large"
    wrap-class-name="nc-modal-edit-or-add-integration"
    @keydown.esc="isEditOrAddIntegrationModalOpen = false"
  >
    <div v-if="connectionType" class="h-full">
      <WorkspaceIntegrationsFormsEditOrAddDatabase
        v-model:open="isEditOrAddIntegrationModalOpen"
        :connection-type="connectionType"
        :load-datasource-info="loadDatasourceInfo"
        :base-id="baseId"
      />
    </div>
  </NcModal>
</template>

<style lang="scss" scoped></style>

<style lang="scss">
.nc-modal-edit-or-add-integration {
  .nc-modal {
    @apply !p-0;
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;

    .nc-edit-or-add-integration-left-panel {
      @apply w-full p-6 flex-1 flex justify-center;
    }
    .nc-edit-or-add-integration-right-panel {
      @apply p-5 w-[320px] border-l-1 border-gray-200 flex flex-col gap-4 bg-gray-50 rounded-br-2xl;
    }
  }
}
</style>
