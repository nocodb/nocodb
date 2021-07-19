import { enumColor as colors } from '@/components/project/spreadsheet/helpers/colors'

export default {
  computed: {
    colors() {
      return this.$store.state.windows.darkTheme ? colors.dark : colors.light
    },
    textColors() {
      return this.$store.state.windows.darkTheme ? colors.light : colors.dark
    }
  }
}
