import { navigateTo } from '#imports'

export const homeCommands = [
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

/*
  Here is a list of all the available commands defined throughout the app.
  Commands prefixed with a '-' are static commands that are always available.
  Commands prefixed with a '+' are dynamic commands that are only available when the user is in a specific context. 

  Commands:
    - home (Navigate Home)
    + workspaces (Workspaces)
    + projects (Projects)
    - account_settings (Account Settings)
      - account_settings-users (Users)
        - account_settings-users-user_management (User Management)
        - account_settings-users-reset_password (Reset Password)
        - account_settings-users-settings (Settings)
      - account_settings-tokens (Tokens)
      - account_settings-app_store (App Store)
      - account_settings-license (License)
    - project (Project)
      + tables (Tables)
      + views (Views)
*/
