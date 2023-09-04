import { navigateTo, shallowRef } from '#imports'
import MdiHome from '~icons/mdi/home'
import MdiFileOutline from '~icons/mdi/file-outline'

export const homeCommands = [
  {
    id: 'account_settings',
    title: 'Account Settings',
    icon: 'account',
    section: 'Account',
  },
  {
    id: 'account_settings-users',
    title: 'Users',
    parent: 'account_settings',
    icon: 'users',
  },
  {
    id: 'account_settings-users-reset_password',
    title: 'Reset Password',
    parent: 'account_settings-users',
    icon: 'key',
    handler: () => {
      navigateTo('/account/users/password-reset')
    },
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
    id: 'home',
    title: 'Navigate Home',
    hotkey: 'cmd+h',
    icon: shallowRef(MdiHome),
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
    icon: shallowRef(MdiFileOutline),
  },
]

/*
  Here is a list of all the available commands defined throughout the app.
  Commands prefixed with a '-' are static commands that are always available.
  Commands prefixed with a '+' are dynamic commands that are only available when the user is in a specific context. 
  Commands prefixed with a '*' are scopes

  Commands:
    * home (Navigate Home)
    + workspaces (Workspaces)
    + projects (Projects)
    * workspace (Workspace)
      + tables (Tables)
      + views (Views)
    * account_settings (Account Settings)
      * account_settings-users (Users)
        - account_settings-users-reset_password (Reset Password)
      - account_settings-tokens (Tokens)
*/
