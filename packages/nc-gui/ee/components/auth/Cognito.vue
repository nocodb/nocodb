<script setup lang="ts">
import '@aws-amplify/ui-vue/styles.css'
import { AmplifyButton, Authenticator, FederatedSignIn, useAuthenticator } from '@aws-amplify/ui-vue'
import isEmail from 'validator/es/lib/isEmail'
import { Auth } from 'aws-amplify'

const { isDark } = useTheme()

const initialState = isFirstTimeUser() ? 'signUp' : 'signIn'
const { lastUsedAuthMethod } = useGlobal()
const facade = useAuthenticator() as any
const amplifyRoute = toRef(facade, 'route')
const isSigninOrSignup = computed(() => {
  return amplifyRoute.value === 'signIn' || amplifyRoute.value === 'signUp'
})

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
  facade.toResetPassword()
}
</script>

<template>
  <div
    class="py-10 flex justify-center min-h-screen overflow-auto"
    :class="{
      'nc-last-used-auth-email': lastUsedAuthMethod === 'email' && isSigninOrSignup,
      'nc-last-used-auth-sso': lastUsedAuthMethod === 'sso' && isSigninOrSignup,
      'nc-last-used-auth-google': lastUsedAuthMethod === 'google' && isSigninOrSignup,
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
          <img v-if="isDark" class="amplify-image" alt="NocoDB Logo" src="~assets/img/brand/text.png" />
          <img v-else class="amplify-image" alt="NocoDB Logo" src="~assets/img/brand/nocodb.png" />
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
            <GeneralIcon icon="sso" class="flex-none text-nc-content-gray-muted h-4.5 w-4.5 mr-2" />
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
            <GeneralIcon icon="sso" class="flex-none text-nc-content-gray-muted h-4.5 w-4.5 mr-2" />
            Sign in with Single Sign On
          </AmplifyButton>
        </div>
        <div class="pb-4 text-center text-xs tos mx-2">
          By signing up, you agree to our
          <a
            class="!cursor-pointer !text-nc-content-gray-disabled !hover:text-nc-content-brand"
            href="https://www.nocodb.com/terms-of-service"
            target="_blank"
          >
            Terms of Service
          </a>
          &
          <a
            class="!cursor-pointer !text-nc-content-gray-disabled !hover:text-nc-content-brand"
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
  --amplify-components-tabs-item-hover-color: var(--color-brand-500);
  --amplify-components-tabs-item-active-color: var(--color-brand-500);
  --amplify-components-tabs-item-focus-color: var(--color-brand-500);
  --amplify-components-tabs-item-active-border-color: var(--color-brand-500);
  --amplify-components-authenticator-router-border-color: var(--color-gray-100);
  --amplify-components-authenticator-router-box-shadow: 0 0 0 1px var(--color-gray-100);
  --amplify-components-authenticator-form-padding: 1.5rem;
  --amplify-components-text-color: var(--nc-content-gray);
}

.tos {
  @apply text-nc-content-gray-disabled;
}

.amplify-image {
  @apply w-40;
}

.amplify-button {
  @apply !rounded-lg focus:shadow-none;
}

.amplify-field__show-password {
  @apply border-l-0 !rounded-l-none hover:bg-nc-bg-default focus:bg-nc-bg-default focus:ring-0 border-1 border-nc-border-gray-medium;
}

.amplify-input {
  @apply border-1 border-nc-border-gray-medium rounded-lg;
}

.amplify-input:focus {
  @apply border-1 border-nc-border-brand rounded-lg ring-0;
}

[data-amplify-container] {
  @apply !h-[34rem] !min-w-[23.5rem] text-nc-content-gray;
}

.amplify-field-group :not(:first-child) .amplify-input {
  @apply !rounded-lg;
}

.federated-sign-in-button {
  --amplify-internal-button-color: var(--nc-content-gray);
  @apply rounded-md border-nc-border-gray-medium focus:bg-nc-bg-gray-extralight focus:border-nc-border-gray-extralight border-1 hover:bg-nc-bg-gray-extralight rounded-lg;

  &:hover {
    --amplify-internal-button-color: var(--nc-content-gray);
  }
}

.amplify-divider {
  @apply uppercase !text-nc-content-gray;
}

.amplify-authenticator__font {
  font-family: 'Inter', sans-serif;
}

[data-amplify-authenticator] [data-amplify-router] {
  @apply !rounded-2xl overflow-hidden;
}

.amplify-tabs[data-indicator-position='top'] {
  @apply !border-t-1 border-nc-border-brand;
}

.amplify-button--link {
  @apply !text-nc-content-gray !hover:text-nc-content-brand;
}

.amplify-tabs-item {
  @apply border-transparent;
}

.amplify-label {
  @apply !text-nc-content-gray font-medium text-sm;
}

.amplify-alert {
  @apply !rounded-lg;
}

[data-amplify-authenticator] {
  --amplify-components-authenticator-router-background-color: var(--nc-bg-default);
  --amplify-components-authenticator-state-inactive-background-color: var(--color-gray-50);
  --amplify-components-tabs-item-color: var(--nc-content-gray);
  --amplify-components-divider-label-background-color: var(--nc-bg-default);
  --amplify-components-divider-label-color: var(--nc-content-gray-muted);
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
  --amplify-components-text-error-color: var(--nc-content-red-medium);
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

[theme='dark'] {
  .amplify-button.amplify-field__show-password {
    --amplify-internal-button-color: var(--nc-content-gray-muted);
    &:hover {
      --amplify-internal-button-color: var(--nc-content-brand);
    }
  }

  .amplify-button--disabled {
    background-color: var(--nc-bg-gray-light);
    border-color: var(--nc-border-gray-light);
    color: var(--nc-content-gray-disabled);
  }
}
</style>
