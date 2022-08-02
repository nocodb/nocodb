import { mount } from '@vue/test-utils'
import { expect, test } from 'vitest'
import Sponsors from './Sponsors.vue'
import { createVuetifyPlugin } from '~/plugins/vuetify'
import { createI18nPlugin } from '~/plugins/a.i18n'

const mountComponent = async (nav: boolean) => {
  const vuetify = createVuetifyPlugin()
  const i18n = await createI18nPlugin()

  const wrapper = mount(Sponsors, {
    global: {
      plugins: [vuetify, i18n],
    },
    props: {
      nav,
    },
  })

  return {
    wrapper,
    i18n,
  }
}

test('Sponsors component tests', async () => {
  const { wrapper, i18n } = await mountComponent(false)

  const image = await wrapper.get('img')

  expect(image.attributes('src')).toBe('/ants-leaf-cutter.jpeg')

  expect(wrapper.get('.v-card-title').text()).toBe(i18n.global.t('msg.info.sponsor.header'))

  expect(wrapper.get('.v-card-text').text()).toBe(i18n.global.t('msg.info.sponsor.message'))

  expect(wrapper.get('.v-btn').text()).toBe(i18n.global.t('activity.sponsorUs'))
})

test('Sponsors component tests in nav', async () => {
  const { wrapper, i18n } = await mountComponent(true)

  const image = await wrapper.get('img')

  expect(image.attributes('src')).toBe('/ants-leaf-cutter.jpeg')

  expect(wrapper.get('.v-btn').text()).toBe(i18n.global.t('activity.sponsorUs'))
})
