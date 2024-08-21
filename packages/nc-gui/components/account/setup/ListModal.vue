<script setup lang="ts">

const props = defineProps<{
  category: string
  modelValue?: boolean
}>()

const emit = defineEmits(['update:modelValue'])

const vOpen = useVModel(props, 'modelValue', emit)

const selectedApp = ref<string | null>(null)

const { categorizeApps, configModalDlg } = useAccountSetupStoreOrThrow()

const selectApp = (app: any) => {
  selectedApp.value = app
  configModalDlg.value = true
}
</script>

<template>
  <NcModal :visible="vOpen" centered width="70rem" wrap-class-name="nc-modal-create-source">
    <div class="flex-1 flex flex-col max-h-full min-h-400px overflow-auto">
      <div class="px-4 pb-4 w-full flex items-center gap-3 border-b-1 border-gray-200">
        <div class="flex-1 text-base font-weight-700">Setup {{ category }}</div>
        <div class="flex-grow" />
        <GeneralIcon icon="close" class="cursor-pointer" @click="vOpen = false" />
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
              <div class="flex-grow" />
              <GeneralIcon icon="circleCheckSolid" v-if="app.active" class="text-primary min-w-6 h-6 bg-white-500" />
            </div>
          </div>
        </div>
      </div>
    </div>

    <AccountSetupConfigModal v-if="selectedApp && configModalDlg" :id="selectedApp.id" v-model="configModalDlg" />
  </NcModal>
</template>

<style scoped lang="scss">
.container {
  @apply p-4 w-950px gap-5 mx-auto my-2 grid grid-cols-3;

  .item {
    @apply text-base w-296px max-w-296px flex gap-6 border-1 border-gray-100 py-3 px-6 rounded items-center cursor-pointer hover:(shadow bg-gray-50);

    .icon {
      @apply max-w-32px max-h-32px;
    }

    .title {
      @apply font-weight-bold;
    }
  }
}
</style>
