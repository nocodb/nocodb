import themes from '../helpers/themes'

export default async({
  store,
  $vuetify: { theme },
  route
}) => {
  const themeUpdated = localStorage.getItem('themeUpdated')

  if (!themeUpdated) {
    store.commit('settings/MutToggleDarkModeAppBar', false)
    await store.dispatch('settings/ActSetTheme', {
      theme: { ...themes.DefaultFinn },
      themeName: 'DefaultFinn'
    })
    localStorage.setItem('themeUpdated', 'true')
  }
}
