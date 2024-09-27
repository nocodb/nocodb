import { Amplify } from '@aws-amplify/core'
import { Auth } from '@aws-amplify/auth'
import { useAuthenticator } from '@aws-amplify/ui-vue'
import { defineNuxtPlugin, navigateTo, useRoute } from '#app'

export default defineNuxtPlugin(async (_nuxtApp) => {
  // use a Pinia store
  const isAmplifyConfigured = useState('is-amplify-configured', () => false)

  const amplify: { checkForCognitoToken?: () => Promise<void> } = {}
  const state = useGlobal()

  until(state.appInfo)
    .toMatch((v) => !!v?.cognito?.aws_user_pools_id, { timeout: 30000 })
    .then(() => {
      // check if cognito is configured and initialize Amplify
      if (state.appInfo?.value?.cognito?.aws_user_pools_id) {
        const cognitoConfig = state.appInfo.value.cognito

        // initialize Amplify
        Amplify.configure({
          aws_project_region: cognitoConfig.aws_project_region,
          aws_cognito_identity_pool_id: cognitoConfig.aws_cognito_identity_pool_id,
          aws_cognito_region: cognitoConfig.aws_cognito_region,
          aws_user_pools_id: cognitoConfig.aws_user_pools_id,
          aws_user_pools_web_client_id: cognitoConfig.aws_user_pools_web_client_id,
          oauth: {
            domain: cognitoConfig.oauth.domain,
            scope: ['openid', 'profile', 'email'],
            redirectSignIn: cognitoConfig.oauth.redirectSignIn,
            redirectSignOut: cognitoConfig.oauth.redirectSignOut,
            responseType: 'code',
          },
          federationTarget: 'COGNITO_USER_POOLS',
          aws_cognito_username_attributes: ['EMAIL'],
          aws_cognito_social_providers: [],
          aws_cognito_signup_attributes: ['EMAIL'],
          aws_cognito_mfa_configuration: 'OFF',
          aws_cognito_mfa_types: ['SMS'],
          aws_cognito_password_protection_settings: {
            passwordPolicyMinLength: 8,
            passwordPolicyCharacters: [],
          },
          aws_cognito_verification_mechanisms: ['EMAIL'],
        })

        isAmplifyConfigured.value = true

        const { checkForCognitoToken, signedIn } = useGlobal()
        const { authStatus } = toRefs(useAuthenticator())

        watch(
          [authStatus],
          async ([status]) => {
            if (status === 'authenticated' && !signedIn.value) {
              await checkForCognitoToken()
              const route = useRoute()
              if (/signin|signup/i.test(route.name)) {
                navigateTo('/')
              }
            }
          },
          {
            immediate: true,
          },
        )
      }
    })
  return {
    provide: {
      auth: Auth,
      amplify,
    },
  }
})
