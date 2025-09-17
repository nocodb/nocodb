<script setup lang="ts">
const authClientStore = useOAuthClients()

const { loadOAuthClients } = authClientStore

const { oauthClients, isOauthClientsLoading } = storeToRefs(authClientStore)

const modalVisible = ref(false)

const addNewClient = () => {
  modalVisible.value = true
}

onMounted(async () => {
  await loadOAuthClients()
})
</script>

<template>
  <div class="flex flex-col">
    <NcPageHeader>
      <template #icon>
        <GeneralIcon icon="ncLock" class="flex-none h-5 w-5" />
      </template>
      <template #title>
        <span data-rec="true">
          {{ $t('title.oauthClients') }}
        </span>
      </template>
    </NcPageHeader>
    <div class="nc-content-max-w p-6 h-[calc(100vh_-_100px)] flex flex-col gap-6 overflow-auto nc-scrollbar-thin">
      <div class="max-w-202 mx-auto h-full w-full" data-testid="nc-token-list">
        <div class="flex gap-4 items-baseline justify-between">
          <h6 class="text-xl text-left font-bold my-0" data-rec="true">{{ $t('title.oauthClients') }}</h6>
          <NcButton
            :disabled="isOauthClientsLoading"
            data-testid="nc-token-create-top"
            size="small"
            type="primary"
            @click="addNewClient"
          >
            <span class="hidden md:block" data-rec="true">
              {{ $t('labels.addNewClient') }}
            </span>
            <span class="flex items-center justify-center md:hidden" data-rec="true">
              <component :is="iconMap.plus" />
            </span>
          </NcButton>
        </div>
      </div>
    </div>

    <AccountOAuthModal v-model:visible="modalVisible" />
  </div>
</template>

<style scoped lang="scss"></style>
