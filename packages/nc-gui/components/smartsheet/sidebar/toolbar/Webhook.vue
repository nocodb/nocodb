<script lang="ts" setup>
import type { HookType } from 'nocodb-sdk'
// const showWebhookDrawer = ref(false)

const { hooks } = storeToRefs(useWebhooksStore())
const { loadHooksList, deleteHook: _deleteHook, copyHook } = useWebhooksStore()

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

const showDeleteModal = ref(false)
const isDeleting = ref(false)
const isCopying = ref(false)
const showEditModal = ref(false)

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

  try {
    await _deleteHook(deleteHookId.value)
  } finally {
    isDeleting.value = false
    showDeleteModal.value = false
    deleteHookId.value = ''
  }
}

const openEditor = (hookId?: string | undefined) => {
  selectedHookId.value = hookId
  showEditModal.value = true
}

watch(showDeleteModal, () => {
  if (!showDeleteModal.value) return

  nextTick(() => {
    modalDeleteButtonRef.value?.$el?.focus()
  })
})

watch(showEditModal, () => {
  if (!showEditModal.value) {
    selectedHookId.value = undefined
  }
})

watch(
  () => activeTable.value?.id,
  () => {
    if (!activeTable.value?.id) return

    selectedHookId.value = undefined
    loadHooksList()
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col mt-2 pt-1 border-t-1 border-gray-50 px-2 nc-view-sidebar-webhook">
    <div
      v-e="['c:actions:webhook']"
      class="py-2 flex gap-2 items-center justify-between button text-gray-700"
      @click="openEditor()"
    >
      <div class="flex flex-row items-center gap-x-2 nc-view-sidebar-webhook-label">
        <component :is="iconMap.hook" class="text-gray-600" />
        {{ $t('objects.webhooks') }}
      </div>
      <div class="flex !rounded-md hover:(bg-gray-50 text-black) p-1 cursor-pointer">
        <component :is="iconMap.plus" class="text-primary-600 nc-view-sidebar-webhook-plus-icon" />
      </div>
    </div>
    <div v-if="hooks.length === 0" class="flex flex-col px-1.5 py-2.5 ml-6.5 text-gray-500">Empty</div>
    <div v-else class="flex flex-col ml-6">
      <div
        v-for="hook in hooks"
        :key="hook.id"
        class="flex flex-row items-center hover:bg-gray-50 rounded-md px-1.5 py-2.5 cursor-pointer group nc-view-sidebar-webhook-item"
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
          <div class="flex flex-col">
            <div class="text-gray-600 group-hover:text-black">
              {{ hook?.title }}
            </div>
            <div class="text-gray-400 text-xs select-none">Trigger {{ hook.event }} {{ hook.operation }}</div>
          </div>
        </div>
        <div class="flex">
          <a-dropdown placement="bottom" :trigger="['click']">
            <div
              class="nc-docs-sidebar-page-options px-0.5 hover:(!bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none"
              data-testid="nc-view-sidebar-webhook-context-menu"
              :class="{
                'hidden group-hover:block': !isOptionOpen,
              }"
            >
              <MdiDotsHorizontal />
            </div>
            <template #overlay>
              <div class="flex flex-col p-1 bg-white rounded-md w-28 gap-y-0.5 border-1 border-gray-100">
                <div
                  class="flex items-center cursor-pointer select-none px-2 py-1.5 text-xs gap-x-1.5 hover:bg-gray-50 rounded-md"
                  :class="{
                    'cursor-not-allowed': isCopying,
                  }"
                  data-testid="nc-view-sidebar-webhook-copy"
                  @click="copyWebhook(hook)"
                >
                  <GeneralLoader v-if="isCopying" class="!h-4.75" />
                  <MdiContentCopy v-else class="!h-4.75" />
                  <div class="flex">{{ isCopying ? 'Copying' : 'Copy' }}</div>
                </div>
                <div
                  class="flex items-center cursor-pointer select-none px-2 py-1.5 text-xs gap-x-1.5 hover:bg-gray-50 rounded-md !text-red-500"
                  data-testid="nc-view-sidebar-webhook-delete"
                  @click="openDeleteModal(hook.id!)"
                >
                  <MdiDeleteOutline class="!h-4.75" />
                  <div class="flex">Delete</div>
                </div>
              </div>
            </template>
          </a-dropdown>
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
  <GeneralModal v-model:visible="showEditModal" width="48rem" destroy-on-close>
    <div class="py-6">
      <div class="webhook-scroll px-5 nc-drawer-webhook-body">
        <!--
        <WebhookEditor :key="selectedHookId" :hook="selectedHook" @close="showEditModal = false" />
-->
      </div>
    </div>
  </GeneralModal>
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
</style>
