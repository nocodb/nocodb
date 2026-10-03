<script setup lang="ts">
import { validatePassword } from 'nocodb-sdk'

definePageMeta({
  requiresAuth: false,
})

const { api, isLoading, error } = useApi()

const { t } = useI18n()

const route = useRoute()

const form = reactive({
  password: '',
  newPassword: '',
})

const formValidator = ref()

async function resetPassword() {
  if (form.newPassword !== form.password) {
    error.value = 'password does not match'
    return
  }
  const { error: mesg, valid } = validatePassword(form.password)

  if (!valid) {
    error.value = mesg.includes('8') ? 'password should be atleast 8 characters' : mesg
    return
  }

  resetError()

  try {
    await api.auth.passwordReset(route.params.id as string, {
      password: form.password,
    })
    navigateTo('/signin')
  } catch (e: any) {
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function resetError() {
  if (error.value) error.value = null
}
</script>

<template>
  <NuxtLayout>
    <AuthShell class="forgot-password" :title="$t('labels.auth.resetTitle')" :loading="isLoading">
      <a-form ref="formValidator" layout="vertical" :model="form" no-style @finish="resetPassword">
        <a-form-item
          :label="$t('placeholder.password.new')"
          name="password"
          :rules="[{ required: true, message: t('msg.error.signUpRules.passwdRequired') }]"
        >
          <a-input-password
            v-model:value="form.password"
            autocomplete="new-password"
            :placeholder="$t('placeholder.password.new')"
            class="password"
            @focus="resetError"
          />
        </a-form-item>

        <a-form-item
          :label="$t('placeholder.password.confirm')"
          name="newPassword"
          :rules="[{ required: true, message: t('msg.error.signUpRules.passwdRequired') }]"
        >
          <a-input-password
            v-model:value="form.newPassword"
            autocomplete="new-password"
            class="password"
            :placeholder="$t('placeholder.password.confirm')"
            @focus="resetError"
          />
        </a-form-item>

        <AuthSubmitButton html-type="submit" :error="error" :loading="isLoading">
          {{ $t('labels.auth.resetPassword') }}
        </AuthSubmitButton>
      </a-form>

      <template #footer>
        <nuxt-link to="/signin" class="nc-auth-link">{{ $t('labels.auth.backToSignIn') }}</nuxt-link>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>
