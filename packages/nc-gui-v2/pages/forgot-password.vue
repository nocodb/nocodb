<script setup lang="ts">
import { definePageMeta, extractSdkResponseErrorMsg, isEmail, reactive, ref, useApi, useI18n } from '#imports'

const { api, isLoading } = useApi()

const { t } = useI18n()

definePageMeta({
  requiresAuth: false,
  title: 'title.resetPassword',
})

let error = $ref<string | null>(null)

let success = $ref(false)

const formValidator = ref()

const form = reactive({
  email: '',
})

const formRules = {
  email: [
    // E-mail is required
    { required: true, message: t('msg.error.signUpRules.emailReqd') },
    // E-mail must be valid format
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (isEmail(v)) return resolve(true)
          reject(new Error(t('msg.error.signUpRules.emailInvalid')))
        })
      },
      message: t('msg.error.signUpRules.emailInvalid'),
    },
  ],
}

async function resetPassword() {
  if (!formValidator.value.validate()) return

  resetError()

  try {
    await api.auth.passwordForgot(form)

    success = true
  } catch (e: any) {
    // todo: errors should not expose what was wrong (i.e. do not show "Password is wrong" messages)
    error = await extractSdkResponseErrorMsg(e)
  }
}

function resetError() {
  if (error) error = null
}
</script>

<template>
  <NuxtLayout>
    <a-form
      ref="formValidator"
      layout="vertical"
      :model="form"
      class="bg-primary/5 forgot-password h-full flex justify-center items-center nc-form-signin"
      @finish="resetPassword"
    >
      <div class="h-full w-full flex flex-col items-center justify-center pt-[50px]">
        <div
          class="color-transition bg-white dark:(!bg-gray-900 !text-white) relative flex flex-col justify-center gap-2 w-full max-w-[500px] mx-auto p-8 md:(rounded-lg border-1 border-gray-200 shadow-xl)"
        >
          <general-noco-icon
            class="color-transition hover:(ring ring-pink-500)"
            :class="[isLoading ? 'animated-bg-gradient' : '']"
          />

          <div class="self-center flex flex-col justify-center items-center text-center gap-2">
            <h1 class="prose-2xl font-bold my-4 w-full">{{ $t('title.resetPassword') }}</h1>

            <template v-if="!success">
              <div class="prose-sm">{{ $t('msg.info.passwordRecovery.message_1') }}</div>
              <div class="prose-sm mb-4">{{ $t('msg.info.passwordRecovery.message_2') }}</div>
            </template>

            <template v-else>
              <div class="prose-sm text-success flex items-center leading-8 gap-2">
                {{ $t('msg.info.passwordRecovery.success') }} <ClaritySuccessLine />
              </div>

              <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
            </template>
          </div>

          <Transition name="layout">
            <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 mx-auto p-1">
              <div class="flex items-center gap-2 justify-center">
                <MaterialSymbolsWarning />
                <div class="break-words">{{ error }}</div>
              </div>
            </div>
          </Transition>

          <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
            <a-input v-model:value="form.email" size="large" :placeholder="$t('labels.email')" @focus="resetError" />
          </a-form-item>

          <div class="self-center flex flex-col gap-4 items-center justify-center w-full">
            <button class="submit" type="submit">
              <span class="flex items-center gap-2"><MdiLogin /> {{ $t('activity.sendEmail') }}</span>
            </button>

            <div class="text-end prose-sm">
              {{ $t('msg.info.signUp.alreadyHaveAccount') }}
              <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
            </div>
          </div>
        </div>
      </div>
    </a-form>
  </NuxtLayout>
</template>

<style lang="scss">
.forgot-password {
  .ant-input-affix-wrapper,
  .ant-input {
    @apply dark:(bg-gray-700 !text-white) !appearance-none my-1 border-1 border-solid border-primary/50 rounded;
  }

  .submit {
    @apply z-1 relative color-transition border border-gray-300 rounded-md p-3 text-white;

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
