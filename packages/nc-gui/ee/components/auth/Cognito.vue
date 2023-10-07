<script setup lang="ts">
import '@aws-amplify/ui-vue/styles.css'
import { Authenticator } from '@aws-amplify/ui-vue'
import { useState } from '#imports'

const isAmplifyConfigured = useState('is-amplify-configured', () => false)

const { $amplify } = useNuxtApp()

const formFields = {
  signIn: {
    username: {
      placeholder: 'Enter your work email',
    },
    password: {
      placeholder: 'xxxxxxxxxxxxxx',
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
      placeholder: 'xxxxxxxxxxxxxx',
      isRequired: false,
      order: 2,
    },
    confirm_password: {
      label: 'Confirm Password',
      placeholder: 'xxxxxxxxxxxxxx',
      order: 3,
    },
  },
  forceNewPassword: {
    password: {
      placeholder: 'xxxxxxxxxxxxxx',
    },
  },
  resetPassword: {
    username: {
      placeholder: 'Enter your work email',
    },
  },
  confirmResetPassword: {
    confirmation_code: {
      placeholder: 'xxxxxx',
      label: 'Confirmation Code',
      isRequired: false,
    },
    new_password: {
      placeholder: 'xxxxxxxxxxxxxx',
      label: 'New Password',
      isRequired: true,
    },
  },
}



onMounted(async () => {
  if(isAmplifyConfigured.value){
    await $amplify.checkForAmplifyToken()
  }
})
</script>

<template>
  <div class="py-10 flex justify-center">
    <Authenticator v-if="isAmplifyConfigured" initial-state="signUp" :form-fields="formFields" :social-providers="['google']">
      <template #header>
        <div style="padding: var(--amplify-space-large); text-align: center">
          <img class="amplify-image" alt="NocoDB Logo" src="~assets/img/brand/nocodb.png" />
        </div>
      </template>
      <template #footer>
        <div class="mt-2 text-center px-2">
          By using NocoDB, you agree to our
          <a class="amplify-button--link !cursor-pointer" href="https://www.nocodb.com/terms-of-service" target="_blank"
            >Terms of Service</a
          >
          and
          <a class="amplify-button--link !cursor-pointer" href="https://www.nocodb.com/policy" target="_blank">Privacy Policy</a>
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
