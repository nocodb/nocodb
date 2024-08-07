<script lang="ts" setup>
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { IntegrationCategoryType, IntegrationItemType } from '#imports'

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

const { t } = useI18n()

const activeCategory = ref<CategoryItemType | null>(null)

const searchQuery = ref<string>('')

const getIntegrationsByCategory = (category: IntegrationCategoryType, query: string) => {
  return allIntegrations.filter((i) => {
    console.log('i', query, t(i.title), t(i.title).toLowerCase().includes(query.trim().toLowerCase()))
    return i.categories.includes(category) && t(i.title).toLowerCase().includes(query.trim().toLowerCase())
  })
}

const integrationsMapByCategory = computed(() => {
  return integrationCategories
    .filter((c) => (activeCategory.value ? c.value === activeCategory.value.value : true))
    .reduce(
      (acc, curr) => {
        acc[curr.value] = {
          title: curr.title,
          list: getIntegrationsByCategory(curr.value, searchQuery.value),
        }

        return acc
      },
      {} as Record<
        string,
        {
          title: string
          list: IntegrationItemType[]
        }
      >,
    )
})

const handleAddIntegration = (category: IntegrationCategoryType, integration: IntegrationItemType) => {
  if (!integration.isAvailable) {
    return
  }

  // currently we only support database integration category type
  if (category !== IntegrationCategoryType.DATABASE) {
    return
  }

  addIntegration(integration.value)
}
</script>

<template>
  <div class="h-full">
    <a-layout>
      <a-layout-sider class="nc-integration-layout-sidebar">
        <div class="p-3 flex flex-col gap-3 overflow-y-auto nc-scrollbar-thin">
          <div class="text-sm text-gray-700 font-bold">
            {{ $t('title.categories') }}
          </div>
          <div class="flex flex-col gap-1">
            <div
              class="nc-integration-category-item"
              :class="{
                active: activeCategory === null,
              }"
              data-testid="all-integrations"
              @click="activeCategory = null"
            >
              <div
                class="nc-integration-category-item-icon-wrapper"
                :style="{
                  backgroundColor: '',
                }"
              >
                <GeneralIcon
                  :icon="'microsoftAccess'"
                  class="stroke-transparent !grayscale"
                  :style="{
                    filter: 'grayscale(100%) brightness(115%)',
                  }"
                />
              </div>
              <div class="nc-integration-category-item-content-wrapper">
                <div class="nc-integration-category-item-title">All Integrations</div>
                <div class="nc-integration-category-item-subtitle">Content needed</div>
              </div>
            </div>
            <div
              v-for="category of integrationCategories"
              :key="category.value"
              class="nc-integration-category-item"
              :class="{
                active: activeCategory === category,
              }"
              :data-testid="category.value"
              @click="activeCategory = category"
            >
              <div
                class="nc-integration-category-item-icon-wrapper"
                :style="{
                  backgroundColor: '',
                }"
              >
                <component :is="category.icon" class="nc-integration-category-item-icon" />
              </div>
              <div class="nc-integration-category-item-content-wrapper">
                <div class="nc-integration-category-item-title">{{ $t(category.title) }}</div>
                <div class="nc-integration-category-item-subtitle">{{ $t(category.subtitle) }}</div>
              </div>
            </div>
          </div>
        </div>
      </a-layout-sider>
      <a-layout-content class="nc-integration-layout-content">
        <div class="p-6 h-full flex flex-col gap-6">
          <div>
            <div class="flex items-center justify-between gap-3 max-w-[918px]">
              <div class="text-sm font-normal text-gray-600">
                <div>Connect integrations with NocoDB. <a target="_blank" rel="noopener noreferrer"> Learn more </a></div>
              </div>
              <a-input
                v-model:value="searchQuery"
                type="text"
                class="nc-search-integration-input !min-w-[300px] !max-w-[400px] nc-input-sm flex-none"
                placeholder="Search integration..."
                allow-clear
              >
                <template #prefix>
                  <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
                </template>
              </a-input>
            </div>
          </div>

          <div class="flex flex-col nc-workspace-settings-integrations-list h-full">
            <div class="w-full flex justify-center">
              <div class="flex flex-col gap-6 w-full">
                <template v-for="(category, key) in integrationsMapByCategory">
                  <div v-if="category.list.length" :key="key" class="integration-type-wrapper">
                    <div class="integration-type-title">{{ $t(category.title) }}</div>
                    <div class="integration-type-list">
                      <div
                        v-for="integration of category.list"
                        :key="integration.value"
                        class="source-card"
                        @click="handleAddIntegration(key, integration)"
                      >
                        <WorkspaceIntegrationsIcon :integration-type="integrationType.MySQL" size="md" />
                        <div class="name flex-1">{{ $t(integration.title) }}</div>
                        <div class="action-btn">+</div>
                      </div>
                    </div>
                  </div>
                </template>

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
                            placeholder="Provide integration name and your use-case."
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
                            {{ $t('general.submit') }}
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
      </a-layout-content>
    </a-layout>
  </div>
</template>

<style lang="scss" scoped>
.nc-integration-layout-sidebar {
  @apply !bg-white border-r-1 border-gray-200 !min-w-[260px] !max-w-[260px] !overflow-y-auto nc-scrollbar-thin;

  flex: 1 1 260px !important;

  .nc-integration-category-item {
    @apply flex gap-2 p-2 rounded-lg hover:bg-gray-100 cursor-pointer transition-all;

    &.active {
      @apply bg-gray-100;
    }

    .nc-integration-category-item-icon-wrapper {
      @apply flex-none w-5 h-5 flex items-center justify-center rounded;

      .nc-integration-category-item-icon {
        @apply flex-none w-4 h-4;
      }
    }

    .nc-integration-category-item-content-wrapper {
      @apply flex-1 flex flex-col gap-1;

      .nc-integration-category-item-title {
        @apply text-sm text-gray-800 font-weight-500;
      }

      .nc-integration-category-item-subtitle {
        @apply text-xs text-gray-500 font-weight-500;
      }
    }
  }
}

.nc-integration-layout-content {
  @apply !bg-white overflow-y-auto nc-scrollbar-thin;
}
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

.nc-workspace-settings-integrations-list {
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
    height: min(calc(100vh - 100px), 1024px);
    max-height: min(calc(100vh - 100px), 1024px) !important;
  }
}
</style>
