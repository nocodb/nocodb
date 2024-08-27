<script setup lang="ts">
const props = defineProps<{
  category: string
  modelValue?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const vOpen = useVModel(props, 'modelValue', emit)

const selectedApp = ref<string | null>(null)

const { categorizeApps, confirmModalDlg } = useAccountSetupStoreOrThrow()

const selectApp = (app: any) => {
  selectedApp.value = app
  confirmModalDlg.value = true
}
</script>

<template>
  <NcModal
    :visible="vOpen"
    :keyboard="isModalClosable"
    centered
    width="70rem"
    wrap-class-name="nc-modal-create-source"
    @keydown.esc="vOpen = false"
  >
    <div class="flex-1 flex flex-col max-h-full min-h-400px">
      <div class="px-4 py-3 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="flex-1 text-base font-weight-700">Setup {{ category }}</div>
      </div>
      <div class="h-[calc(100%_-_58px)] flex">
        <div class="w-full">
          <div class="container">
            <div v-for="app in categorizeApps[category] || []" :key="app.title" class="item" @click="selectApp(app)">
              <img
                v-if="app.title !== 'SMTP'"
                class="icon"
                :alt="app.title"
                :style="{
                  backgroundColor: app.title === 'SES' ? '#242f3e' : '',
                }"
                :src="app.logo"
              />
              <GeneralIcon v-else icon="mail" />
              <span class="title">{{ app.title }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <AccountSetupConfigModal v-if="selectedApp" :id="selectedApp.id" v-model="confirmModalDlg" />
  </NcModal>
</template>

<style scoped lang="scss">
.container {
  @apply p-4 flex flex-wrap w-full gap-5 mx-auto my-2 justify-center;

  .item {
    @apply w-296px max-w-296px flex gap-6 border-1 border-gray-100 py-3 px-6 rounded items-center cursor-pointer hover:(shadow bg-gray-50);

    .icon {
      @apply max-w-32px max-h-32px;
    }

    .title {
      @apply font-weight-bold;
    }
  }
}
</style>
