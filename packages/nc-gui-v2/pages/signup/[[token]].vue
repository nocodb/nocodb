<script setup lang="ts">
import { definePageMeta, useGlobal } from '#imports'

definePageMeta({
  requiresAuth: false,
})

const { appInfo, isLoading } = useGlobal()
</script>

<template>
  <NuxtLayout>
    <div class="signup h-full min-h-[600px] flex justify-center items-center nc-form-signup">
      <div
        class="bg-white dark:(!bg-gray-900 !text-white) relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
      >
        <general-noco-icon
          class="color-transition hover:(ring ring-pink-500)"
          :class="[isLoading ? 'animated-bg-gradient' : '']"
        />

        <h1 class="prose-2xl font-bold self-center my-4">
          {{ $t('general.signUp') }}
          {{ $route.query.redirect_to === '/referral' ? '& REFER' : '' }}
          {{ $route.query.redirect_to === '/pricing' ? '& BUY' : '' }}
        </h1>

        <h2 v-if="appInfo.firstUser" class="prose !text-primary font-semibold self-center my-4">
          {{ $t('msg.info.signUp.superAdmin') }}
        </h2>

        <NuxtPage />
      </div>
    </div>
  </NuxtLayout>
</template>

<style lang="scss">
.signup {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply dark:(bg-gray-700 !text-white) !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }

  .password {
    input {
      @apply !border-none;
    }

    .ant-input-password-icon {
      @apply dark:!text-white;
    }
  }

  .submit {
    @apply z-1 relative color-transition border border-gray-300 rounded-md p-3 bg-gray-100/50 text-white bg-primary;

    &::after {
      @apply rounded-md absolute top-0 left-0 right-0 bottom-0 transition-all duration-150 ease-in-out bg-primary;
      content: '';
      z-index: -1;
    }

    &:hover::after {
      @apply transform scale-110 ring ring-pink-500;
    }

    &:active::after {
      @apply ring ring-pink-500;
    }
  }
}
</style>
