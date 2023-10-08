import {Amplify} from '@aws-amplify/core'
import {Auth} from '@aws-amplify/auth'
import {Hub} from 'aws-amplify'
import {defineNuxtPlugin, navigateTo} from '#app'
import {updateFirstTimeUser, useApi, useGlobal, useState} from '#imports'

export default defineNuxtPlugin(async (nuxtApp) => {
  const isAmplifyConfigured = useState('is-amplify-configured', () => false)

  const amplify: { checkForCognitoToken?: () => Promise<void> } = {}
  const state = useGlobal()

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

    const {signIn} = useGlobal()

    const listener = (data) => {
      switch (data?.payload?.event) {
        case 'signIn':
        case 'signedUp':
          checkForToken()
          break
      }
    }

    Hub.listen('auth', listener)

    function checkForToken() {
      const continueAfterSignIn = sessionStorage.getItem('continueAfterSignIn')
      Auth.currentSession()
        .then(async (res) => {
          const idToken = res.getIdToken()
          const jwt = idToken.getJwtToken()

          const {api} = useApi()

          const res1 = await api.instance.post(
            '/auth/cognito',
            {},
            {
              headers: {
                'xc-cognito': jwt,
              },
            },
          )
          if ((await res1).data.token) {
            updateFirstTimeUser()
            sessionStorage.removeItem('continueAfterSignIn')
            signIn((await res1).data.token)
            navigateTo(continueAfterSignIn || '/')
          }
        })
        .catch((_err) => {
        })
    }

    amplify.checkForCognitoToken = checkForToken
  }


  return {
    provide: {
      auth: Auth,
      amplify,
    },
  }
})
