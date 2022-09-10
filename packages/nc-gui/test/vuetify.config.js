/** fix issue with testing: https://github.com/vuetifyjs/vuetify/issues/14749 */
global.CSS = { supports: () => false }
