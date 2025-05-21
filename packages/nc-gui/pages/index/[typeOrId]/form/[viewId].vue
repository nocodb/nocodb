<script setup lang="ts">
import type { VNodeRef } from '@vue/runtime-core'
import type { InputPassword } from 'ant-design-vue'
import { setI18nLanguage } from '~/plugins/a.i18n'

definePageMeta({
  public: true,
  pageType: 'shared-view',
})

useSidebar('nc-left-sidebar', { hasSidebar: false })

const route = useRoute()

const { loadSharedView, sharedView, sharedViewMeta, meta, notFound, password, passwordDlg, passwordError } =
  useProvideSharedFormStore(route.params.viewId as string)

await loadSharedView()

if (!notFound.value) {
  provide(ReloadViewDataHookInj, createEventHook())
  provide(MetaInj, meta)
  provide(IsPublicInj, ref(true))
  provide(IsFormInj, ref(true))

  useProvideSmartsheetStore(sharedView, meta, true)

  applyLanguageDirection(sharedViewMeta.value.rtl ? 'rtl' : 'ltr')

  if (sharedViewMeta.value.language) {
    setI18nLanguage(sharedViewMeta.value.language)
  }
}

const form = reactive({
  password: '',
})

watch(
  () => form.password,
  () => {
    password.value = form.password
  },
)

const focus: VNodeRef = (el: typeof InputPassword) => {
  return el && el?.focus?.()
}
</script>

<template>
  <div>
    <NuxtLayout>
      <NuxtPage v-if="!passwordDlg && !notFound" />

      <GeneralPageDoesNotExist v-if="notFound" />

      <a-modal
        v-model:visible="passwordDlg"
        :class="{ active: passwordDlg }"
        :closable="false"
        width="min(100%, 450px)"
        centered
        :footer="null"
        :mask-closable="false"
        wrap-class-name="nc-modal-shared-form-password-dlg"
        :mask-style="{
          backgroundColor: 'rgba(255, 255, 255, 0.64)',
          backdropFilter: 'blur(8px)',
        }"
        @close="passwordDlg = false"
      >
        <div class="flex flex-col gap-5">
          <div class="flex flex-row items-center gap-x-2 text-base font-weight-700 text-gray-800">
            <GeneralIcon icon="ncKey" class="!text-base w-5 h-5" />
            {{ $t('msg.thisSharedViewIsProtected') }}
          </div>

          <a-form :model="form" @finish="loadSharedView">
            <a-form-item
              name="password"
              :rules="[{ required: true, message: $t('msg.error.signUpRules.passwdRequired') }]"
              class="!mb-0"
            >
              <a-input-password
                :ref="focus"
                v-model:value="form.password"
                class="!rounded-lg !text-small"
                hide-details
                :placeholder="$t('msg.enterPassword')"
              />
              <Transition name="layout">
                <div v-if="passwordError" class="mb-2 text-sm text-red-500">{{ passwordError }}</div>
              </Transition>
            </a-form-item>
          </a-form>
          <div class="flex flex-row justify-end gap-x-2">
            <NcButton
              :disabled="!form.password"
              type="primary"
              size="small"
              html-type="submit"
              class="!px-2"
              data-testid="nc-shared-view-password-submit-btn"
              @click="loadSharedView"
              >{{ $t('objects.view') }}
              <template #loading> {{ $t('msg.verifyingPassword') }}</template>
            </NcButton>
          </div>
        </div>
      </a-modal>

      <img v-if="passwordDlg" alt="view image" src="~/assets/img/views/form.png" class="fixed inset-0 w-full h-full" />
    </NuxtLayout>
  </div>
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
