<template>
  <div>
    <v-menu top offset-y>
      <template #activator="{on}">
        <v-icon size="20" class="ml-2 nc-menu-translate" v-on="on">
          mdi-translate
        </v-icon>
      </template>
      <v-list dense class="nc-language-list">
        <v-list-item-group
          v-model="language"
        >
          <v-list-item
            v-for="lan in languages"
            :key="lan.value"
            dense
            :value="lan"
            color="primary"
            @click="changeLan(lan)"
          >
            <v-list-item-subtitle class="text-capitalize">
              {{ labels[lan] || lan }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list-item-group>
        <v-divider />
        <v-list-item>
          <a href="https://github.com/nocodb/nocodb/tree/master/packages/nc-gui/lang" target="_blank" class="caption">
            <!--Help translate-->
            {{ $t('activity.translate') }}
          </a>
        </v-list-item>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
export default {
  name: 'Language',
  data: () => ({
    labels: {
      de: 'Deutsch',
      en: 'English',
      es: 'Español',
      fa: 'فارسی',
      fr: 'Français',
      id: 'Bahasa Indonesia',
      ja: '日本語',
      it_IT: 'Italiano',
      ko: '한국인',
      lv: 'Latviešu',
      nl: 'Nederlandse',
      ru: 'Pусский',
      zh_CN: '大陆简体',
      zh_HK: '香港繁體',
      zh_TW: '臺灣正體',
      sv: 'Svenska',
      tr: 'Turkish',
      da: 'Dansk',
      vi: 'Tiếng Việt',
      no: 'Norsk',
      iw: 'עִברִית',
      fi: 'Suomalainen',
      uk: 'Українська',
      hr: 'Hrvatski',
      th: 'ไทย',
      sl: 'Slovenščina',
      pt_BR: 'Português (Brasil)'
    }
  }),
  computed: {
    languages() {
      return ((this.$i18n && this.$i18n.availableLocales) || ['en']).sort()
    },
    language: {
      get() {
        return this.$store.state.windows.language
      },
      set(val) {
        this.$store.commit('windows/MutLanguage', val)
        this.applyDirection()
      }
    }
  },
  mounted() {
    this.applyDirection()
  },
  methods: {
    applyDirection() {
      document.body.style.direction = this.isRtlLang() ? 'rtl' : 'ltr'
    },
    isRtlLang() {
      return ['fa'].includes(this.language)
    },
    changeLan(lan) {
      this.language = lan
      const count = 200
      const defaults = {
        origin: { y: 0.7 }
      }

      function fire(particleRatio, opts) {
        window.confetti(Object.assign({}, defaults, opts, {
          particleCount: Math.floor(count * particleRatio)
        }))
      }

      fire(0.25, {
        spread: 26,
        startVelocity: 55
      })
      fire(0.2, {
        spread: 60
      })
      fire(0.35, {
        spread: 100,
        decay: 0.91,
        scalar: 0.8
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 25,
        decay: 0.92,
        scalar: 1.2
      })
      fire(0.1, {
        spread: 120,
        startVelocity: 45
      })
      this.$tele.emit(`toolbar:lang:${lan}`)
    }
  }
}
</script>

<style scoped lang="scss">
::v-deep {
  .nc-language-list {
    max-height: 90vh;
    overflow: auto;
     .v-list-item{
      min-height: 30px !important;
    }
  }
}
</style>
