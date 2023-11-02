<script setup lang="ts">
import '@aws-amplify/ui-vue/styles.css'
import { isFirstTimeUser } from '#imports'

const initialState = isFirstTimeUser() ? 'signUp' : 'signIn'

const services = {
  async validateCustomSignUp(formData) {
    if (/\+/.test(formData.email?.split('@')[0])) {
      return {
        email: "Email with '+' is not allowed.",
      }
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
</script>

<template>
  <div class="py-10 flex justify-center">
    <Authenticator :initial-state="initialState" :form-fields="formFields" :social-providers="['google']" :services="services">
      <template #header>
        <div style="padding: var(--amplify-space-large); text-align: center">
          <img class="amplify-image" alt="NocoDB Logo" src="~assets/img/brand/nocodb.png" />
        </div>
      </template>
      <template #sign-up-footer>
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
          <a class="!cursor-pointer !text-gray-400 !hover:text-brand-500" href="https://www.nocodb.com/policy" target="_blank">
            Privacy Policy
          </a>
        </div>
      </template>
    </Authenticator>
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
  font-family: 'Manrope', sans-serif;
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
</style>
