<script lang="ts" setup>
import type { VNodeRef } from '@vue/runtime-core'
import NcModal from '~/components/nc/Modal.vue'
/* eslint-disable @typescript-eslint/consistent-type-imports */
import { IntegrationCategoryType, type IntegrationItemType, SyncDataType } from '#imports'

const props = withDefaults(
  defineProps<{
    isModal?: boolean
    filterCategory?: (c: IntegrationCategoryItemType) => boolean
    filterIntegration?: (i: IntegrationItemType) => boolean
  }>(),
  {
    isModal: false,
    filterCategory: () => true,
    filterIntegration: () => true,
  },
)

const { isModal, filterCategory, filterIntegration } = props

const { $e } = useNuxtApp()

const { t } = useI18n()

const { syncDataUpvotes, updateSyncDataUpvotes } = useGlobal()

const { pageMode, IntegrationsPageMode, requestIntegration, addIntegration, saveIntegraitonRequest } = useIntegrationStore()

const focusTextArea: VNodeRef = (el) => el && el?.focus?.()

const activeCategory = ref<IntegrationCategoryItemType | null>(null)

const searchQuery = ref<string>('')

const integrationListRef = ref<HTMLDivElement>()

const { width: integrationListContainerWidth } = useElementSize(integrationListRef)

const listWrapperMaxWidth = computed(() => {
  if (integrationListContainerWidth.value <= 328 || integrationListContainerWidth.value < 624) {
    return '328px'
  }

  if (integrationListContainerWidth.value < 920) {
    return '576px'
  }

  if (integrationListContainerWidth.value < 1216) {
    return '872px'
  }

  return '1168px'
})

const upvotesData = computed(() => {
  return new Set(syncDataUpvotes.value)
})

const getIntegrationsByCategory = (category: IntegrationCategoryType, query: string) => {
  return allIntegrations.filter((i) => {
    const isOssOnly = isEeUI ? !i?.isOssOnly : true
    return (
      isOssOnly &&
      filterIntegration(i) &&
      i.categories.includes(category) &&
      t(i.title).toLowerCase().includes(query.trim().toLowerCase())
    )
  })
}

const integrationsMapByCategory = computed(() => {
  return integrationCategories
    .filter(filterCategory)
    .filter((c) => (activeCategory.value ? c.value === activeCategory.value.value : true))
    .reduce(
      (acc, curr) => {
        acc[curr.value] = {
          title: curr.title,
          subtitle: curr.subtitle,
          list: getIntegrationsByCategory(curr.value, searchQuery.value),
          isAvailable: curr.isAvailable,
          teleEventName: curr.teleEventName,
        }

        return acc
      },
      {} as Record<
        string,
        {
          title: string
          subtitle?: string
          list: IntegrationItemType[]
          isAvailable?: boolean
          teleEventName?: IntegrationCategoryType
        }
      >,
    )
})

const isEmptyList = computed(() => {
  const categories = Object.keys(integrationsMapByCategory.value)

  if (!categories.length) {
    return true
  }

  return !categories.some((category) => integrationsMapByCategory.value[category].list.length > 0)
})

const isAddNewIntegrationModalOpen = computed({
  get: () => {
    return pageMode.value === IntegrationsPageMode.LIST
  },
  set: (value: boolean) => {
    if (!value) {
      pageMode.value = null
    }
  },
})

const handleUpvote = (category: IntegrationCategoryType, syncDataType: SyncDataType) => {
  if (upvotesData.value.has(syncDataType)) return

  $e(`a:integration-request:${integrationsMapByCategory.value[category]?.teleEventName || category}:${syncDataType}`)

  updateSyncDataUpvotes([...syncDataUpvotes.value, syncDataType])
}

const handleAddIntegration = (category: IntegrationCategoryType, integration: IntegrationItemType) => {
  if (!integration.isAvailable) {
    handleUpvote(category, integration.value)
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
    <a-layout>
      <a-layout-content class="nc-integration-layout-content">
        <div v-if="isModal" class="p-4 w-full flex items-center justify-between gap-3 border-b-1 border-gray-200">
          <NcButton type="text" size="small" @click="isAddNewIntegrationModalOpen = false">
            <GeneralIcon icon="arrowLeft" />
          </NcButton>
          <GeneralIcon icon="gitCommit" class="flex-none h-5 w-5" />
          <div class="flex-1 text-base font-weight-700">New Connection</div>
          <div class="flex items-center gap-3">
            <NcButton size="small" type="text" @click="isAddNewIntegrationModalOpen = false">
              <GeneralIcon icon="close" class="text-gray-600" />
            </NcButton>
          </div>
        </div>
        <div
          class="w-full flex flex-col gap-6"
          :class="{
            'h-[calc(100%_-_66px)]': isModal,
            'h-full': !isModal,
          }"
        >
          <div v-if="integrationListContainerWidth" class="px-6 pt-6">
            <div
              class="flex items-end justify-end flex-wrap gap-3 m-auto"
              :style="{
                maxWidth: listWrapperMaxWidth,
              }"
            >
              <div class="flex-1">
                <div class="text-sm font-normal text-gray-600 mb-2">
                  <div>
                    Connect integrations with NocoDB.
                    <a href="https://docs.nocodb.com/category/integrations" target="_blank" rel="noopener noreferrer"
                      >Learn more</a
                    >
                  </div>
                </div>
                <a-input
                  v-model:value="searchQuery"
                  type="text"
                  class="nc-input-border-on-value nc-search-integration-input !min-w-[300px] !max-w-[400px] nc-input-sm flex-none"
                  placeholder="Search integration"
                  allow-clear
                >
                  <template #prefix>
                    <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
                  </template>
                </a-input>
              </div>
              <NcButton type="ghost" size="small" class="!text-primary" @click="requestIntegration.isOpen = true">
                Request Integration
              </NcButton>
            </div>
          </div>

          <div
            ref="integrationListRef"
            class="flex-1 px-6 pb-6 flex flex-col nc-workspace-settings-integrations-list overflow-y-auto nc-scrollbar-thin"
          >
            <div
              v-if="integrationListContainerWidth"
              class="w-full flex justify-center"
              :class="{
                'flex-1': isEmptyList,
              }"
            >
              <div
                class="flex flex-col space-y-6 w-full"
                :style="{
                  maxWidth: listWrapperMaxWidth,
                }"
              >
                <template v-for="(category, key) in integrationsMapByCategory">
                  <div v-if="category.list.length" :key="key" class="integration-type-wrapper">
                    <div class="category-type-title flex gap-2">
                      {{ $t(category.title) }}
                      <NcBadge
                        v-if="!category.isAvailable"
                        :border="false"
                        class="text-brand-500 !h-5 bg-brand-50 text-xs font-normal px-2"
                        >{{ $t('msg.toast.futureRelease') }}</NcBadge
                      >
                    </div>
                    <div v-if="category.list.length" class="integration-type-list">
                      <NcTooltip
                        v-for="integration of category.list"
                        :key="integration.value"
                        :disabled="integration?.isAvailable"
                        placement="bottom"
                      >
                        <template #title>{{ $t('tooltip.comingSoonIntegration') }}</template>

                        <div
                          :tabindex="0"
                          class="source-card focus-visible:outline-none h-full"
                          :class="{
                            'is-available': integration?.isAvailable,
                          }"
                          @click="handleAddIntegration(key, integration)"
                        >
                          <div class="integration-icon-wrapper">
                            <component :is="integration.icon" class="integration-icon" :style="integration.iconStyle" />
                          </div>
                          <div class="flex-1">
                            <div class="name">{{ $t(integration.title) }}</div>
                            <div v-if="integration.subtitle" class="subtitle flex-1">{{ $t(integration.subtitle) }}</div>
                          </div>
                          <div v-if="integration?.isAvailable" class="action-btn">+</div>
                          <div v-else class="">
                            <NcButton
                              type="secondary"
                              size="xs"
                              class="integration-upvote-btn !rounded-lg !px-1 !py-0"
                              :class="{
                                selected: upvotesData.has(integration.value),
                              }"
                            >
                              <div class="flex items-center gap-2">
                                <GeneralIcon icon="ncArrowUp" />
                              </div>
                            </NcButton>
                          </div>
                        </div>
                      </NcTooltip>
                    </div>
                  </div>
                </template>

                <div v-if="isEmptyList" class="h-full text-center flex items-center justify-center gap-3">
                  <a-empty :image="Empty.PRESENTED_IMAGE_SIMPLE" :description="$t('labels.noData')" class="!my-0" />
                </div>
              </div>
            </div>
            <div v-else class="h-full flex items-center justify-center"><GeneralLoader size="xlarge" /></div>
          </div>
        </div>
        <NcModal
          v-model:visible="requestIntegration.isOpen"
          centered
          size="medium"
          @keydown.esc="requestIntegration.isOpen = false"
        >
          <div v-show="requestIntegration.isOpen" class="flex flex-col gap-4">
            <div class="flex items-center justify-between gap-4">
              <div class="text-base font-bold text-gray-800">Request Integration</div>
              <NcButton size="small" type="text" @click="requestIntegration.isOpen = false">
                <GeneralIcon icon="close" class="text-gray-600" />
              </NcButton>
            </div>
            <div class="flex flex-col gap-2">
              <a-textarea
                :ref="focusTextArea"
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
        </NcModal>
      </a-layout-content>
    </a-layout>
  </component>
</template>

<style lang="scss" scoped>
.nc-integration-layout-sidebar {
  @apply !bg-white border-r-1 border-gray-200 !min-w-[260px] !max-w-[260px];

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
  @apply !bg-white;
}
.source-card-request-integration {
  @apply flex flex-col gap-4 border-1 rounded-xl p-3 w-[280px] overflow-hidden transition-all duration-300 max-w-[576px];

  &.active {
    @apply w-full;
  }
  &:not(.active) {
    @apply cursor-pointer hover:bg-gray-50;

    &:hover {
      box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);
    }
  }

  .source-card-item {
    @apply flex items-center gap-4;

    .name {
      @apply text-base font-semibold text-gray-800;
    }
  }
}
.source-card-link {
  @apply !text-black !no-underline;
  .nc-new-integration-type-title {
    @apply text-sm font-weight-600 text-gray-600;
  }
}

.nc-workspace-settings-integrations-list {
  .integration-type-wrapper {
    @apply flex flex-col gap-3;

    .integration-type-list {
      @apply flex gap-4 flex-wrap;

      .source-card {
        @apply flex items-center gap-4 border-1 border-gray-200 rounded-xl p-3 w-[280px] cursor-pointer transition-all duration-300;

        .integration-icon-wrapper {
          @apply flex-none h-[44px] w-[44px] rounded-lg flex items-center justify-center;

          .integration-icon {
            @apply flex-none stroke-transparent;
          }
        }

        .name {
          @apply text-base font-bold;
        }

        .action-btn {
          @apply hidden text-2xl text-gray-500 w-7 h-7 text-center;
        }

        &.is-available {
          &:hover {
            @apply bg-gray-50;

            box-shadow: 0px 4px 8px -2px rgba(0, 0, 0, 0.08), 0px 2px 4px -2px rgba(0, 0, 0, 0.04);

            .action-btn {
              @apply block;
            }
          }

          // .integration-icon-wrapper {
          //   @apply bg-gray-100;
          // }
          .name {
            @apply text-gray-800;
          }
        }

        &:not(.is-available) {
          &:not(:hover) {
            .integration-icon-wrapper {
              // @apply bg-gray-50;

              // .integration-icon {
              //   @apply !grayscale;

              //   filter: grayscale(100%) brightness(115%);
              // }
            }

            .name {
              @apply text-gray-800;
            }
          }

          &:hover {
            .name {
              @apply text-gray-800;
            }
          }

          .integration-upvote-btn {
            &.selected {
              @apply shadow-selected !text-brand-500 !border-brand-500 !cursor-not-allowed pointer-events-none;
            }
          }
        }
      }
    }

    .category-type-title {
      @apply text-sm text-gray-700 font-weight-700;
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
  .ant-modal-content {
    overflow: hidden;
  }
}
</style>
