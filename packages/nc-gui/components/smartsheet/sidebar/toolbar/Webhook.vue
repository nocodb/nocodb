<script lang="ts" setup>
import type { HookType } from 'nocodb-sdk'
const showWebhookDrawer = ref(false)

const { hooks } = storeToRefs(useWebhooksStore())
const { loadHooksList, deleteHook: _deleteHook, copyHook } = useWebhooksStore()

const modalDeleteButtonRef = ref(null)

const { activeTable } = storeToRefs(useTablesStore())

const eventList = ref<Record<string, any>[]>([
  { text: ['After', 'Insert'], value: ['after', 'insert'] },
  { text: ['After', 'Update'], value: ['after', 'update'] },
  { text: ['After', 'Delete'], value: ['after', 'delete'] },
  { text: ['After', 'Bulk Insert'], value: ['after', 'bulkInsert'] },
  { text: ['After', 'Bulk Update'], value: ['after', 'bulkUpdate'] },
  { text: ['After', 'Bulk Delete'], value: ['after', 'bulkDelete'] },
])

const deleteHookId = ref('')
const selectedHookId = ref<string | undefined>(undefined)
const selectedHook = computed(() => {
  if (!selectedHookId.value) return undefined

  return hooks.value.find((hook) => hook.id === selectedHookId.value)
})

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

const hideDeleteModal = () => {
  showDeleteModal.value = false
  deleteHookId.value = ''
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

const openEditor = (hookId: string | undefined) => {
  selectedHookId.value = hookId
  showEditModal.value = true
}

watch(showDeleteModal, () => {
  if (!showDeleteModal.value) return

  nextTick(() => {
    modalDeleteButtonRef.value?.$el?.focus()
  })
})

watch(
  () => activeTable.value?.id,
  () => {
    console.log('active table changed', activeTable.value?.id)
    selectedHookId.value = undefined
    loadHooksList()
  },
  {
    immediate: true,
  },
)
</script>

<template>
  <div class="flex flex-col mt-2 pt-1 border-t-1 border-gray-50 px-2">
    <div v-e="['c:actions:webhook']" class="py-2 flex gap-2 items-center justify-between text-gray-700" @click="openEditor()">
      <div class="flex flex-row items-center gap-x-2">
        <component :is="iconMap.hook" class="text-gray-600" />
        {{ $t('objects.webhooks') }}
      </div>
      <div class="flex !rounded-md hover:(bg-gray-50 text-black) p-1 cursor-pointer">
        <component :is="iconMap.plus" class="text-primary-600" />
      </div>
    </div>
    <div v-if="hooks.length === 0" class="flex flex-col ml-6.5 text-gray-500">Empty</div>
    <div v-else class="flex flex-col ml-6">
      <div
        v-for="hook in hooks"
        :key="hook.id"
        class="flex flex-row items-center hover:bg-gray-50 rounded-md px-1.5 py-2.5 cursor-pointer group"
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
          <a-dropdown placement="bottom" trigger="click">
            <div
              class="nc-docs-sidebar-page-options px-0.5 hover:(!bg-gray-300 !bg-opacity-30 rounded-md) cursor-pointer select-none"
              data-testid="docs-sidebar-page-options"
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
                  data-testid="docs-sidebar-page-delete"
                  @click="copyWebhook(hook)"
                >
                  <GeneralLoader v-if="isCopying" class="!h-4.75" />
                  <MdiContentCopy v-else class="!h-4.75" />
                  <div class="flex">{{ isCopying ? 'Copying' : 'Copy' }}</div>
                </div>
                <div
                  class="flex items-center cursor-pointer select-none px-2 py-1.5 text-xs gap-x-1.5 hover:bg-gray-50 rounded-md !text-red-500"
                  data-testid="docs-sidebar-page-delete"
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
  <GeneralModal v-model:visible="showDeleteModal" width="24rem">
    <div class="flex flex-col px-6 py-5 gap-y-6">
      <div>Are you sure you want to delete this webhook?</div>
      <div class="flex flex-row justify-end gap-x-1">
        <a-button type="text" class="!rounded" @click="hideDeleteModal">Cancel</a-button>
        <a-button ref="modalDeleteButtonRef" type="danger" class="!rounded" @click="deleteHook">Delete</a-button>
      </div>
    </div>
  </GeneralModal>
  <GeneralModal v-model:visible="showEditModal" width="48rem">
    <div class="py-6">
      <div class="webhook-scroll px-5">
        <WebhookEditor :key="selectedHook?.id" :hook="selectedHook" @close="showEditModal = false" />
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
