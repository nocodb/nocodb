<script lang="ts" setup>
import Collaborate from './share-and-collaborate/Collaborate.vue'
import ManageUsers from './share-and-collaborate/ManageUsers.vue'

interface Props {
  modelValue: boolean
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
}

const { ...props } = defineProps<Props>()

const emits = defineEmits<Emits>()

useManageUsers()

const vModel = useVModel(props, 'modelValue', emits)

const showManageCollaborators = ref(false)
const tabKey = ref('collaborate')

const openManageCollaborators = () => {
  showManageCollaborators.value = true
}

watch(vModel, (val) => {
  if (!val) {
    showManageCollaborators.value = false
    tabKey.value = 'collaborate'
  }
})
</script>

<template>
  <a-modal
    v-model:visible="vModel"
    class="!top-[35%]"
    :class="{ active: vModel }"
    wrap-class-name="nc-modal-share-collaborate"
    :closable="false"
    :ok-button-props="{ hidden: true }"
    :cancel-button-props="{ hidden: true }"
    :footer="null"
    :centered="true"
    :width="showManageCollaborators ? '60rem' : '40rem'"
  >
    <div class="flex flex-col">
      <div
        class="flex flex-row justify-between items-center pb-1.5 mx-4"
        :class="{ 'border-b-1 border-gray-100': showManageCollaborators }"
      >
        <div class="flex text-md py-1" style="font-weight: 500">
          <template v-if="showManageCollaborators"> Manage Collaborators </template>
          <template v-if="tabKey === 'collaborate'"> Share </template>
        </div>
        <div class="flex hover:bg-gray-50 p-1 rounded-md cursor-pointer" @click="vModel = false">
          <MdiClose class="my-auto" />
        </div>
      </div>
      <ManageUsers v-if="showManageCollaborators" @close="showManageCollaborators = false" />
      <div v-else class="flex flex-col mx-4">
        <a-tabs v-model:activeKey="tabKey">
          <a-tab-pane key="collaborate">
            <template #tab>
              <div class="flex flex-row items-center text-xs px-2">
                <MdiAccountPlusOutline class="mr-1" />
                <div>Add Collaborators</div>
              </div>
            </template>
            <Collaborate :open-manage-collaborators="openManageCollaborators" />
          </a-tab-pane>
          <a-tab-pane key="public">
            <template #tab>
              <div class="flex flex-row items-center text-xs px-2">
                <MdiEarth class="mr-1" />
                <div>Share Public Viewing</div>
              </div>
            </template>
          </a-tab-pane>
        </a-tabs>
      </div>
    </div>
  </a-modal>
</template>

<style lang="scss">
.nc-modal-share-collaborate {
  .ant-modal-content {
    @apply !rounded-lg;
  }
  .ant-modal-body {
    @apply !py-2.5 !px-0;
  }
  .ant-select-selector {
    @apply !rounded-md !border-gray-200 !border-1;
  }
  .ant-form-item {
    @apply !my-0;
  }
  .ant-form-item-explain {
    @apply !ml-3;
  }
  .ant-select {
    @apply !bg-gray-100 !p-0.5;
  }
  .ant-select-selector {
    @apply !bg-gray-100;
  }
}
</style>
