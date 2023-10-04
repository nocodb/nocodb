import { navigateTo, shallowRef } from '#imports'
import MdiFileOutline from '~icons/mdi/file-outline'

export const homeCommands = [
  /*   {
    id: 'workspaces',
    title: 'Workspaces',
    icon: 'workspace',
  },
  {
    id: 'bases',
    title: 'Bases',
    icon: shallowRef(MdiFileOutline),
  }, */
  {
    id: 'user',
    title: 'Account',
    icon: 'account',
    section: 'Accounts',
  },
  {
    id: 'user_account-settings',
    title: 'Account Settings',
    icon: 'settings',
    parent: 'user',
    section: 'Account',
    handler: () => {
      navigateTo('/account/profile')
    },
  },
  {
    id: 'user_account-logout',
    title: 'Logout',
    icon: 'signout',
    parent: 'user',
    section: 'Account',
    handler: () => {},
  },
  {
    id: 'user_account-discord',
    title: 'Discord',
    icon: 'discord',
    parent: 'user',
    section: 'Community',
    handler: () => {
      window.open('https://discord.gg/8jX2GQn', '_blank')
    },
  },
  {
    id: 'user_account-twitter',
    title: '(formerly Twitter)',
    icon: 'twitter',
    parent: 'user',
    section: 'Community',
    handler: () => {
      window.open('https://twitter.com/NocoDB', '_blank')
    },
  },
  {
    id: 'user_account-reddit',
    title: 'Reddit',
    icon: 'reddit',
    parent: 'user',
    section: 'Community',
    handler: () => {
      window.open('https://www.reddit.com/r/NocoDB/', '_blank')
    },
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
    + bases (Projects)
    * workspace (Workspace)
      + tables (Tables)
      + views (Views)
    * account_settings (Account Settings)
      * account_settings-users (Users)
        - account_settings-users-reset_password (Reset Password)
      - account_settings-tokens (Tokens)
*/
