<script lang="ts" setup>
import { NO_SCOPE } from 'nocodb-sdk'

const { t } = useI18n()
const { $api } = useNuxtApp()
const { appInfo } = useGlobal()

const formValidator = ref()

const isUpdating = ref(false)
const isLoadingProfile = ref(false)

const error = ref<string | null>(null)

const form = reactive({
  currentPassword: '',
  password: '',
  passwordRepeat: '',
})

const userProfile = ref<{
  accounts?: {
    email: boolean
    google: boolean
  }
} | null>(null)

const isCognitoConfigured = computed(() => {
  return !!appInfo.value?.cognito
})

// Determine if user should "Set Password" (only Google) or "Reset Password" (has email)
const hasEmailAccount = computed(() => {
  return userProfile.value?.accounts?.email === true
})

const hasOnlyGoogleAccount = computed(() => {
  return userProfile.value?.accounts?.google === true && !hasEmailAccount.value
})

// Load user profile to check connected accounts
const loadUserProfile = async () => {
  if (!isCognitoConfigured.value) return

  try {
    isLoadingProfile.value = true
    userProfile.value = await $api.internal.getOperation(NO_SCOPE, NO_SCOPE, {
      operation: 'getUserProfile',
    })
  } catch (err: any) {
    console.error('Failed to load user profile:', err)
    if (err?.response?.data?.msg?.includes('SSO')) {
      userProfile.value = null
    }
  } finally {
    isLoadingProfile.value = false
  }
}

onMounted(() => {
  loadUserProfile()
})

const isCancelButtonEnabled = computed(() => {
  return form.password || form.passwordRepeat || form.currentPassword
})

const formRules = computed(() => {
  const rules: any = {
    password: [
      { required: true, message: t('msg.error.signUpRules.passwdRequired') },
      { min: 8, message: t('msg.error.signUpRules.passwdLength') },
    ],
    passwordRepeat: [
      { required: true, message: t('msg.error.signUpRules.passwdRequired') },
      {
        validator: (_: unknown, _v: string) => {
          return new Promise((resolve, reject) => {
            if (form.password === form.passwordRepeat) return resolve(true)
            reject(new Error(t('msg.error.signUpRules.passwdMismatch')))
          })
        },
        message: t('msg.error.signUpRules.passwdMismatch'),
      },
    ],
  }

  if (hasEmailAccount.value) {
    rules.currentPassword = [{ required: true, message: t('msg.error.signUpRules.passwdRequired') }]
  }

  return rules
})

const passwordChange = async () => {
  try {
    const valid = await formValidator.value.validate()
    if (!valid) return

    error.value = null
    isUpdating.value = true

    if (hasOnlyGoogleAccount.value) {
      await $api.auth.passwordSet({
        password: form.password,
      })

      message.success(t('msg.success.passwordSet') || 'Password set successfully')

      await loadUserProfile()
    } else if (hasEmailAccount.value) {
      // Reset password for email user
      await $api.auth.passwordChange({
        currentPassword: form.currentPassword,
        newPassword: form.password,
      })

      message.success(t('msg.success.passwordChanged'))
    }

    // Reset form
    form.currentPassword = ''
    form.password = ''
    form.passwordRepeat = ''
    formValidator.value.resetFields()
  } catch (err: any) {
    console.error('Password change error:', err)

    const errorMsg = await extractSdkResponseErrorMsg(err)

    if (errorMsg.includes('Current password is incorrect')) {
      error.value = t('msg.error.invalidCurrentPassword') || 'Current password is incorrect'
    } else if (errorMsg.includes('Too many attempts')) {
      error.value = t('msg.error.tooManyAttempts') || 'Too many attempts. Please try again later'
    } else if (errorMsg.includes('Invalid password')) {
      error.value = errorMsg || 'Invalid password format'
    } else {
      error.value = errorMsg || t('msg.error.passwordChangeFailed') || 'Failed to change password'
    }
  } finally {
    isUpdating.value = false
  }
}

const resetError = () => {
  if (error.value) error.value = null
}

const onCancel = () => {
  form.currentPassword = ''
  form.password = ''
  form.passwordRepeat = ''
  formValidator.value.resetFields()
  error.value = null
}
</script>

<template>
  <div v-if="isCognitoConfigured && !isLoadingProfile && userProfile" class="nc-settings-item-card-wrapper mt-5">
    <div class="nc-settings-item-heading text-nc-content-gray-emphasis">
      {{ hasOnlyGoogleAccount ? $t('title.setPassword') : $t('activity.changePwd') }}
    </div>

    <div class="nc-settings-item-card p-6">
      <a-form
        ref="formValidator"
        layout="vertical"
        no-style
        :model="form"
        class="w-full change-password"
        @finish="passwordChange"
      >
        <Transition name="layout">
          <div v-if="error" class="mb-4 bg-nc-red-500 text-nc-content-gray-extreme rounded-lg p-3">
            <div class="flex items-center gap-2" data-rec="true">
              <MaterialSymbolsWarning />
              {{ error }}
            </div>
          </div>
        </Transition>

        <div class="flex flex-col gap-4">
          <div v-if="hasEmailAccount">
            <div class="text-nc-content-gray mb-2" data-rec="true">{{ $t('placeholder.password.current') }}</div>
            <a-form-item name="currentPassword" :rules="formRules.currentPassword" class="!my-0">
              <a-input-password
                v-model:value="form.currentPassword"
                class="w-full !rounded-lg !px-4 h-10"
                :placeholder="$t('placeholder.password.current')"
                data-testid="nc-account-settings-current-password"
                @focus="resetError"
              />
            </a-form-item>
          </div>

          <div>
            <div class="text-nc-content-gray mb-2" data-rec="true">{{ $t('placeholder.password.new') }}</div>
            <a-form-item name="password" :rules="formRules.password" class="!my-0">
              <a-input-password
                v-model:value="form.password"
                class="w-full !rounded-lg !px-4 h-10"
                :placeholder="$t('placeholder.password.new')"
                data-testid="nc-account-settings-new-password"
                @focus="resetError"
              />
            </a-form-item>
          </div>

          <div>
            <div class="text-nc-content-gray mb-2" data-rec="true">{{ $t('placeholder.password.confirm') }}</div>
            <a-form-item name="passwordRepeat" :rules="formRules.passwordRepeat" class="!my-0">
              <a-input-password
                v-model:value="form.passwordRepeat"
                class="w-full !rounded-lg !px-4 h-10"
                :placeholder="$t('placeholder.password.confirm')"
                data-testid="nc-account-settings-confirm-password"
                @focus="resetError"
              />
            </a-form-item>
          </div>
        </div>

        <div class="flex flex-row w-full justify-end mt-8 gap-4">
          <NcButton
            type="secondary"
            size="small"
            data-testid="nc-account-settings-password-cancel"
            :disabled="isUpdating || !isCancelButtonEnabled"
            @click="onCancel"
          >
            {{ $t('general.cancel') }}
          </NcButton>
          <NcButton
            type="primary"
            html-type="submit"
            size="small"
            :disabled="isUpdating"
            :loading="isUpdating"
            data-testid="nc-account-settings-password-save"
          >
            <template #loading> {{ $t('general.updating') }} </template>
            {{ hasOnlyGoogleAccount ? $t('title.setPassword') : $t('activity.changePwd') }}
          </NcButton>
        </div>
      </a-form>
    </div>
  </div>
</template>
