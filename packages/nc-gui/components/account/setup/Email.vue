<script setup lang="ts">

const { emailApps } = useAccountSetupStoreOrThrow()
</script>

<template>
  <div class="w-full">
    <div class="p-4 flex flex-wrap w-full gap-5 mx-auto my-2">
      <div v-for="(app) in emailApps" :key="app.title" class="w-296px max-w-296px flex gap-6 border-1 border-gray-100 py-3 px-6 rounded items-center">
        <img
            v-if="app.title !== 'SMTP'"
            class="max-w-32px max-h-32px"
            alt="logo"
            :style="{
            backgroundColor: app.title === 'SES' ? '#242f3e' : '',
          }"
            :src="app.logo"
        />
        <GeneralIcon v-else icon="mail" />
        <span class="font-weight-bold">{{ app.title }}</span>
      </div>
      <!--
            <a-card
              v-for="(app, i) in emailApps"
              :key="i"
              class="sm:w-100 md:w-130"
              :class="`relative flex overflow-x-hidden app-item-card !shadow-sm rounded-md w-full nc-app-store-card-${app.title}`"
            >
              <div class="install-btn flex flex-row justify-end space-x-1">
                <a-button v-if="app.parsedInput" size="small" type="primary" @click="showInstallPluginModal(app)">
                  <div class="flex flex-row justify-center items-center caption capitalize nc-app-store-card-edit">
                    <IcRoundEdit class="pr-0.5" :height="12" />
                    {{ $t('general.edit') }}
                  </div>
                </a-button>

                <a-button v-if="app.parsedInput" size="small" outlined @click="showResetPluginModal(app)">
                  <div class="flex flex-row justify-center items-center caption capitalize nc-app-store-card-reset">
                    <component :is="iconMap.closeCircle" />
                    <div class="flex ml-0.5">{{ $t('general.reset') }}</div>
                  </div>
                </a-button>

                <a-button v-else size="small" type="primary" @click="showInstallPluginModal(app)">
                  <div class="flex flex-row justify-center items-center caption capitalize nc-app-store-card-install">
                    <component :is="iconMap.plus" />
                    {{ $t('general.install') }}
                  </div>
                </a-button>
              </div>

              <div class="flex flex-row space-x-2 items-center justify-start w-full">
                <div class="flex w-[68px]">
                  <img
                    v-if="app.title !== 'SMTP'"
                    class="avatar"
                    alt="logo"
                    :style="{
                      backgroundColor: app.title === 'SES' ? '#242f3e' : '',
                    }"
                    :src="app.logo"
                  />

                  <div v-else />
                </div>

                <div class="flex flex-col flex-1 w-3/5 pl-3">
                  <a-typography-title :level="5">{{ app.title }}</a-typography-title>

                  {{ app.description }}
                </div>
              </div>
            </a-card>-->
    </div>
  </div>
</template>

<style scoped lang="scss">
.app-item-card {
  position: relative;
  transition: 0.4s background-color;

  .install-btn {
    position: absolute;
    opacity: 1;
    right: -100%;
    top: 10px;
    transition: 0.4s opacity, 0.4s right;
  }

  &:hover .install-btn {
    right: 10px;
    opacity: 1;
  }
}

.app-item-card {
  transition: 0.4s background-color, 0.4s transform;

  &:hover {
    background: rgba(123, 126, 136, 0.1) !important;
  }
}

.caption {
  font-size: 0.7rem;
}

.avatar {
  width: 5rem;
  height: 5rem;
  padding: 0.25rem;
  object-fit: contain;
}
</style>
