<script lang="ts" setup>
import NcModal from '~/components/nc/Modal.vue'

const props = withDefaults(
  defineProps<{
    isModal?: boolean
  }>(),
  {
    isModal: false,
  },
)

const { isModal } = props

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
  <component
    :is="isModal ? NcModal : 'div'"
    v-model:visible="isAddNewIntegrationModalOpen"
    centered
    size="large"
    :class="{
      'h-full': !isModal,
    }"
    wrap-class-name="nc-modal-available-integrations-list"
    @keydown.esc="isAddNewIntegrationModalOpen = false"
  >
    <div class="h-full">
      <div v-if="isModal" class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-gray-200">
        <div class="text-xl font-weight-500">New Integration</div>

        <div class="flex items-center gap-3">
          <NcButton size="small" type="text" @click="isAddNewIntegrationModalOpen = false">
            <GeneralIcon icon="close" class="text-gray-600" />
          </NcButton>
        </div>
      </div>
      <div
        class="flex flex-col nc-workspace-settings-integrations-new-available-list"
        :class="{
          'h-[calc(80vh_-_66px)] p-6': isModal,
          'h-full': !isModal,
        }"
      >
        <div class="w-full flex justify-center">
          <div
            class="flex flex-col gap-6 w-full"
            :class="{
              'pt-6 max-w-[1088px]': isModal,
            }"
          >
            <div class="integration-type-wrapper">
              <div class="integration-type-title">Databases</div>
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
  </component>
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
.nc-modal-available-integrations-list {
  .nc-modal {
    @apply !p-0;
  }
}
</style>
