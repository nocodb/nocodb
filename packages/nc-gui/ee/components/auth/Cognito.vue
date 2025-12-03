<script setup lang="ts">
import '@aws-amplify/ui-vue/styles.css'
import { AmplifyButton, Authenticator, FederatedSignIn, useAuthenticator } from '@aws-amplify/ui-vue'
import isEmail from 'validator/es/lib/isEmail'
import { Auth } from 'aws-amplify'

const initialState = isFirstTimeUser() ? 'signUp' : 'signIn'
const { lastUsedAuthMethod } = useGlobal()

const services = {
  async validateCustomSignUp(formData) {
    if (/\+/.test(formData.email?.split('@')[0])) {
      return {
        email: "Email with '+' is not allowed.",
      }
    }
    if (!isEmail(formData.email?.toLowerCase() || '')) {
      return
    }
    const { isDisposableEmail } = await import('~/helpers/isDisposableEmail')
    if (isDisposableEmail(formData.email?.toLowerCase())) {
      return {
        email:
          'For the security and integrity of NocoDB platform, we require users to sign up with a permanent email address. Please provide a valid, long-term email address to continue.',
      }
    }
  },
}

const formFields = {
  signIn: {
    username: {
      placeholder: 'Enter your work email',
    },
    password: {
      placeholder: '**********',
    },
  },
  signUp: {
    email: {
      label: 'Email',
      placeholder: 'Enter your work email',
      isRequired: true,
      order: 1,
    },
    password: {
      label: 'Password',
      placeholder: '**********',
      isRequired: false,
      order: 2,
    },
    confirm_password: {
      label: 'Confirm Password',
      placeholder: '**********',
      order: 3,
    },
  },
  forceNewPassword: {
    password: {
      placeholder: '**********',
    },
  },
  resetPassword: {
    username: {
      placeholder: 'Enter your work email',
    },
  },
  confirmResetPassword: {
    confirmation_code: {
      placeholder: '******',
      label: 'Confirmation Code',
      isRequired: false,
    },
  },
}

const email = ref('')
const confirmCode = ref('')
const emailVerifyDlg = ref(false)
const confirmCodeForm = ref(false)
const loading = ref(false)

const emailVerify = async () => {
  loading.value = true
  if (confirmCodeForm.value) {
    try {
      await Auth.confirmSignUp(email.value, confirmCode.value)
      confirmCodeForm.value = false
      await message.success('Email verified successfully, Now you can try resetting password.')
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e as any))
    }
  } else {
    try {
      await Auth.resendSignUp(email.value)
      confirmCodeForm.value = true
    } catch (e) {
      await message.error(await extractSdkResponseErrorMsg(e as any))
    }
  }
  loading.value = false
}

watch(emailVerifyDlg, (val) => {
  if (val) return
  confirmCodeForm.value = false
  email.value = ''
  confirmCode.value = ''
  emailVerifyDlg.value = false
})

const onForgotPasswordClicked = (): void => {
  const facade = useAuthenticator() as any
  facade.toResetPassword()
}
</script>

<template>
  <div
    class="py-10 flex justify-center min-h-screen overflow-auto"
    :class="{
      'nc-last-used-auth-email': lastUsedAuthMethod === 'email',
      'nc-last-used-auth-sso': lastUsedAuthMethod === 'sso',
      'nc-last-used-auth-google': lastUsedAuthMethod === 'google',
    }"
  >
    <Authenticator
      :ref="auth"
      :initial-state="initialState"
      :form-fields="formFields"
      :social-providers="['google']"
      :services="services"
    >
      <template #header>
        <div style="padding: var(--amplify-space-large); text-align: center">
          <img class="amplify-image" alt="NocoDB Logo" src="~assets/img/brand/nocodb.png" />
        </div>
      </template>
      <template #sign-in-footer>
        <div class="w-full px-6 pb-4 flex flex-col gap-1">
          <!-- SSO Sign in button -->
          <FederatedSignIn />

          <AmplifyButton
            class="nc-sso amplify-authenticator__federated-button -mt-2 amplify-button amplify-field-group__control federated-sign-in-button amplify-authenticator__font"
            type="button"
            @click="navigateTo('/sso')"
          >
            <GeneralIcon icon="sso" class="flex-none text-gray-500 h-4.5 w-4.5 mr-2" />
            Sign in with Single Sign On
          </AmplifyButton>

          <AmplifyButton
            class="amplify-field-group__control amplify-authenticator__font !mt-2"
            variation="link"
            :fullwidth="true"
            size="small"
            style="font-weight: normal"
            type="button"
            @click="onForgotPasswordClicked"
          >
            Forgot Password?
          </AmplifyButton>
        </div>
      </template>
      <template #sign-up-footer>
        <div class="w-full px-6 pb-4 flex flex-col gap-1">
          <!-- SSO Sign in button -->
          <FederatedSignIn />

          <AmplifyButton
            class="nc-sso amplify-authenticator__federated-button -mt-2 amplify-button amplify-field-group__control federated-sign-in-button amplify-authenticator__font"
            type="button"
            @click="navigateTo('/sso')"
          >
            <GeneralIcon icon="sso" class="flex-none text-gray-500 h-4.5 w-4.5 mr-2" />
            Sign in with Single Sign On
          </AmplifyButton>
        </div>
        <div class="pb-4 text-center text-xs tos mx-2">
          By signing up, you agree to our
          <a
            class="!cursor-pointer !text-gray-400 !hover:text-brand-500"
            href="https://www.nocodb.com/terms-of-service"
            target="_blank"
          >
            Terms of Service
          </a>
          &
          <a
            class="!cursor-pointer !text-gray-400 !hover:text-brand-500"
            href="https://nocodb.com/docs/legal/privacy"
            target="_blank"
          >
            Privacy Policy
          </a>
        </div>
      </template>

      <template #reset-password-footer>
        <div class="text-center flex gap-1 justify-center">
          Verify your email if not done already:
          <span class="cursor-pointer underline" @click="emailVerifyDlg = true">Click here</span>
          <NcTooltip>
            <template #title>
              <div class="text-center">
                If your email wasn’t verified during sign-up, please verify it now before proceeding with the reset; otherwise,
                you won’t receive the reset code.
              </div>
            </template>
            <GeneralIcon icon="info" />
          </NcTooltip>
        </div>
      </template>
      <template #confirm-reset-password-footer>
        <div class="text-center flex gap-1 justify-center">
          Verify your email if not done already:
          <span class="cursor-pointer underline" @click="emailVerifyDlg = true">Click here</span>
          <NcTooltip>
            <template #title>
              <div class="text-center">
                If your email wasn’t verified during sign-up, please verify it now before proceeding with the reset; otherwise,
                you won’t receive the reset code.
              </div>
            </template>
            <GeneralIcon icon="info" />
          </NcTooltip>
        </div>
      </template>
    </Authenticator>

    <!-- Modal for email verification -->
    <NcModal v-model:visible="emailVerifyDlg" size="small" title="Email Verification" wrap-class-name="rounded-lg">
      <div v-if="!confirmCodeForm" class="amplify-flex amplify-field amplify-textfield">
        <label class="amplify-label" for="amplify-email">Email</label>
        <div class="amplify-flex amplify-field-group">
          <div class="amplify-field-group__field-wrapper">
            <input
              id="amplify-email"
              v-model="email"
              class="amplify-input amplify-field-group__control"
              placeholder="Email"
              type="email"
            />
          </div>
        </div>
      </div>
      <div v-else class="amplify-flex amplify-field amplify-textfield">
        <label class="amplify-label" for="amplify-confirm-code">Verification Code</label>
        <div class="amplify-flex amplify-field-group">
          <div class="amplify-field-group__field-wrapper">
            <input
              id="amplify-confirm-code"
              v-model="confirmCode"
              class="amplify-input amplify-field-group__control"
              placeholder="Verification Code"
              type="password"
            />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-4 mt-4">
        <NcButton type="secondary" @click="emailVerifyDlg = false"> Close</NcButton>
        <NcButton type="primary" :loading="loading" @click="emailVerify">
          {{ confirmCodeForm ? 'Verify' : 'Get Verification Code' }}
        </NcButton>
      </div>
    </NcModal>
  </div>
</template>

<style>
:root,
[data-amplify-theme] {
  --amplify-components-button-focus-border-color: #3366ff;
  --amplify-components-button-focus-color: #3366ff;
  --amplify-components-tabs-item-hover-color: #3366ff;
  --amplify-components-tabs-item-active-color: #3366ff;
  --amplify-components-tabs-item-focus-color: #3366ff;
  --amplify-components-tabs-item-active-border-color: #3366ff;
  --amplify-components-authenticator-router-border-color: #f4f4f5;
  --amplify-components-authenticator-router-box-shadow: 0 0 0 1px #f4f4f5;
  --amplify-components-authenticator-form-padding: 1.5rem;
}

.tos {
  @apply text-gray-400;
}

.amplify-image {
  @apply w-40;
}

.amplify-button {
  @apply !rounded-lg focus:shadow-none;
}

.amplify-field__show-password {
  @apply border-l-0 !rounded-l-none hover:bg-white focus:bg-white focus:ring-0 border-1 border-gray-200;
}

.amplify-input {
  @apply border-1 border-gray-200 rounded-lg;
}

.amplify-input:focus {
  @apply border-1 border-brand-500 rounded-lg ring-0;
}

[data-amplify-container] {
  @apply !h-[34rem] !min-w-[23.5rem];
}

.amplify-field-group :not(:first-child) .amplify-input {
  @apply !rounded-lg;
}

.federated-sign-in-button {
  @apply rounded-md border-gray-200 focus:bg-gray-50 focus:border-gray-50 border-1 hover:bg-gray-50 rounded-lg;
}

.amplify-divider {
  @apply uppercase !text-gray-800;
}

.amplify-authenticator__font {
  font-family: 'Inter', sans-serif;
}

[data-amplify-authenticator] [data-amplify-router] {
  @apply !rounded-2xl overflow-hidden;
}

.amplify-tabs[data-indicator-position='top'] {
  @apply !border-t-1 border-brand-500;
}

.amplify-button--link {
  @apply !text-gray-800 !hover:text-brand-500;
}

.amplify-tabs-item {
  @apply border-transparent;
}

.amplify-label {
  @apply !text-gray-800 font-medium text-sm;
}

.amplify-alert {
  @apply !rounded-lg;
}

[data-amplify-authenticator] {
  --amplify-components-button-primary-background-color: #3366ff;
  --amplify-components-button-border-radius: 8px;
  --amplify-components-button-primary-hover-background-color: #2952cc;
  --amplify-components-button-primary-focus-background-color: #3366ff;
  --amplify-components-button-primary-active-background-color: #3366ff;
  --amplify-components-button-link-color: var(--amplify-colors-brand-secondary-80);
  --amplify-components-button-link-hover-color: var(--amplify-colors-brand-secondary-90);
  --amplify-components-button-link-focus-color: var(--amplify-colors-brand-secondary-90);
  --amplify-components-button-link-active-color: var(--amplify-colors-brand-secondary-100);
  --amplify-components-button-link-active-background-color: transparent;
  --amplify-components-button-link-focus-background-color: transparent;
  --amplify-components-button-link-hover-background-color: transparent;
}

form > .federated-sign-in-container {
  display: none;
}

.federated-sign-in-container {
  flex-direction: column-reverse;
  gap: 24px;
}

/* apply above 498px width since UI looks cramped below that */
@media (min-width: 498px) {
  .nc-last-used-auth-sso .federated-sign-in-button.nc-sso,
  .nc-last-used-auth-google .amplify-authenticator__column > button.federated-sign-in-button:not([data-variation='primary']),
  .nc-last-used-auth-email
    form:not([data-np-autofill-form-type='register'])
    .amplify-authenticator__column
    > button.amplify-button[data-variation='primary'] {
    position: relative;

    &::after {
      position: absolute;
      content: ' Last Used';
      font-weight: normal;
      font-size: 0.775rem;
      margin-left: 0.25rem;
      color: #aaaaaa80;
      right: 7px;
      border: 1px solid #aaaaaa80;
      padding: 3px 10px;
      border-radius: 7px;
    }
  }

  /* signin button */
  .nc-last-used-auth-email .amplify-authenticator__column > button.amplify-button[data-variation='primary']::after {
    color: #ffffff80;
    border: 1px solid #ffffff80;
  }
}
</style>
