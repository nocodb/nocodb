<script setup lang="ts">
import {
  IsFormInj,
  IsPublicInj,
  MetaInj,
  ReloadViewDataHookInj,
  createEventHook,
  definePageMeta,
  provide,
  ref,
  useProvideSharedFormStore,
  useProvideSmartsheetStore,
  useRoute,
  useSidebar,
} from '#imports'

definePageMeta({
  public: true,
})

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const { loadSharedView, sharedView, meta, notFound, password, passwordDlg } = useProvideSharedFormStore(
  route.params.viewId as string,
)

await loadSharedView()

if (!notFound.value) {
  provide(ReloadViewDataHookInj, createEventHook())
  provide(MetaInj, meta)
  provide(IsPublicInj, ref(true))
  provide(IsFormInj, ref(true))

  useProvideSmartsheetStore(sharedView, meta, true)
}
</script>

<template>
  <NuxtLayout>
    <NuxtPage v-if="!passwordDlg" />

    <a-modal
      v-model:visible="passwordDlg"
      :closable="false"
      width="28rem"
      centered
      :footer="null"
      :mask-closable="false"
      wrap-class-name="nc-modal-shared-form-password-dlg"
      @close="passwordDlg = false"
    >
      <div class="w-full flex flex-col">
        <a-typography-title :level="4">This shared view is protected</a-typography-title>

        <a-form ref="formRef" :model="{ password }" class="mt-2" @finish="loadSharedView">
          <a-form-item name="password" :rules="[{ required: true, message: $t('msg.error.signUpRules.passwdRequired') }]">
            <a-input-password v-model:value="password" :placeholder="$t('msg.info.signUp.enterPassword')" />
          </a-form-item>

          <!-- Unlock -->
          <a-button type="primary" html-type="submit">{{ $t('general.unlock') }}</a-button>
        </a-form>
      </div>
    </a-modal>
  </NuxtLayout>
</template>

<style lang="scss" scoped>
:deep(.nc-cell-attachment) {
  @apply p-0;

  .nc-attachment-cell {
    @apply px-4 min-h-[75px] w-full h-full;

    .nc-attachment {
      @apply md:(w-[50px] h-[50px]) lg:(w-[75px] h-[75px]) min-h-[50px] min-w-[50px];
    }

    .nc-attachment-cell-dropzone {
      @apply rounded bg-gray-400/75;
    }
  }
}
</style>
