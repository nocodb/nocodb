export default defineNuxtConfig({
  imports: {
    dirs: [
      '../context',
      '../utils/**',
      '../lib',
      '../composables/**',
      '../store/**',
    ],
    imports: [
      { name: 'useI18n', from: 'vue-i18n' },
      { name: 'message', from: 'ant-design-vue/es' },
      { name: 'Modal', from: 'ant-design-vue/es' },
      { name: 'Empty', from: 'ant-design-vue/es' },
      { name: 'Form', from: 'ant-design-vue/es' },
      { name: 'useJwt', from: '@vueuse/integrations/useJwt' },
      { name: 'storeToRefs', from: 'pinia' },
    ],
  },
})
