<script lang="ts" setup>
import { useI18n } from 'vue-i18n'
import { extractSdkResponseErrorMsg } from '~/utils/errorUtils'
import { useNuxtApp } from '#app'
import MaterialSymbolsWarning from '~icons/material-symbols/warning'
import MaterialSymbolsRocketLaunchOutline from '~icons/material-symbols/rocket-launch-outline'
import { reactive, ref } from '#imports'

const { $api } = useNuxtApp()

const { t } = useI18n()

const formValidator = ref()
let error = $ref<string | null>(null)

const form = reactive({
  currentPassword: '',
  password: '',
  passwordRepeat: '',
})

const formRules = {
  currentPassword: [
    // Current password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
  ],
  password: [
    // Password is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
    { min: 8, message: t('msg.error.signUpRules.passwdLength') },
  ],
  passwordRepeat: [
    // PasswordRepeat is required
    { required: true, message: t('msg.error.signUpRules.passwdRequired') },
    // Passwords match
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (form.password === form.passwordRepeat) return resolve(true)
          reject(new Error(t('msg.error.signUpRules.passwdMismatch')))
        })
      },
      message: t('msg.error.signUpRules.passwdMismatch'),
    },
  ],
}

const passwordChange = async () => {
  const valid = formValidator.value.validate()
  if (!valid) return

  error = null
  try {
    const { msg } = await $api.auth.passwordChange(form)
    console.log(msg)
  } catch (e: any) {
    error = await extractSdkResponseErrorMsg(e)
  }
}

const resetError = () => {
  if (error) {
    error = null
  }
}
</script>

<template>
  <a-form ref="formValidator" layout="vertical" :model="form" class="change-password h-full w-full" @finish="passwordChange">
    <div class="md:relative flex flex-col gap-2 w-full h-full p-8 max-w-1/2">
      <h1 class="prose-2xl font-bold mb-4">{{ $t('activity.changePwd') }}</h1>

      <Transition name="layout">
        <div v-if="error" class="self-center mb-4 bg-red-500 text-white rounded-lg w-3/4 p-1">
          <div class="flex items-center gap-2 justify-center"><MaterialSymbolsWarning /> {{ error }}</div>
        </div>
      </Transition>

      <a-form-item :label="$t('placeholder.password.current')" name="currentPassword" :rules="formRules.password">
        <a-input-password
          v-model:value="form.password"
          size="large"
          class="password"
          :placeholder="$t('placeholder.password.current')"
          @focus="resetError"
        />
      </a-form-item>

      <a-form-item :label="$t('placeholder.password.new')" name="newPassword" :rules="formRules.password">
        <a-input-password
          v-model:value="form.password"
          size="large"
          class="password"
          :placeholder="$t('placeholder.password.new')"
          @focus="resetError"
        />
      </a-form-item>

      <a-form-item :label="$t('placeholder.password.confirm')" name="passwordRepeat" :rules="formRules.passwordRepeat">
        <a-input-password
          v-model:value="form.passwordRepeat"
          size="large"
          class="password"
          :placeholder="$t('placeholder.password.confirm')"
          @focus="resetError"
        />
      </a-form-item>

      <div class="flex flex-wrap gap-4 items-center mt-4 md:justify-between w-full">
        <button class="submit" type="submit">
          <span class="flex items-center gap-2"><MaterialSymbolsRocketLaunchOutline /> {{ $t('activity.changePwd') }}</span>
        </button>
      </div>
    </div>
  </a-form>
</template>

<style lang="scss">
.change-password {
  .submit {
    @apply ml-1 bordered border-gray-300 rounded-lg p-4 bg-gray-100/50 text-white bg-primary hover:bg-primary/75 dark:(!bg-secondary/75 hover:!bg-secondary/50);
  }
}
</style>
