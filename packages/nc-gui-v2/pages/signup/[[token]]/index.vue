<script lang="ts" setup>
import { extractSdkResponseErrorMsg, isEmail, navigateTo, reactive, ref, useGlobal, useI18n, useNuxtApp } from '#imports'

const { signIn } = useGlobal()

const { $api } = useNuxtApp()

const { t } = useI18n()

const formValidator = ref()
let error = $ref<string | null>(null)

const form = reactive({
  email: '',
  password: '',
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
  password: [
    // Password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
    { min: 8, message: t('msg.error.signUpRules.passwdLength') },
  ],
}

const signUp = async () => {
  const valid = formValidator.value.validate()

  if (!valid) return

  error = null

  try {
    const { token } = await $api.auth.signup(form)

    signIn(token!)

    await navigateTo('/')
  } catch (e: any) {
    error = await extractSdkResponseErrorMsg(e)
  }
}

const resetError = () => {
  if (error) error = null
}
</script>

<template>
  <a-form ref="formValidator" :model="form" layout="vertical" no-style @finish="signUp">
    <Transition name="layout">
      <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
        <div class="flex items-center gap-2 justify-center">
          <div class="w-[25px]">
            <MaterialSymbolsWarning />
          </div>
          <div class="break-words">{{ error }}</div>
        </div>
      </div>
    </Transition>

    <a-form-item :label="$t('labels.email')" name="email" :rules="formRules.email">
      <a-input v-model:value="form.email" size="large" :placeholder="$t('labels.email')" @focus="resetError" />
    </a-form-item>

    <a-form-item :label="$t('labels.password')" name="password" :rules="formRules.password">
      <a-input-password
        v-model:value="form.password"
        size="large"
        class="password"
        :placeholder="$t('labels.password')"
        @focus="resetError"
      />
    </a-form-item>

    <div class="self-center flex flex-col flex-wrap gap-4 items-center mt-4">
      <button class="submit" type="submit">
        <span class="flex items-center gap-2">
          <MaterialSymbolsRocketLaunchOutline />

          {{ $t('general.signUp') }}
        </span>
      </button>

      <div class="text-end prose-sm">
        {{ $t('msg.info.signUp.alreadyHaveAccount') }}

        <nuxt-link to="/signin">{{ $t('general.signIn') }}</nuxt-link>
      </div>
    </div>
  </a-form>
</template>
