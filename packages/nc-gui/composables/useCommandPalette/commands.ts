import { navigateTo } from '#imports'

export const workspaceCommands = [
  {
    id: 'account_settings-users',
    title: 'Users',
    parent: 'account_settings',
    children: ['User Management', 'Reset Password', 'Settings'],
  },
  {
    id: 'account_settings-users-user_management',
    title: 'User Management',
    parent: 'account_settings-users',
    handler: () => {
      navigateTo('/account/users')
    },
  },
  {
    id: 'account_settings-users-reset_password',
    title: 'Reset Password',
    parent: 'account_settings-users',
    handler: () => {
      navigateTo('/account/users/password-reset')
    },
  },
  {
    id: 'account_settings-users-settings',
    title: 'Settings',
    parent: 'account_settings-users',
    handler: () => {
      navigateTo('/account/users/settings')
    },
  },
  {
    id: 'account_settings-tokens',
    title: 'Tokens',
    parent: 'account_settings',
    handler: () => {
      navigateTo('/account/tokens')
    },
  },
  {
    id: 'account_settings-app_store',
    title: 'App Store',
    parent: 'account_settings',
    handler: () => {
      navigateTo('/account/apps')
    },
  },
  {
    id: 'account_settings-license',
    title: 'License',
    parent: 'account_settings',
    hotkey: 'cmd+l',
    handler: () => {
      navigateTo('/account/license')
    },
  },
  {
    id: 'account_settings',
    title: 'Account Settings',
    children: ['account_settings-users', 'account_settings-tokens', 'account_settings-app_store', 'account_settings-license'],
  },
  {
    id: 'home',
    title: 'Navigate Home',
    hotkey: 'cmd+h',
    handler: () => {
      navigateTo('/')
    },
  },
]

export const projectCommands = []
