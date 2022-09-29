import { enumColor as colors } from '@/components/project/spreadsheet/helpers/colors'

export default {
  computed: {
    colors() {
      return this.$store.state.settings.darkTheme ? colors.dark : colors.light
    },
    textColors() {
      return this.$store.state.settings.darkTheme ? colors.light : colors.dark
    }
  },
  methods: {
    getColor(i) {
      return this.colors[i % this.colors.length]
    },
    getTextColor(i) {
      return this.textColors[i % this.textColors.length]
    }
  }
}
