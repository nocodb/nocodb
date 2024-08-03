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

const { pageMode, IntegrationsPageMode, integrationType, requestIntegration, addIntegration, saveIntegraitonRequest } =
  useIntegrationStore()

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
                <div
                  class="source-card-request-integration"
                  :class="{
                    active: requestIntegration.isOpen,
                  }"
                >
                  <div
                    v-if="!requestIntegration.isOpen"
                    class="source-card-item border-none"
                    @click="requestIntegration.isOpen = true"
                  >
                    <WorkspaceIntegrationsIcon integration-type="request" size="md" />
                    <div class="name">Request New Integration</div>
                  </div>
                  <template v-else>
                    <div class="flex items-center justify-between gap-4">
                      <div class="text-base font-bold text-gray-800">Request Integration</div>
                      <NcButton size="xsmall" type="text" @click="requestIntegration.isOpen = false">
                        <GeneralIcon icon="close" class="text-gray-600" />
                      </NcButton>
                    </div>
                    <div class="flex flex-col gap-2">
                      <div class="text-sm text-gray-800">Description</div>
                      <a-textarea
                        v-model:value="requestIntegration.msg"
                        class="!rounded-md !text-sm"
                        :style="{
                          'height': '70px',
                          'max-height': '250px',
                          'resize': 'vertical',
                        }"
                        size="large"
                        hide-details
                        placeholder="Describe your requested integration..."
                      />
                    </div>
                    <div class="flex items-center justify-end gap-3">
                      <NcButton size="small" type="secondary" @click="requestIntegration.isOpen = false">
                        {{ $t('general.cancel') }}
                      </NcButton>
                      <NcButton
                        :disabled="!requestIntegration.msg?.trim()"
                        :loading="requestIntegration.isLoading"
                        size="small"
                        @click="saveIntegraitonRequest(requestIntegration.msg)"
                      >
                        {{ $t('general.submit') }} {{ $t('general.request').toLowerCase() }}
                      </NcButton>
                    </div>
                  </template>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </component>
</template>

<style lang="scss" scoped>
.source-card-request-integration {
  @apply flex flex-col gap-4 border-1 rounded-xl p-3 w-[352px] overflow-hidden transition-all duration-300 max-w-[720px];

  &.active {
    @apply w-full;
  }
  &:not(.active) {
    @apply cursor-pointer hover:bg-gray-50;
  }

  .source-card-item {
    @apply flex items-center;

    .name {
      @apply ml-4 text-md font-semibold;
    }
  }
}
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
