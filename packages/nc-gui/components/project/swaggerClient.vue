<template>
  <v-container fluid style="height: 100%" class="py-0">
    <v-row style="height: 100%">
      <v-col cols="12" class="py-1">
        <div>
          <v-text-field
            class=""
            outlined
            solo-inverted
            single-line
            dense
            rounded
            hide-details
            v-model="url"
            label="Graphql Url"
            @keypress.enter="loadUrl"
          >
            <template v-slot:append-outer>
              <x-btn icon="mdi-graphql" btn.class="mt-n1" tooltip="Load graphql schema" color="primary"
                     @click="loadUrl">Load
              </x-btn>
            </template>

          </v-text-field>
        </div>
      </v-col>
      <v-col cols="12" class="py-0 px-5" style="width: 100%;height: calc(100% - 52px)">
        <iframe v-shortkey="['ctrl','shift','w']" @shortkey="test" class="white" :src="webViewUrl" ref="webview"
                id="foo" style="width: 100%;height: 100%"></iframe>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
export default {
  name: "swaggerClient",
  data() {
    return {
      url: '',
      webViewUrl: ''
    }
  },
  methods: {
    test() {
      console.log('triggerd')
    },
    loadUrl() {
      this.webViewUrl = this.url;
      // if (this.url)
      //   this.$store.commit('graphqlClient/MutListAdd', {url: this.url});
    },
  },
  async created() {
    // if (this.$store.state.graphqlClient.list && this.$store.state.graphqlClient.list[0])
    //   this.webViewUrl = this.url = this.$store.state.graphqlClient.list[0].url;
    try {
      const {info} = (await this.$axios.get(`/nc/${this.$route.params.project_id}/projectApiInfo`, {
        headers: {
          'xc-auth': this.$store.state.users.token
        }
      })).data;
      const swagger = Object.values(info).find(v => v.swaggerUrl);
      if (swagger) {
        this.webViewUrl = this.url = swagger.swaggerUrl
      }
    } catch (e) {
    }
  },
  mounted() {

  }

}
</script>

<style scoped>

</style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 *
 * @license GNU AGPL version 3 or any later version
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <http://www.gnu.org/licenses/>.
 *
 */
-->
