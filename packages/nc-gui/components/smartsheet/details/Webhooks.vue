<script lang="ts" setup>
import type { HookType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const { activeTable } = storeToRefs(useTablesStore())

const { sorts, loadSorts, handleGetSortedData, toggleSort } = useUserSorts('Webhook')

const selectedHook = ref<undefined | HookType>()

const { hooks, isHooksLoading } = storeToRefs(useWebhooksStore())

const { loadHooksList, deleteHook: _deleteHook, copyHook, saveHooks } = useWebhooksStore()

const { activeView } = storeToRefs(useViewsStore())

const isWebhookModalOpen = ref(false)

const modalDeleteButtonRef = ref(null)

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2.5rem',
  },
  spin: true,
})

const deleteHookId = ref('')

const showDeleteModal = ref(false)

const isDeleting = ref(false)

const toBeDeleteHook = computed(() => {
  return hooks.value.find((hook) => hook.id === deleteHookId.value)
})

const deleteHook = async () => {
  isDeleting.value = true
  if (!deleteHookId.value) return

  try {
    await _deleteHook(deleteHookId.value)
  } finally {
    isDeleting.value = false
    showDeleteModal.value = false
    deleteHookId.value = ''
  }
}

const selectedHookId = ref<string | undefined>(undefined)

const isCopying = ref(false)

const copyWebhook = async (hook: HookType) => {
  if (isCopying.value) return

  isCopying.value = true
  try {
    await copyHook(hook)
  } finally {
    isCopying.value = false
  }
}

const openDeleteModal = (hookId: string) => {
  deleteHookId.value = hookId
  showDeleteModal.value = true
}

const webHookSearch = ref('')

const filteredHooks = computed(() =>
  hooks.value.filter((hook) => hook.title?.toLowerCase().includes(webHookSearch.value.toLowerCase())),
)

const sortedHooks = computed(() => {
  return handleGetSortedData(filteredHooks.value, sorts.value)
})

watch(showDeleteModal, () => {
  if (!showDeleteModal.value) return

  nextTick(() => {
    ;(modalDeleteButtonRef.value as any)?.$el?.focus()
  })
})

watch(
  () => activeTable.value?.id,
  async () => {
    if (!activeTable.value?.id) return

    selectedHookId.value = undefined
    await loadHooksList()
  },
  {
    immediate: true,
  },
)

const toggleHook = async (hook: HookType) => {
  hook.active = !hook.active
  await saveHooks({ hook })
}

const createWebhook = async () => {
  isWebhookModalOpen.value = true
}

const editHook = (hook: HookType) => {
  selectedHook.value = hook
  isWebhookModalOpen.value = true
}

const onModalClose = () => {
  isWebhookModalOpen.value = false
  selectedHook.value = undefined
}

onMounted(async () => {
  loadSorts()
})
</script>

<template>
  <div class="nc-webhook-wrapper w-full p-4">
    <div class="max-w-250 h-full w-full mx-auto">
      <div v-if="activeView && !isHooksLoading">
        <div class="w-full mb-4 flex justify-between">
          <div class="flex gap-2">
            <a-input
              v-model:value="webHookSearch"
              class="w-full h-8 flex-1"
              size="small"
              :placeholder="$t('title.searchWebhook')"
            >
              <template #prefix>
                <component :is="iconMap.search" class="w-4 text-gray-500 h-4" />
              </template>
            </a-input>
            <NcButton class="px-2" type="text" size="small">
              <div class="flex items-center gap-2">
                {{ $t('title.docs') }}

                <GeneralIcon icon="externalLink" />
              </div>
            </NcButton>
          </div>

          <NcButton v-e="['c:actions:webhook']" type="secondary" size="small" @click="createWebhook">
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="plus" />
              {{ $t('activity.newWebhook') }}
            </div>
          </NcButton>
        </div>

        <div style="height: calc(100vh - (var(--topbar-height) * 3.5))" class="border-1 rounded-xl border-gray-200">
          <div v-if="!hooks.length" class="flex-col flex items-center gap-2 justify-center w-full h-full">
            <div class="text-gray-700 font-bold text-center text-2xl">{{ $t('msg.createWebhookMsg1') }}</div>
            <div class="text-gray-700 text-center max-w-[24rem]">{{ $t('msg.createWebhookMsg2') }}</div>
            <NcButton v-e="['c:actions:webhook']" class="flex max-w-40" type="primary" size="small" @click="createWebhook()">
              <div class="flex flex-row items-center justify-between w-full">
                <span class="ml-1">{{ $t('activity.newWebhook') }}</span>
                <GeneralIcon icon="plus" />
              </div>
            </NcButton>
          </div>

          <div v-else style="height: calc(100vh - (var(--topbar-height) * 3.5))" class="nc-scrollbar-md overflow-y-auto">
            <div class="sticky rounded-t-xl border-b-1 flex h-13.5 bg-gray-50">
              <div class="py-3 w-19 px-6"></div>
              <LazyAccountHeaderWithSorter
                :active-sort="sorts"
                :header="$t('general.name')"
                :toggle-sort="toggleSort"
                class="text-gray-500 w-full flex-1 px-6 py-3 flex items-center space-x-2"
                field="title"
              />

              <div class="text-gray-500 w-full flex-1 px-6 py-3 flex items-center space-x-2">
                {{ $t('general.type') }}
              </div>

              <LazyAccountHeaderWithSorter
                :active-sort="sorts"
                :header="$t('labels.addedOn')"
                :toggle-sort="toggleSort"
                class="text-gray-500 w-full flex-1 px-6 py-3 flex items-center space-x-2"
                field="created_at"
              />
              <div class="py-3 w-20 px-6"></div>
            </div>

            <div
              v-for="hook in sortedHooks"
              :key="hook.id"
              class="flex max-h-13.5 border-gray-100 border-b-1 transition cursor-pointer hover:bg-gray-50"
            >
              <div class="py-3 w-19 px-6">
                <NcSwitch v-e="['c:actions:webhook']" size="small" :checked="!!hook.active" @change="toggleHook(hook)" />
              </div>
              <div class="text-gray-800 font-semibold w-full flex-1 px-6 py-3 flex items-center space-x-2">
                <NcTooltip class="truncate whitespace-no-wrap max-w-58 overflow-hidden" show-on-truncate-only>
                  {{ hook.title }}

                  <template #title>
                    {{ hook.title }}
                  </template>
                </NcTooltip>
              </div>
              <div class="text-gray-600 w-full capitalize flex-1 px-6 py-3 flex items-center space-x-2">
                {{ hook.event }} {{ hook.operation }}
              </div>

              <div class="text-gray-600 w-full capitalize flex-1 px-6 py-3 flex items-center space-x-2">
                {{ dayjs(hook.created_at).format('DD MMM YYYY') }}
              </div>
              <div class="py-3 w-20 px-6">
                <NcDropdown>
                  <NcButton type="secondary" size="small" class="!w-8 !h-8">
                    <component :is="iconMap.threeDotVertical" class="text-gray-700" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu class="w-48">
                      <NcMenuItem key="edit" data-testid="nc-webhook-item-action-edit" @click="editHook(hook)">
                        <GeneralIcon icon="edit" class="text-gray-800" />
                        <span>{{ $t('general.edit') }}</span>
                      </NcMenuItem>
                      <NcMenuItem key="duplicate" data-testid="nc-webhook-item-action-duplicate" @click="copyWebhook(hook)">
                        <GeneralIcon icon="duplicate" class="text-gray-800" />
                        <span>{{ $t('general.duplicate') }}</span>
                      </NcMenuItem>

                      <a-menu-divider class="my-1.5" />

                      <NcMenuItem
                        key="delete"
                        class="!hover:bg-red-50"
                        data-testid="nc-webhook-item-action-delete"
                        @click="openDeleteModal(hook.id)"
                      >
                        <div class="text-red-500">
                          <GeneralIcon icon="delete" class="group-hover:text-accent -ml-0.25 -mt-0.75 mr-0.5" />
                          {{ $t('general.delete') }}
                        </div>
                      </NcMenuItem>
                    </NcMenu>
                  </template>
                </NcDropdown>
              </div>
            </div>
          </div>
        </div>
        <GeneralDeleteModal v-model:visible="showDeleteModal" :entity-name="$t('objects.webhook')" :on-delete="deleteHook">
          <template #entity-preview>
            <div v-if="toBeDeleteHook" class="flex flex-row items-center py-2 px-3 bg-gray-50 rounded-lg text-gray-700 mb-4">
              <component :is="iconMap.hook" class="text-gray-600" />
              <div
                class="capitalize text-ellipsis overflow-hidden select-none w-full pl-2.5"
                :style="{ wordBreak: 'keep-all', whiteSpace: 'nowrap', display: 'inline' }"
              >
                {{ toBeDeleteHook.title }}
              </div>
            </div>
          </template>
        </GeneralDeleteModal>

        <Webhook v-model:value="isWebhookModalOpen" :hook="selectedHook" @close="onModalClose" />
      </div>
      <div
        v-else
        class="h-full w-full flex flex-col justify-center items-center"
        style="height: calc(100vh - (var(--topbar-height) * 2))"
      >
        <a-spin size="large" :indicator="indicator" />
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.ant-input::placeholder {
  @apply text-gray-500;
}

.ant-input:placeholder-shown {
  @apply text-gray-500 !text-md;
}

.ant-input-affix-wrapper {
  @apply px-4 rounded-lg py-2 w-84 border-1 focus:border-brand-500 border-gray-200 !ring-0;
}
</style>
