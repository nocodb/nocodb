import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'

import Sponsors from './Sponsors.vue'
import { createVuetifyPlugin } from '~/plugins/vuetify'
import { createI18nPlugin } from '~/plugins/i18n'

test('mount component', async () => {
  expect(Sponsors).toBeTruthy()

  const vuetify = createVuetifyPlugin()
  const i18n = await createI18nPlugin()

  const wrapper = mount(Sponsors, {
    global: {
      plugins: [vuetify],
      mocks: {
        $t: () => i18n.global.t,
      },
    },
    props: {
      nav: true,
    },
  })
})
