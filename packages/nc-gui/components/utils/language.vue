<template>
  <div>
    <v-menu bottom offset-y>
      <template #activator="{on}">
        <v-btn small class="text-capitalize caption font-weight-bold" text v-on="on">
          <v-icon small class="">
            mdi-translate
          </v-icon>
        </v-btn>
      </template>
      <v-list dense>
        <v-list-item-group
          v-model="language"
        >
          <v-list-item
            v-for="lan in languages"
            :key="lan.value"
            dense
            :value="lan"
            color="primary"
            @click="language = lan"
          >
            <v-list-item-subtitle class="text-capitalize">
              {{ lan }}
            </v-list-item-subtitle>
          </v-list-item>
        </v-list-item-group>
      </v-list>
    </v-menu>
  </div>
</template>

<script>
export default {
  name: 'Language',
  computed: {
    languages () {
      return (this.$i18n && this.$i18n.availableLocales) || ['en']
    },
    language: {
      get () {
        return this.$store.state.windows.language
      },
      set (val) {
        this.$store.commit('windows/MutLanguage', val)
      }
    }
  }
}
</script>

<style scoped>

</style>
