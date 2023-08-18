<script lang="ts" setup>
import type { HookType } from 'nocodb-sdk'
// const showWebhookDrawer = ref(false)

const router = useRouter()

const route = router.currentRoute

const { hooks, webhookMainUrl } = storeToRefs(useWebhooksStore())
const { loadHooksList, deleteHook: _deleteHook, copyHook, saveHooks, navigateToWebhook } = useWebhooksStore()
const { activeView } = storeToRefs(useViewsStore())

const modalDeleteButtonRef = ref(null)

const { activeTable } = storeToRefs(useTablesStore())

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
    modalDeleteButtonRef.value?.$el?.focus()
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
  isDraftMode.value = false
  selectedHookId.value = undefined
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
    v-if="activeView"
    class="flex flex-col pt-3 border-gray-50 pl-3 pr-0 nc-view-sidebar-webhook"
    style="height: calc(100vh - (var(--topbar-height) * 2))"
  >
    <div class="flex flex-row justify-between w-full">
      <div class="flex flex-row items-center">
        <NcButton
          v-if="isDraftMode || selectedHookId"
          type="text"
          size="xsmall"
          @click="navigateToWebhook({ openMainPage: true })"
        >
          <GeneralIcon icon="arrowLeft" class="ml-0.75" />
        </NcButton>
        <div class="flex flex-row ml-3">
          <NuxtLink class="link" :to="webhookMainUrl"> Webhook </NuxtLink>
        </div>
      </div>
      <NcButton v-e="['c:actions:webhook']" class="mr-4 max-w-40" type="secondary" @click="createWebhook()">
        <div class="flex flex-row items-center justify-between w-full text-brand-500">
          <span class="ml-1">New Webhook</span>
          <GeneralIcon icon="plus" />
        </div>
      </NcButton>
    </div>
    <div v-if="!selectedHookId && !isDraftMode" class="flex flex-col mb-4 w-full p-4 !pr-0 !pb-0 items-center">
      <div v-if="hooks.length === 0" class="flex flex-col px-1.5 py-2.5 ml-1 text-gray-500">Empty</div>
      <div v-else class="flex flex-col pb-2 gap-y-1.5 mt-3 nc-scrollbar-md mb-2.5 w-full max-w-200">
        <div
          v-for="hook in hooks"
          :key="hook.id"
          class="flex flex-row mr-3 items-center hover:bg-gray-50 rounded-lg pl-3 pr-2 py-2 cursor-pointer group nc-view-sidebar-webhook-item text-gray-600"
          :class="{
            'bg-brand-50 !text-brand-500 hover:bg-brand-50': hook.id === selectedHookId,
          }"
        >
          <div class="flex flex-row items-center gap-x-2 flex-grow" @click="openEditor(hook.id!)">
            <div class="circle">
              <div
                class="dot"
                :class="{
                  'bg-green-500': hook?.active,
                  'bg-gray-400': !hook?.active,
                }"
              ></div>
            </div>

            <div class="text-inherit group-hover:text-black">
              {{ hook?.title }}
            </div>
          </div>
          <a-switch
            v-e="['c:actions:webhook']"
            size="small"
            :checked="hook.active"
            class="min-w-4 !mr-2"
            @change="toggleHook(hook)"
          />
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
              <GeneralIcon icon="threeDotVertical" class="ml-0.75 text-inherit" />
            </NcButton>
            <template #overlay>
              <div class="flex flex-col p-0">
                <NcButton type="text" class="!rounded-none">
                  <div class="flex items-center gap-x-1">
                    <GeneralIcon icon="copy" class="-ml-0.75" />
                    Duplicate
                  </div>
                </NcButton>
                <NcButton type="text" class="!rounded-none" @click="openDeleteModal(hook.id)">
                  <div class="flex items-center gap-x-1 !text-red-500">
                    <GeneralIcon icon="delete" />
                    Delete
                  </div>
                </NcButton>
              </div>
            </template>
          </NcDropdown>
        </div>
      </div>
    </div>
    <div v-else class="flex w-full pr-4 nc-scrollbar-md justify-center">
      <div class="flex flex-col mt-4 px-8 py-6 mb-4 border-1 rounded-2xl w-full" style="height: fit-content">
        <WebhookEditor :key="selectedHookId" :hook="selectedHook" @close="onEditorClose" @delete="showDeleteModal = true" />
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
  @apply !hover:text-gray-800 !text-gray-500 !underline-transparent !hover:underline  transition-all duration-150;
}
</style>
