import type { NinjaKeys } from 'ninja-keys'

export const useCommandPalette = createSharedComposable(() => {
  const cmdPalette = ref<NinjaKeys>()

  function cmdOnSelected(event: any) {
    console.log('selected', event.detail)
  }

  function cmdOnChange(event: any) {
    console.log('change', event.detail)
  }

  const cmdPlaceholder = ref('Placeholder prop test')

  const cmdData = ref([
    {
      id: 'Home',
      title: 'Navigate Home',
      hotkey: 'cmd+h',
      handler: () => {
        navigateTo('/')
      },
    },
    {
      id: 'Account Settings',
      title: 'Account Settings',
      children: [
        {
          id: 'Users',
          title: 'Users',
          children: [
            {
              id: 'User Management',
              title: 'User Management',
              parent: 'Users',
              handler: () => {
                navigateTo('/account/users')
              },
            },
            {
              id: 'Reset Password',
              title: 'Reset Password',
              parent: 'Users',
              handler: () => {
                navigateTo('/account/users/password-reset')
              },
            },
            {
              id: 'Settings',
              title: 'Settings',
              parent: 'Users',
              handler: () => {
                navigateTo('/account/users/settings')
              },
            },
          ],
        },
        {
          id: 'Tokens',
          title: 'Tokens',
          parent: 'Account Settings',
          handler: () => {
            navigateTo('/account/tokens')
          },
        },
        {
          id: 'App Store',
          title: 'App Store',
          parent: 'Account Settings',
          handler: () => {
            navigateTo('/account/apps')
          },
        },
        {
          id: 'License',
          title: 'License',
          parent: 'Account Settings',
          handler: () => {
            navigateTo('/account/license')
          },
        },
      ],
    },
  ])

  return { cmdPalette, cmdData, cmdPlaceholder, cmdOnSelected, cmdOnChange }
})
