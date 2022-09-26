<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'
import { definePageMeta, navigateTo, reactive, ref, useApi, useGlobal, useI18n, useSidebar, validateEmail } from '#imports'

definePageMeta({
  requiresAuth: false,
  title: 'title.headLogin',
})

const { signIn: _signIn } = useGlobal()

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

useSidebar('nc-left-sidebar', { hasSidebar: false })

const formValidator = ref()

const form = reactive({
  email: '',
  password: '',
})

const formRules: Record<string, RuleObject[]> = {
  email: [
    // E-mail is required
    { required: true, message: t('msg.error.signUpRules.emailReqd') },
    // E-mail must be valid format
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (validateEmail(v)) return resolve()

          reject(new Error(t('msg.error.signUpRules.emailInvalid')))
        })
      },
      message: t('msg.error.signUpRules.emailInvalid'),
    },
  ],
  password: [
    // Password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
  ],
}

async function signIn() {
  if (!formValidator.value.validate()) return

  resetError()

  api.auth.signin(form).then(async ({ token }) => {
    _signIn(token!)

    await navigateTo('/')
  })
}

function resetError() {
  if (error.value) error.value = null
}
</script>

<template>
  <NuxtLayout>
    <div class="md:bg-primary bg-opacity-5 signin h-full min-h-[600px] flex flex-col justify-center items-center nc-form-signin">
      <div
        class="bg-white mt-[60px] relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
      >
        <LazyGeneralNocoIcon
          class="color-transition hover:(ring ring-accent)"
          :class="[isLoading ? 'animated-bg-gradient' : '']"
        />

        <h1 class="prose-2xl font-bold self-center my-4">{{ $t('general.signIn') }}</h1>

        <a-form ref="formValidator" :model="form" layout="vertical" no-style @finish="signIn">
          <Transition name="layout">
            <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1">
              <div class="flex items-center gap-2 justify-center">
                <MaterialSymbolsWarning />
                <div class="break-words">{{ error }}</div>
              </div>
            </div>
          </Transition>

          <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
            <a-input v-model:value="form.email" size="large" :placeholder="$t('msg.info.signUp.workEmail')" @focus="resetError" />
          </a-form-item>

          <a-form-item :label="$t('labels.password')" name="password" :rules="formRules.password">
            <a-input-password
              v-model:value="form.password"
              size="large"
              class="password"
              :placeholder="$t('msg.info.signUp.enterPassword')"
              @focus="resetError"
            />
          </a-form-item>

          <div class="hidden md:block text-right">
            <nuxt-link class="prose-sm" to="/forgot-password">
              {{ $t('msg.info.signUp.forgotPassword') }}
            </nuxt-link>
          </div>

          <div class="self-center flex flex-col flex-wrap gap-4 items-center mt-4 justify-center">
            <button class="submit group" type="submit">
              <span class="flex items-center gap-2">
                <MdiLogin />
                {{ $t('general.signIn') }}
              </span>
            </button>

            <div class="text-end prose-sm">
              {{ $t('msg.info.signUp.dontHaveAccount') }}
              <nuxt-link to="/signup">{{ $t('general.signUp') }}</nuxt-link>
            </div>

            <div class="md:hidden">
              <nuxt-link class="prose-sm" to="/forgot-password">
                {{ $t('msg.info.signUp.forgotPassword') }}
              </nuxt-link>
            </div>
          </div>
        </a-form>
      </div>
    </div>
  </NuxtLayout>
</template>

<style lang="scss">
.signin {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }

  .password {
    input {
      @apply !border-none !m-0;
    }
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
