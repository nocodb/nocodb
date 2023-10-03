<script lang="ts" setup>
import type { HookType } from 'nocodb-sdk'
import { LoadingOutlined } from '@ant-design/icons-vue'

// const showWebhookDrawer = ref(false)

const router = useRouter()

const route = router.currentRoute

const { hooks, webhookMainUrl, isHooksLoading } = storeToRefs(useWebhooksStore())
const { loadHooksList, deleteHook: _deleteHook, copyHook, saveHooks, navigateToWebhook } = useWebhooksStore()
const { activeView } = storeToRefs(useViewsStore())

const modalDeleteButtonRef = ref(null)

const { activeTable } = storeToRefs(useTablesStore())

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '2.5rem',
  },
  spin: true,
})

/*
const eventList = ref<Record<string, any>[]>([
  { text: ['After', 'Insert'], value: ['after', 'insert'] },
  { text: ['After', 'Update'], value: ['after', 'update'] },
  { text: ['After', 'Delete'], value: ['after', 'delete'] },
  { text: ['After', 'Bulk Insert'], value: ['after', 'bulkInsert'] },
  { text: ['After', 'Bulk Update'], value: ['after', 'bulkUpdate'] },
  { text: ['After', 'Bulk Delete'], value: ['after', 'bulkDelete'] },
])
*/

const deleteHookId = ref('')
const toBeDeleteHook = computed(() => {
  return hooks.value.find((hook) => hook.id === deleteHookId.value)
})

const selectedHookId = ref<string | undefined>(undefined)
const selectedHook = computed(() => {
  if (!selectedHookId.value) return undefined

  return hooks.value.find((hook) => hook.id === selectedHookId.value)
})

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const isCopying = ref(false)

const isDraftMode = ref(false)

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

const openEditor = (hookId?: string | undefined) => {
  navigateToWebhook({ hookId })
}

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
  navigateToWebhook({ openCreatePage: true })
}

const onEditorClose = () => {
  navigateToWebhook({ openMainPage: true })
}

watch(
  () => route.value.params.slugs,
  async () => {
    if (!route.value.params.slugs) {
      isDraftMode.value = false
      selectedHookId.value = undefined
      return
    }

    if (route.value.params.slugs[1] === 'create') {
      isDraftMode.value = true
    } else {
      isDraftMode.value = false
    }

    selectedHookId.value = (route.value.params.slugs && route.value.params.slugs[1]) || undefined
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div
    v-if="activeView && !isHooksLoading"
    :key="selectedHookId"
    class="flex flex-col pt-3 pb-12 border-gray-50 pl-3 pr-0 nc-view-sidebar-webhook nc-scrollbar-md"
    style="height: calc(100vh - (var(--topbar-height) * 2))"
  >
    <div
      class="flex flex-row justify-between w-full min-h-8 mb-8"
      :class="{
        '!items-start mt-1': !selectedHookId && !isDraftMode,
      }"
    >
      <div class="flex flex-row items-center gap-x-1">
        <NcButton
          v-if="isDraftMode || selectedHookId"
          type="text"
          size="xsmall"
          @click="navigateToWebhook({ openMainPage: true })"
        >
          <GeneralIcon icon="arrowLeft" />
        </NcButton>
        <div class="flex flex-row ml-2">
          <NuxtLink class="link" :to="webhookMainUrl">{{ $t('objects.webhooks') }}</NuxtLink>
        </div>
        <template v-if="selectedHook || isDraftMode">
          <div class="flex text-gray-400">/</div>
          <div class="flex link">{{ selectedHook ? selectedHook.title : $t('general.create') }}</div>
        </template>
        <div
          v-if="selectedHook"
          class="flex text-xs px-1.5 py-1 rounded-md ml-1"
          :class="{
            'bg-green-200 text-green-800': selectedHook.active,
            'bg-gray-100 text-gray-500': !selectedHook.active,
          }"
        >
          {{ selectedHook.active ? $t('general.active') : $t('general.inactive') }}
        </div>
      </div>
      <NcButton
        v-if="!selectedHookId && !isDraftMode"
        v-e="['c:actions:webhook']"
        class="mr-4 max-w-40"
        type="secondary"
        size="small"
        @click="createWebhook()"
      >
        <div class="flex flex-row items-center justify-between w-full text-brand-500">
          <span class="ml-1">{{ $t('activity.newWebhook') }}</span>
          <GeneralIcon icon="plus" />
        </div>
      </NcButton>
    </div>
    <div v-if="!selectedHookId && !isDraftMode" class="flex flex-col h-full w-full items-center">
      <div v-if="hooks.length === 0" class="flex flex-col px-1.5 py-2.5 ml-1 h-full justify-center items-center gap-y-6">
        <GeneralIcon icon="webhook" class="flex text-5xl h-10" style="-webkit-text-stroke: 0.5px" />
        <div class="flex text-gray-600 font-medium text-lg">{{ $t('msg.createWebhookMsg1') }}</div>
        <div class="flex flex-col items-center">
          <div class="flex">{{ $t('msg.createWebhookMsg2') }}</div>
          <div class="flex">{{ $t('msg.createWebhookMsg3') }}</div>
        </div>
        <NcButton v-e="['c:actions:webhook']" class="flex max-w-40" type="primary" @click="createWebhook()">
          <div class="flex flex-row items-center justify-between w-full">
            <span class="ml-1">{{ $t('activity.newWebhook') }}</span>
            <GeneralIcon icon="plus" />
          </div>
        </NcButton>
      </div>
      <div v-else class="flex flex-col pb-2 mt-3 mb-2.5 w-full max-w-200">
        <div class="flex flex-row nc-view-sidebar-webhook-header pl-3 pr-2 !py-2.5">
          <div class="nc-view-sidebar-webhook-item-toggle header">{{ $t('general.activate') }}</div>
          <div class="nc-view-sidebar-webhook-item-title header">{{ $t('general.title') }}</div>
          <div class="nc-view-sidebar-webhook-item-event header">{{ $t('general.event') }}</div>
          <div class="nc-view-sidebar-webhook-item-action header">{{ $t('general.action') }}</div>
        </div>
        <div v-for="hook in hooks" :key="hook.id" class="nc-view-sidebar-webhook-item">
          <div
            class="flex flex-row w-full items-center pl-3 pr-2 py-2 hover:bg-gray-50 rounded-lg cursor-pointer group text-gray-600"
            :class="{
              'bg-brand-50 !text-brand-500 hover:bg-brand-50': hook.id === selectedHookId,
            }"
          >
            <div class="nc-view-sidebar-webhook-item-toggle">
              <a-switch
                v-e="['c:actions:webhook']"
                size="small"
                :checked="!!hook.active"
                class="min-w-4"
                @change="toggleHook(hook)"
              />
            </div>
            <div class="nc-view-sidebar-webhook-item-title font-medium flex flex-row items-center" @click="openEditor(hook.id!)">
              <div class="text-inherit group-hover:text-black capitalize">
                {{ hook?.title }}
              </div>
            </div>

            <div class="nc-view-sidebar-webhook-item-event capitalize">{{ hook?.event }} {{ hook?.operation }}</div>

            <div class="nc-view-sidebar-webhook-item-action !">
              <NcDropdown :trigger="['click']" overlay-class-name="!rounded-md">
                <NcButton
                  size="xsmall"
                  type="text"
                  class="nc-btn-webhook-more !text-gray-500 !hover:text-gray-800"
                  :class="{
                    '!hover:bg-brand-100': hook.id === selectedHookId,
                    '!hover:bg-gray-200': hook.id !== selectedHookId,
                  }"
                >
                  <GeneralIcon icon="threeDotVertical" class="text-inherit" />
                </NcButton>
                <template #overlay>
                  <div class="flex flex-col p-0 items-start">
                    <NcButton
                      type="text"
                      class="w-full !rounded-none"
                      :loading="isCopying"
                      :centered="false"
                      @click="copyWebhook(hook)"
                    >
                      <template #loading> {{ $t('general.duplicating') }} </template>
                      <div class="flex items-center gap-x-1"><GeneralIcon icon="copy" /> {{ $t('general.duplicate') }}</div>
                    </NcButton>
                    <NcButton type="text" class="w-full !rounded-none" :centered="false" @click="openDeleteModal(hook.id!)">
                      <div class="flex items-center justify-start gap-x-1 !text-red-500">
                        <GeneralIcon icon="delete" />
                        {{ $t('general.delete') }}
                      </div>
                    </NcButton>
                  </div>
                </template>
              </NcDropdown>
            </div>
          </div>
        </div>
      </div>
    </div>
    <div v-else class="flex w-full pr-4 justify-center">
      <div class="flex flex-col mt-4 p-8 mb-4 border-1 rounded-2xl w-full max-w-200" style="height: fit-content">
        <WebhookEditor :key="selectedHookId" :hook="selectedHook" @close="onEditorClose" @delete="showDeleteModal = true" />
      </div>
    </div>
  </div>
  <div
    v-else
    class="h-full w-full flex flex-col justify-center items-center"
    style="height: calc(100vh - (var(--topbar-height) * 2))"
  >
    <a-spin size="large" :indicator="indicator" />
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
  <!-- <LazyWebhookDrawer v-if="showWebhookDrawer" v-model="showWebhookDrawer" /> -->
</template>

<style lang="scss" scoped>
.button {
  @apply px-2 cursor-pointer hover:bg-gray-50 text-gray-700 rounded hover:text-black;
}
.circle {
  width: 0.6rem;
  height: 0.6rem;
  background-color: #ffffff;
  border-radius: 50%;
  position: relative;
}

.button {
  @apply px-2 cursor-pointer hover:bg-gray-50 text-gray-700 rounded hover:text-black;
}

.dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-52.5%, -52.5%);
}

.link {
  @apply !hover:text-gray-800 !text-gray-600 !underline-transparent !hover:underline  transition-all duration-150 cursor-pointer;
}

.nc-view-sidebar-webhook-item {
  @apply flex flex-row mr-3 items-center border-b-1 py-1 border-gray-100;
}
.nc-view-sidebar-webhook-item:last-child {
  @apply border-b-0;
}
.nc-view-sidebar-webhook-item-toggle {
  @apply flex flex-row min-w-1/10 max-w-1/10 ml-2;
}
.nc-view-sidebar-webhook-item-title {
  @apply flex flex-row min-w-6/10 max-w-6/10;
}
.nc-view-sidebar-webhook-item-event {
  @apply flex flex-row min-w-2/10 max-w-2/10;
}
.nc-view-sidebar-webhook-item-action {
  @apply flex flex-row w-1/10 justify-end;
}
.nc-view-sidebar-webhook-item > .header {
  @apply text-gray-500;
}
</style>
