import {defineConfig} from '@eloqnt/cli';

export default defineConfig({
  messages: {
    path: './lang/{code}',
    locales: 'infer',
    codes: {
      'bn-IN': 'bn_IN',
      'pt-BR': 'pt_BR'
    },
    sourceLocale: 'en',
    format: {
      codec: '@eloqnt/format-vue-i18n-json',
      extension: '.json'
    }
  }
});
