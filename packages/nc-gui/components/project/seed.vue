<template>
  <v-container class="ma-0 pa-0" fluid>
    <v-toolbar height="42" class="toolbar-border-bottom elevation-0">
      <v-breadcrumbs :items="[{
          text: this.nodes.env,
          disabled: true,
          href: '#'
        },{
          text: this.nodes.dbAlias,
          disabled: true,
          href: '#'
        }]" divider=">" small>
        <template v-slot:divider>
          <v-icon small color="grey lighten-2">forward</v-icon>
        </template>
      </v-breadcrumbs>

      <p class=" pt-3">
        Seed Database
      </p>

      <v-spacer></v-spacer>


      <x-btn small icon="mdi-numeric-1-circle" outlined @click="dialogShow = true" color="primary"> Seed Initialise</x-btn>
      <!--      <x-btn outlined @click="seedTerm" color="red"> Clear all tables</x-btn>-->
      <x-btn small  outlined @click="seedStart" icon="mdi-play" color="primary"> Start Seeding</x-btn>
      <x-btn small  outlined @click="seedStop" icon="mdi-stop"> Stop Seeding</x-btn>
      <x-btn small outlined @click="seedSettingsUpdate" :disabled="disableSaveButton" icon="save"> Save Settings</x-btn>
    </v-toolbar>

    <v-row class="mx-0">
      <v-col cols="8" offset="2">

        <v-simple-table class="ma-0 pa-0">
          <thead>
          <tr>
            <th class="text-left" width="20%">Key</th>
            <th class="text-left">Value</th>
          </tr>
          </thead>
          <tbody>
          <tr v-for="(value,key) in settings" :key="key">
            <td>{{key}}</td>
            <td>
              <v-text-field
                v-model="settings[key].value"
                :label="settings[key].description"
                hide-details
                type="number"
                step="1"
                @input="disableSaveButton = false"
              ></v-text-field>
<!--              <p class="caption">{{settings[key].description}}</p>-->
            </td>
          </tr>
          </tbody>
        </v-simple-table>
      </v-col>
    </v-row>

    <dlgLabelSubmitCancel
      v-if="dialogShow"
      :dialogShow="dialogShow"
      :actionsMtd="dlgAction"
      cssStyle="border:1px solid grey;height:300px"
      heading="This will recreate all the faker function mapping!"
      type="info"
    />

  </v-container>
</template>

<script>
  import {mapGetters} from "vuex";
  import dlgLabelSubmitCancel from "../utils/dlgLabelSubmitCancel";


  export default {
    components: {
      dlgLabelSubmitCancel: dlgLabelSubmitCancel
    },
    data() {
      return {
        settings: {},
        dialogShow: false,
        disableSaveButton: true
      };
    },
    computed: {
      ...mapGetters({sqlMgr: "sqlMgr/sqlMgr"}),
    },
    methods: {
      async dlgAction(action = "") {
        console.log('dlgAction', action);
        if (action === "hideDialog") {
          this.dialogShow = false;
        } else {
          this.dialogShow = false;
          await this.seedInit();
        }
      },
      async seedInit() {

        try {

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "seedInit",
            {
              seedsFolder: this.seedsFolder,
            }]);

          this.settings = result.data;

        } catch (e) {
          console.log(e);
          throw e;
        }

      },

      async seedTerm() {

        try {

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "seedTerm",
            {
              seedsFolder: this.seedsFolder,
            }]);
        } catch (e) {
          console.log(e);
          throw e;
        }

      },

      async seedStart() {

        try {

          setTimeout(async () => {
            let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
              {
                env: this.nodes.env,
                dbAlias: this.nodes.dbAlias
              },
              "seedStart",
              {
                seedsFolder: this.seedsFolder,
              }]);

          })
        } catch (e) {
          console.log(e);
          throw e;
        }

      },

      async seedStop() {

        try {

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
            {
              env: this.nodes.env,
              dbAlias: this.nodes.dbAlias
            },
            "seedStop",
            {
              seedsFolder: this.seedsFolder,
            }]);
        } catch (e) {
          console.log(e);
          throw e;
        }

      },

      async seedSettingsUpdate() {

        try {

          this.settings.rows.value = +this.settings.rows.value > 100 ? 100 : this.settings.rows.value;

          let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [{
            env: this.nodes.env,
            dbAlias: this.nodes.dbAlias
          }, "seedSettingsCreate", {
            seedsFolder: this.seedsFolder,
            settings: this.settings
          }]);
          this.disableSaveButton = true;
        } catch (e) {
          console.log(e);
          throw e;
        }

      }


    },

    beforeCreated() {
    },
    async created() {
      this.seedsFolder = this.sqlMgr.projectGetFolder({
        env: this.nodes.env,
        dbAlias: this.nodes.dbAlias
      });
      let result = await this.$store.dispatch('sqlMgr/ActSqlOpPlus', [
        {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        },
        "seedSettingsRead",
        {
          seedsFolder: this.seedsFolder,
        }]);

      if (!Object.keys(result.data).length) {
        await this.seedInit();
      } else {
        this.settings = result.data;
      }

    },
    mounted() {
    },
    beforeDestroy() {
    },
    destroy() {
    },
    validate({params}) {
      return true;
    },
    head() {
      return {};
    },
    props: ["nodes"],
    watch: {},
    directives: {}
  };
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
