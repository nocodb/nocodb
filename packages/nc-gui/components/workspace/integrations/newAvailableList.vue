<script lang="ts" setup>
const props = withDefaults(
  defineProps<{
    isModal?: boolean
    isOpen?: boolean
  }>(),
  {
    isModal: false,
    isOpen: false,
  },
)

const { isModal, isOpen } = props

const { pageMode, IntegrationsPageMode, integrationType, addIntegration } = useIntegrationStore()

const isAddNewIntegrationModalOpen = computed({
  get: () => {
    return pageMode.value === IntegrationsPageMode.LIST
  },
  set: (value: boolean) => {
    if (value) {
      pageMode.value = IntegrationsPageMode.LIST
    } else {
      pageMode.value = null
    }
  },
})
</script>

<template>
  <div class="h-full">
    <div class="h-full flex flex-col nc-workspace-settings-integrations-new-available-list">
      <div class="w-full flex justify-center">
        <div class="flex flex-col gap-6 w-full">
          <div class="integration-type-wrapper">
            <div class="integration-type-title">Database</div>
            <div class="integration-type-list">
              <div class="source-card" @click="addIntegration(integrationType.MySQL)">
                <WorkspaceIntegrationsIcon :integration-type="integrationType.MySQL" size="md" />
                <div class="name">MySQL</div>
              </div>
              <div class="source-card" @click="addIntegration(integrationType.PostgreSQL)">
                <WorkspaceIntegrationsIcon :integration-type="integrationType.PostgreSQL" size="md" />
                <div class="name">PostgreSQL</div>
              </div>
            </div>
          </div>
          <!-- Todo:APIs  -->
          <!-- <div>
          <div>APIs</div>
          <div></div>
        </div> -->
          <div class="integration-type-wrapper">
            <div class="integration-type-title">Others</div>
            <div>
              <a
                class="source-card source-card-link"
                href="https://github.com/nocodb/nocodb/issues"
                target="_blank"
                rel="noreferrer noopener"
              >
                <WorkspaceIntegrationsIcon integration-type="request" size="md" />
                <div class="name">Request New Integration</div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.source-card-link {
  @apply !text-black !no-underline;
  .nc-new-integration-type-title {
    @apply text-sm font-weight-600 text-gray-600;
  }
}

.source-card {
  @apply flex items-center border-1 rounded-xl p-3 cursor-pointer hover:bg-gray-50;
  width: 352px;
  .name {
    @apply ml-4 text-md font-semibold;
  }
}

.nc-workspace-settings-integrations-new-available-list {
  .integration-type-wrapper {
    @apply flex flex-col gap-3;

    .integration-type-title {
      @apply text-sm text-gray-500 font-weight-700;
    }
    .integration-type-list {
      @apply flex gap-4 flex-wrap;
    }
  }
}
</style>

<style lang="scss">
.nc-modal-add-new-integration {
  .nc-modal {
    @apply !p-0;
  }
}
</style>
