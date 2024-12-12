<script lang="ts" setup>
import type { HookType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'
import dayjs from 'dayjs'

const { activeTable } = storeToRefs(useTablesStore())

const { sorts, sortDirection, loadSorts, handleGetSortedData, saveOrUpdate: saveOrUpdateSort } = useUserSorts('Webhook')

const selectedHook = ref<undefined | HookType>()

const { hooks, isHooksLoading } = storeToRefs(useWebhooksStore())

const { loadHooksList, deleteHook: _deleteHook, copyHook, saveHooks } = useWebhooksStore()

const { activeView } = storeToRefs(useViewsStore())

const { t } = useI18n()

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

watch(isWebhookModalOpen, (val) => {
  if (!val) {
    selectedHook.value = undefined
  }
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
  if (hook.event === 'manual' && hook.operation === 'trigger') {
    message.error(t('msg.error.manualTriggerHook'))
    return
  }

  const ogHook = Object.assign({}, hook)
  hook.active = !hook.active
  await saveHooks({ hook, ogHook })
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

const orderBy = computed<Record<string, SordDirectionType>>({
  get: () => {
    return sortDirection.value
  },
  set: (value: Record<string, SordDirectionType>) => {
    // Check if value is an empty object
    if (Object.keys(value).length === 0) {
      saveOrUpdateSort({})
      return
    }

    const [field, direction] = Object.entries(value)[0]

    saveOrUpdateSort({
      field,
      direction,
    })
  },
})

const eventList = ref<Record<string, any>[]>([
  { text: [t('general.on'), t('labels.recordInsert')], value: ['after', 'insert'] },
  { text: [t('general.on'), t('labels.recordUpdate')], value: ['after', 'update'] },
  { text: [t('general.on'), t('labels.recordDelete')], value: ['after', 'delete'] },
  { text: [t('general.onMultiple'), t('labels.recordInsert')], value: ['after', 'bulkInsert'] },
  { text: [t('general.onMultiple'), t('labels.recordUpdate')], value: ['after', 'bulkUpdate'] },
  { text: [t('general.onMultiple'), t('labels.recordDelete')], value: ['after', 'bulkDelete'] },
  { text: [t('general.manual'), t('general.trigger')], value: ['manual', 'trigger'] },
])

const columns: NcTableColumnProps[] = [
  {
    key: 'active',
    title: t('general.active'),
    width: 90,
    minWidth: 90,
  },
  {
    key: 'name',
    title: t('general.name'),
    minWidth: 252,
    showOrderBy: true,
    dataIndex: 'title',
  },
  {
    key: 'type',
    title: t('general.type'),
    basis: '25%',
    minWidth: 200,
    showOrderBy: true,
    dataIndex: 'webhook-operation-type',
  },
  {
    key: 'created_at',
    title: t('labels.addedOn'),
    width: 180,
    minWidth: 180,
    showOrderBy: true,
    dataIndex: 'created_at',
  },
  {
    key: 'action',
    title: '',
    width: 80,
    minWidth: 80,
  },
]

const customRow = (hook: HookType) => {
  return {
    onClick: () => editHook(hook),
  }
}

const getHookTypeText = (hook: HookType) => {
  return (
    eventList.value.find((e) => e.value.includes(hook.event) && e.value.includes(hook.operation))?.text?.join(' ') ||
    `Before ${hook.operation}`
  )
}
</script>

<template>
  <div class="nc-webhook-wrapper w-full p-4">
    <div class="max-w-250 h-full w-full mx-auto">
      <div v-if="activeView && !isHooksLoading">
        <div class="w-full mb-4 flex justify-between gap-3">
          <div class="flex-1 flex gap-2">
            <a-input
              v-model:value="webHookSearch"
              class="w-full nc-input-sm nc-input-border-on-value !max-w-84"
              size="small"
              :placeholder="$t('title.searchWebhook')"
              allow-clear
            >
              <template #prefix>
                <GeneralIcon icon="search" class="mr-2 h-4 w-4 text-gray-500" />
              </template>
            </a-input>
            <NcButton
              class="px-2"
              type="text"
              size="small"
              @click="navigateTo('https://docs.nocodb.com/category/webhook/', { open: navigateToBlankTargetOpenOption })"
            >
              <div class="flex items-center gap-2">
                {{ $t('title.docs') }}

                <GeneralIcon icon="externalLink" />
              </div>
            </NcButton>
          </div>

          <NcButton
            v-e="['c:actions:webhook']"
            type="secondary"
            size="small"
            class="!text-brand-500 !hover:text-brand-600"
            data-testid="nc-new-webhook"
            @click="createWebhook"
          >
            <div class="flex gap-2 items-center">
              <GeneralIcon icon="plus" />
              {{ $t('activity.newWebhook') }}
            </div>
          </NcButton>
        </div>

        <div style="height: calc(100vh - (var(--topbar-height) * 3.5))" class="">
          <div
            v-if="!hooks.length"
            class="flex-col flex items-center gap-6 justify-center w-full h-full py-12 px-4 border-1 rounded-xl border-gray-200"
          >
            <div class="text-gray-700 font-bold text-center text-2xl">{{ $t('msg.createWebhookMsg1') }}</div>
            <div class="text-gray-700 text-center max-w-[24rem]">{{ $t('msg.createWebhookMsg2') }}</div>
            <NcButton v-e="['c:actions:webhook']" class="flex max-w-40" type="primary" size="small" @click="createWebhook">
              <div class="flex items-center gap-2">
                <GeneralIcon icon="plus" class="flex-none" />
                <span>{{ $t('activity.newWebhook') }}</span>
              </div>
            </NcButton>
          </div>

          <NcTable
            v-else
            v-model:order-by="orderBy"
            :columns="columns"
            :data="sortedHooks"
            :custom-row="customRow"
            class="h-full"
            body-row-class-name="nc-view-sidebar-webhook-item"
          >
            <template #bodyCell="{ column, record: hook }">
              <NcTooltip :disabled="hook.event !== 'manual'">
                <template #title>
                  {{ $t('msg.error.manualTriggerHook') }}
                </template>
                <div v-if="column.key === 'active'" v-e="['c:actions:webhook']" @click.stop>
                  <NcSwitch
                    size="small"
                    :disabled="hook.event === 'manual'"
                    :checked="!!hook.active"
                    @change="toggleHook(hook)"
                  />
                </div>
              </NcTooltip>

              <template v-if="column.key === 'name'">
                <NcTooltip class="truncate max-w-full text-gray-800 font-semibold text-sm" show-on-truncate-only>
                  {{ hook.title }}

                  <template #title>
                    {{ hook.title }}
                  </template>
                </NcTooltip>
              </template>
              <template v-if="column.key === 'type'">
                {{ getHookTypeText(hook) }}
              </template>
              <template v-if="column.key === 'created_at'">
                {{ dayjs(hook.created_at).format('DD MMM YYYY') }}
              </template>
              <template v-if="column.key === 'action'">
                <NcDropdown overlay-class-name="nc-webhook-item-action-dropdown">
                  <NcButton type="secondary" size="small" class="!w-8 !h-8" data-testid="nc-webhook-item-action" @click.stop>
                    <component :is="iconMap.threeDotVertical" class="text-gray-700" />
                  </NcButton>
                  <template #overlay>
                    <NcMenu class="w-48" variant="small">
                      <NcMenuItem key="edit" data-testid="nc-webhook-item-action-edit" @click="editHook(hook)">
                        <GeneralIcon icon="edit" class="text-gray-800" />
                        <span>{{ $t('general.edit') }}</span>
                      </NcMenuItem>
                      <NcMenuItem key="duplicate" data-testid="nc-webhook-item-action-duplicate" @click="copyWebhook(hook)">
                        <GeneralIcon icon="duplicate" class="text-gray-800" />
                        <span>{{ $t('general.duplicate') }}</span>
                      </NcMenuItem>

                      <NcDivider />

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
              </template>
            </template>
          </NcTable>
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
            <span v-if="toBeDeleteHook?.event === 'manual'" class="text-small leading-[18px] mb-2 text-gray-500">
              {{ $t('msg.warning.webhookDelete') }}
            </span>
          </template>
        </GeneralDeleteModal>

        <Webhook
          v-if="isWebhookModalOpen"
          v-model:value="isWebhookModalOpen"
          :hook="selectedHook"
          :event-list="eventList"
          @close="onModalClose"
        />
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
:deep(.ant-input::placeholder) {
  @apply text-gray-500;
}
</style>
