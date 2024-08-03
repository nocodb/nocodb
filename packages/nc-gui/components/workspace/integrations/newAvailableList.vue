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

const handleAddIntegration = (type: typeof integrationType) => {
  if (requestIntegration.value.isOpen) {
    requestIntegration.value.isOpen = false
  }

  addIntegration(type)
}
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
    <div class="h-full flex flex-col">
      <div v-if="isModal" class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-gray-200">
        <div class="flex-1 text-base font-weight-700">New Connection</div>
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
              'max-w-[1088px]': isModal,
            }"
          >
            <div
              class="text-sm"
              :class="{
                'max-w-[740px]': !isModal,
              }"
            >
              <div>
                Centralise your operations by aggregating information from various external platforms into NocoDB. Select from the
                available integrations below to get started.
              </div>
              <div class="mt-2">
                <!-- Todo: add link  -->
                <a> Learn more </a>
              </div>
            </div>

            <div class="integration-type-wrapper">
              <div class="integration-type-title">Databases</div>
              <div class="integration-type-list">
                <div class="source-card" @click="handleAddIntegration(integrationType.MySQL)">
                  <WorkspaceIntegrationsIcon :integration-type="integrationType.MySQL" size="md" />
                  <div class="name flex-1">MySQL</div>
                  <div class="action-btn">+</div>
                </div>
                <div class="source-card" @click="handleAddIntegration(integrationType.PostgreSQL)">
                  <WorkspaceIntegrationsIcon :integration-type="integrationType.PostgreSQL" size="md" />
                  <div class="name flex-1">PostgreSQL</div>
                  <div class="action-btn">+</div>
                </div>
              </div>
            </div>
            <!-- Todo:APIs  -->
            <!-- <div>
          <div>APIs</div>
          <div></div>
        </div> -->
            <div class="integration-type-wrapper">
              <div>
                <div class="integration-type-title">Others</div>
                <div class="integration-type-subtitle"></div>
              </div>
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
                  <div v-show="requestIntegration.isOpen" class="flex flex-col gap-4">
                    <div class="flex items-center justify-between gap-4">
                      <div class="text-base font-bold text-gray-800">Request Integration</div>
                      <NcButton size="xsmall" type="text" @click="requestIntegration.isOpen = false">
                        <GeneralIcon icon="close" class="text-gray-600" />
                      </NcButton>
                    </div>
                    <div class="flex flex-col gap-2">
                      <a-textarea
                        v-model:value="requestIntegration.msg"
                        class="!rounded-md !text-sm !min-h-[120px] max-h-[500px] nc-scrollbar-thin"
                        size="large"
                        hide-details
                        placeholder="Provide details about the Integration you want to request & your use-case."
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
                  </div>
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

    .source-card:hover {
      .action-btn {
        @apply block;
      }
    }

    .integration-type-title {
      @apply text-sm text-gray-500 font-weight-700;
    }
    .integration-type-subtitle {
      @apply text-sm text-gray-500 font-weight-700;
    }
    .integration-type-list {
      @apply flex gap-4 flex-wrap;
    }
    .action-btn {
      @apply hidden text-2xl text-gray-500;
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
