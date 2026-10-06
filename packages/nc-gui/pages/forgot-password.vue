<script setup lang="ts">
import type { RuleObject } from 'ant-design-vue/es/form'

definePageMeta({
  requiresAuth: false,
})

const route = useRoute()

const { api, isLoading, error } = useApi({ useGlobalInstance: true })

const { t } = useI18n()

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
    })
  } catch {
    // ignore since error value is set by useApi and will be displayed in UI
  }
}

function resetError() {
  if (error.value) error.value = null
}

function navigateSignIn() {
  navigateTo({
    path: '/signin',
    query: route.query,
  })
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
        <a class="nc-auth-link" @click="navigateSignIn">{{ $t('labels.auth.backToSignIn') }}</a>
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
        <a class="nc-auth-link" @click="navigateSignIn">{{ $t('labels.auth.backToSignIn') }}</a>
      </template>
    </AuthShell>
  </NuxtLayout>
</template>
