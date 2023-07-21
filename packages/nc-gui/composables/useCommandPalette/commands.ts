import { navigateTo } from '#imports'
import MdiHome from '~icons/mdi/home'
import MdiFileOutline from '~icons/mdi/file-outline'

export const homeCommands = [
  {
    id: 'workspace',
    title: 'Workspace',
    icon: 'workspace',
  },
  {
    id: 'account_settings-tokens',
    title: 'Tokens',
    parent: 'account_settings',
    icon: 'acl',
    handler: () => {
      navigateTo('/account/tokens')
    },
  },
  {
    id: 'account_settings-app_store',
    title: 'App Store',
    parent: 'account_settings',
    icon: 'appStore',
    handler: () => {
      navigateTo('/account/apps')
    },
  },
  {
    id: 'account_settings-license',
    title: 'License',
    parent: 'account_settings',
    icon: 'key',
    handler: () => {
      navigateTo('/account/license')
    },
  },
  {
    id: 'account_settings',
    title: 'Account Settings',
    icon: 'account',
    section: 'Account',
  },
  {
    id: 'home',
    title: 'Navigate Home',
    hotkey: 'cmd+h',
    icon: MdiHome,
    section: 'Misc',
    handler: () => {
      navigateTo('/')
    },
  },
  {
    id: 'workspaces',
    title: 'Workspaces',
    icon: 'workspace',
  },
  {
    id: 'projects',
    title: 'Projects',
    icon: MdiFileOutline,
  },
  {
    id: 'tables',
    title: 'Tables',
    parent: 'workspace',
    section: 'Workspace',
    icon: 'table',
  },
  {
    id: 'views',
    title: 'Views',
    parent: 'workspace',
    section: 'Workspace',
    icon: 'view',
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
    - workspace (Workspace)
      + tables (Tables)
      + views (Views)
    - account_settings (Account Settings)
      - account_settings-users (Users)
        - account_settings-users-user_management (User Management)
        - account_settings-users-reset_password (Reset Password)
        - account_settings-users-settings (Settings)
      - account_settings-tokens (Tokens)
      - account_settings-app_store (App Store)
      - account_settings-license (License)
*/
