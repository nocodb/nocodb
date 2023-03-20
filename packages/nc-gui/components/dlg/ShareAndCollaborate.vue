<script lang="ts" setup>
import { LoadingOutlined } from '@ant-design/icons-vue'
import Collaborate from './share-and-collaborate/Collaborate.vue'
import ManageUsers from './share-and-collaborate/ManageUsers.vue'
import Share from './share-and-collaborate/Share.vue'

interface Props {
  modelValue: boolean
}

interface Emits {
  (event: 'update:modelValue', value: boolean): void
}

const { ...props } = defineProps<Props>()

const emits = defineEmits<Emits>()

const { formStatus } = useManageUsers()

const vModel = useVModel(props, 'modelValue', emits)

const { openedPage } = storeToRefs(useDocStore())

const indicator = h(LoadingOutlined, {
  style: {
    fontSize: '24px',
  },
  spin: true,
})

watch(vModel, (val) => {
  if (!val) {
    setTimeout(() => {
      formStatus.value = 'collaborate'
    }, 500)
  }
})

watch(formStatus, (val) => {
  if (val === 'collaborateSaved') {
    setTimeout(() => {
      vModel.value = false
    }, 1500)
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
    :mask-closable="formStatus === 'collaborateSaving' ? false : true"
    :ok-button-props="{ hidden: true } as any"
    :cancel-button-props="{ hidden: true } as any"
    :footer="null"
    :centered="true"
    :width="formStatus === 'manageCollaborators' ? '60rem' : '40rem'"
  >
    <div v-if="formStatus === 'collaborateSaving'" class="flex flex-row w-full px-5 justify-between items-center py-0.5">
      <div class="flex text-base" :style="{ fontWeight: 500 }">Adding Collaborators</div>
      <a-spin :indicator="indicator" />
    </div>
    <div v-else-if="formStatus === 'collaborateSaved'" class="flex flex-row w-full px-5 justify-between items-center py-0.5">
      <div class="flex text-base" :style="{ fontWeight: 500 }">Collaborators added</div>
      <div class="flex"><MdiCheck /></div>
    </div>
    <div v-else class="flex flex-col">
      <div
        class="flex flex-row justify-between items-center pb-1.5 mx-4"
        :class="{ 'border-b-1 border-gray-100': formStatus === 'manageCollaborators' }"
      >
        <div class="flex text-lg py-1" style="font-weight: 500">
          <template v-if="formStatus === 'manageCollaborators'"> Manage Collaborators </template>
          <template v-if="formStatus === 'collaborate' || formStatus === 'share'"> Share </template>
        </div>
      </div>
      <ManageUsers v-if="formStatus === 'manageCollaborators'" @close="formStatus = 'collaborate'" />
      <div v-else class="flex flex-col mx-4">
        <a-tabs v-model:activeKey="formStatus">
          <a-tab-pane key="collaborate">
            <template #tab>
              <div class="flex flex-row items-center text-xs px-2">
                <MdiAccountPlusOutline class="mr-1" />
                <div>Add Collaborators</div>
              </div>
            </template>
            <Collaborate />
          </a-tab-pane>
          <a-tab-pane v-if="openedPage" key="share">
            <template #tab>
              <div class="flex flex-row items-center text-xs px-2">
                <MdiEarth class="mr-1" />
                <div>Share Public Viewing</div>
              </div>
            </template>
            <Share @close="vModel = false" />
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
    @apply !py-2.5 !px-1;
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
