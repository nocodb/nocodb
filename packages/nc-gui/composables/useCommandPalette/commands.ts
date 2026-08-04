import { getI18n } from '~/plugins/a.i18n'

export const getHomeCommands = () => [
  {
    id: 'user',
    title: getI18n().global.t('labels.account'),
    icon: 'account',
    section: 'Accounts',
  },
  {
    id: 'user_account-settings',
    title: getI18n().global.t('title.accountSettings'),
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
    title: getI18n().global.t('general.discord'),
    icon: 'discord',
    parent: 'user',
    section: 'Community',
    handler: () => {
      navigateTo('https://discord.gg/c7GEYrvFtT', { external: true })
    },
  },
  {
    id: 'user_account-twitter',
    title: '(formerly Twitter)',
    icon: 'twitter',
    parent: 'user',
    section: 'Community',
    handler: () => {
      navigateTo('https://twitter.com/NocoDB', { external: true })
    },
  },
  {
    id: 'user_account-reddit',
    title: 'Reddit',
    icon: 'reddit',
    parent: 'user',
    section: 'Community',
    handler: () => {
      navigateTo('https://www.reddit.com/r/NocoDB/', { external: true })
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
    + workspaces (Workspaces - EE)
    + bases (Projects)
    * workspace (Workspace - EE)
      + tables (Tables)
      + views (Views)
    * account_settings (Account Settings)
      * account_settings-users (Users)
        - account_settings-users-reset_password (Reset Password)
      - account_settings-tokens (Tokens)
*/
