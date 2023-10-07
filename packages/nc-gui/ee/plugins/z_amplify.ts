import { Amplify } from '@aws-amplify/core'
import { Auth } from '@aws-amplify/auth'
import { Hub } from 'aws-amplify'
import { defineNuxtPlugin, navigateTo } from '#app'
import { useGlobal } from '#imports'

export default defineNuxtPlugin(async (nuxtApp) => {
  const state = useGlobal()
  const init = async () => {
    console.log('appState', state)
    Amplify.configure({
      aws_project_region: 'us-east-2',
      aws_cognito_identity_pool_id: 'us-east-2:f4cd8643-8c9b-4fda-b949-eedcc39a0c5d',
      aws_cognito_region: 'us-east-2',
      aws_user_pools_id: 'us-east-2_MNegyNf5T',
      aws_user_pools_web_client_id: '5lo3lv5kj4t4nukutsvmbbq5s7',
      oauth: {
        domain: 'ncguiaf56d838-af56d838-dev.auth.us-east-2.amazoncognito.com',
        scope: ['openid', 'profile', 'email'],
        redirectSignIn: 'https://staging.noco.to',
        redirectSignOut: 'https://staging.noco.to?logout=true',
        // redirectSignIn: 'http://localhost:3000',
        // redirectSignOut: 'http://localhost:3000',
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

    const { signIn, signOut } = useGlobal()

    const url = new URL(location.href)

    if (url.searchParams.has('logout')) {
      await signOut().then(() => {
        url.searchParams.delete('logout')
        history.pushState({}, '', url.toString())
      })
    }

    const listener = (data) => {
      switch (data?.payload?.event) {
        case 'configured':
          console.info('the Auth module is configured')
          break
        case 'signIn':
          console.info('user signed in')
          checkForToken()
          break
        case 'signIn_failure':
          console.error('user sign in failed')
          break
        case 'signUp':
          console.info('user signed up')
          break
        case 'signUp_failure':
          console.error('user sign up failed')
          break
        case 'confirmSignUp':
          checkForToken()
          console.info('user confirmation successful')
          break
        case 'completeNewPassword_failure':
          console.error('user did not complete new password flow')
          break
        case 'autoSignIn':
          console.info('auto sign in successful')
          checkForToken()
          break
        case 'autoSignIn_failure':
          console.error('auto sign in failed')
          break
        case 'forgotPassword':
          console.info('password recovery initiated')
          break
        case 'forgotPassword_failure':
          console.error('password recovery failed')
          break
        case 'forgotPasswordSubmit':
          console.info('password confirmation successful')
          break
        case 'forgotPasswordSubmit_failure':
          console.error('password confirmation failed')
          break
        case 'verify':
          console.info('TOTP token verification successful')
          break
        case 'tokenRefresh':
          console.info('token refresh succeeded')
          break
        case 'tokenRefresh_failure':
          console.error('token refresh failed')
          break
        case 'cognitoHostedUI':
          console.info('Cognito Hosted UI sign in successful')
          break
        case 'cognitoHostedUI_failure':
          console.error('Cognito Hosted UI sign in failed')
          break
        case 'customOAuthState':
          console.info('custom state returned from CognitoHosted UI')
          break
        case 'customState_failure':
          console.error('custom state failure')
          break
        case 'parsingCallbackUrl':
          console.info('Cognito Hosted UI OAuth url parsing initiated')
          break
        case 'userDeleted':
          console.info('user deletion successful')
          break
        case 'updateUserAttributes':
          console.info('user attributes update successful')
          break
        case 'updateUserAttributes_failure':
          console.info('user attributes update failed')
          break
        case 'signOut':
          console.info('user signed out')
          break
        default:
          console.info('unknown event type')
          break
      }
    }

    Hub.listen('auth', listener)
    checkForToken()

    function checkForToken() {
      Auth.currentSession().then(async (res) => {
        const idToken = res.getIdToken()
        const jwt = idToken.getJwtToken()

        const { api } = useApi()
        // You can print them to see the full objects
        console.log(`myAccessToken: ${JSON.stringify(idToken)}`)
        console.log(`myJwt: ${jwt}`)

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
          signIn((await res1).data.token)
          navigateTo('/')
        }
      })
      Auth.currentAuthenticatedUser().then(
        async (currentAuthenticatedUser) => {
          const { api } = useApi()
          console.log('Yes, user is logged in.', currentAuthenticatedUser)
          const res2 = api.instance.post(
            '/auth/cognito',
            {},
            {
              headers: {
                'xc-cognito': currentAuthenticatedUser.signInUserSession.idToken.jwtToken,
              },
            },
          )
          if ((await res2).data.token) {
            signIn((await res2).data.token)
            navigateTo('/')
          }
        },
        (error) => {
          console.log(error)
        },
      )
    }
  }

  nuxtApp.hook('app:mounted', init)

  return {
    provide: {
      auth: Auth,
    },
  }
})
