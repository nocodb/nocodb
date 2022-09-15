<script setup lang="ts">
import { useSharedFormStoreOrThrow } from '#imports'

const { passwordDlg, password, loadSharedView } = useSharedFormStoreOrThrow()
</script>

<template>
  <div class="nc-form-view md:bg-primary bg-opacity-5 min-h-full flex flex-col nc-form-signin py-15">
    <NuxtPage />

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
  </div>
</template>

<style lang="scss">
.nc-form-view {
  .nc-input {
    @apply w-full rounded p-2 min-h-[40px] flex items-center border-solid border-1 border-primary;
  }

  .submit {
    @apply z-1 relative color-transition rounded p-3 text-white shadow-sm;

    &::after {
      @apply rounded absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary;
      content: '';
      z-index: -1;
    }

    &:hover::after {
      @apply transform scale-110 ring ring-accent;
    }

    &:active::after {
      @apply ring ring-accent;
    }
  }
}
</style>
