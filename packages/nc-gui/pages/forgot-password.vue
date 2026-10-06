<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'

definePageMeta({
  requiresAuth: false,
})

const route = useRoute()

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

const { $e } = useNuxtApp()

const success = ref(false)

const formValidator = ref()

const form = reactive({
  email: '',
})

const formRules = {
  email: [
    // E-mail is required
    { required: true, message: t('msg.error.signUpRules.emailRequired') },
    // E-mail must be valid format
    {
      validator: (_: unknown, v: string) => {
        return new Promise((resolve, reject) => {
          if (!v?.length || validateEmail(v)) return resolve()

          reject(new Error(t('msg.error.signUpRules.emailInvalid')))
        })
      },
      message: t('msg.error.signUpRules.emailInvalid'),
    },
  ] as RuleObject[],
}

async function resetPassword() {
  if (!formValidator.value.validate()) return

  resetError()

  try {
    await api.auth.passwordForgot(form).then(() => {
      success.value = true
      $e('a:auth:password-reset:send')
    })
  } catch {
    // error value is set by useApi and displayed in the UI
    $e('a:auth:password-reset:error', { step: 'send' })
  }
}

function resetError() {
  if (error.value) error.value = null
}
</script>

<template>
  <NuxtLayout>
    <AuthShell
      v-if="success"
      class="forgot-password"
      :title="$t('labels.auth.checkEmailTitle')"
      :subtitle="$t('labels.auth.checkEmailSubtitle', { email: form.email })"
    >
      <template #footer>
        <NuxtLink class="nc-auth-link" :to="{ path: '/signin', query: route.query }">{{
          $t('labels.auth.backToSignIn')
        }}</NuxtLink>
      </template>
    </AuthShell>

    <AuthShell
      v-else
      class="forgot-password"
      :title="$t('title.resetPassword')"
      :subtitle="$t('labels.auth.forgotSubtitle')"
      :loading="isLoading"
    >
      <a-form ref="formValidator" layout="vertical" :model="form" no-style @finish="resetPassword">
        <a-form-item :label="$t('labels.auth.email')" name="email" :rules="formRules.email">
          <a-input
            v-model:value="form.email"
            type="email"
            autocomplete="email"
            :placeholder="$t('labels.auth.emailPlaceholder')"
            @focus="resetError"
          />
        </a-form-item>

        <AuthSubmitButton html-type="submit" :error="error" :loading="isLoading">
          {{ $t('labels.auth.sendResetLink') }}
        </AuthSubmitButton>
      </a-form>

      <template #footer>
        <NuxtLink class="nc-auth-link" :to="{ path: '/signin', query: route.query }">{{
          $t('labels.auth.backToSignIn')
        }}</NuxtLink>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>
