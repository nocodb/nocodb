<script setup lang="ts">
import { validatePassword } from 'nocodb-sdk'

definePageMeta({
  requiresAuth: false,
  // the emailed link must reach the form even when this browser is already signed in
  public: true,
})

const { api, isLoading, error } = useApi()

const { t } = useI18n()

const { $e } = useNuxtApp()

const route = useRoute()

const form = reactive({
  password: '',
  newPassword: '',
})

const formValidator = ref()

const isTokenInvalid = ref(false)

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
    $e('a:auth:password-reset:save')
    message.success(t('labels.auth.passwordResetDone'))
    navigateTo('/signin')
  } catch (e: any) {
    $e('a:auth:password-reset:error', { step: 'save' })
    message.error(await extractSdkResponseErrorMsg(e))
  }
}

function resetError() {
  if (error.value) error.value = null
}

onMounted(async () => {
  try {
    await api.auth.passwordResetTokenValidate(route.params.id as string)
  } catch {
    isTokenInvalid.value = true
  }
})
</script>

<template>
  <NuxtLayout>
    <AuthShell class="forgot-password" :title="$t('labels.auth.resetTitle')" :loading="isLoading">
      <AuthFormError v-if="isTokenInvalid" :message="$t('labels.auth.resetLinkInvalid')" data-testid="nc-reset-link-invalid" />

      <a-form v-else ref="formValidator" layout="vertical" :model="form" no-style @finish="resetPassword">
        <a-form-item
          :label="$t('placeholder.password.new')"
          name="password"
          :rules="[{ required: true, message: $t('msg.error.signUpRules.passwdRequired') }]"
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
          :rules="[{ required: true, message: $t('msg.error.signUpRules.passwdRequired') }]"
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
        <nuxt-link v-if="isTokenInvalid" to="/forgot-password" class="nc-auth-link">{{
          $t('labels.auth.sendResetLink')
        }}</nuxt-link>
        <nuxt-link v-else to="/signin" class="nc-auth-link">{{ $t('labels.auth.backToSignIn') }}</nuxt-link>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>
