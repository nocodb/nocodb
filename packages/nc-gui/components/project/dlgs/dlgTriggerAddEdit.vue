<template>
  <v-row  justify="center">
    <v-dialog
      persistent
      @keydown.esc="mtdDialogCancel()"
      @click:outside="mtdDialogCancel()"
      @keydown.enter="mtdDialogSubmit(trigger, newTrigger)"
      v-model="dialogShow"
      max-width="850"
      ><template v-slot:activator="{ on }">
        <p class="hidden" v-on="on"></p>
      </template>
      <v-card class="elevation-20">
        <v-card-title class="grey darken-2 subheading" style="height:30px">
          <!-- {{
            this.newTrigger
              ? "Add New Trigger"
              : "Editing Trigger " + this.trigger.trigger_name
          }} -->
        </v-card-title>
        <v-card-text class="pt-4 pl-4">
          <p class="headline">
            {{
              this.newTrigger
                ? "Add New Trigger"
                : "Editing Trigger " + this.trigger.trigger_name
            }}
          </p>
          <v-form ref="form" v-model="valid">
            <v-text-field
              ref="focus"
              v-model="trigger.trigger_name"
              :counter="50"
              label="Trigger Name"
              :rules="formRules.trigger_name"
              required
            ></v-text-field>
            <v-row justify="space-between">
              <v-col class="pa-1" cols="6" >
                <v-autocomplete
                  label="Timing"
                  :full-width="false"
                  v-model="trigger.timing"
                  :items="triggerTimingOptions"
                  :rules="formRules.timing"
                  required
                  dense
                ></v-autocomplete></v-col
              ><v-col class="pa-1" cols="6" >
                <v-autocomplete
                  label="Event"
                  :full-width="false"
                  v-model="trigger.event"
                  :items="triggerEventOptions"
                  :rules="formRules.event"
                  required
                  dense
                ></v-autocomplete></v-col
            ></v-row>
          </v-form>
          <v-container>
            <MonacoEditor
              v-if="trigger.statement != undefined"
              :code.sync="trigger.statement"
              cssStyle="border:1px solid grey;height:300px"
            />
          </v-container>
        </v-card-text>
        <v-divider></v-divider>

        <v-card-actions class="pa-4">
          <v-spacer></v-spacer>
          <v-btn class="" @click="mtdDialogCancel()">
            Cancel
          </v-btn>
          <v-btn
            class="primary "
            @click="mtdDialogSubmit(trigger, newTrigger)"
            :disabled="!valid"
            ><u class="shortkey">S</u>ubmit</v-btn
          >
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-row>
</template>

<script>
import { mapGetters, mapActions } from "vuex";
import MonacoEditor from "../../monaco/Monaco";

export default {
  components: { MonacoEditor },
  data() {
    return {
      valid: false,
      formRules: {
        trigger_name: [
          v => !!v || "Name is required",
          v => (v && v.length <= 100) || "Name must be less than 100 characters"
        ],
        timing: [v => !!v || "Timing is required"],
        event: [v => !!v || "Event is required"],
        statement: [v => !!v || "Statement is required"]
      },
      triggerTimingOptions: ["BEFORE", "AFTER"],
      triggerEventOptions: ["INSERT", "UPDATE", "DELETE"],
      trigger: {
        tn: this.nodes.tn,
        trigger_name: this.triggerObject.trigger || "",
        timing: this.triggerObject.timing || "BEFORE",
        event: this.triggerObject.event || "INSERT",
        statement: this.triggerObject.statement || `BEGIN\n\nEND;`
      }
    };
  },
  methods: {},
  computed: { ...mapGetters({ sqlMgr: "sqlMgr/sqlMgr" }) },

  beforeCreated() {},
  async created() {},
  mounted() {
    requestAnimationFrame(() => {
      this.$refs.focus.focus();
    });
  },
  beforeDestroy() {},
  destroy() {},
  validate({ params }) {
    return true;
  },
  head() {
    return {};
  },
  props: [
    "nodes",
    "newTrigger",
    "triggerObject",
    "dialogShow",
    "mtdDialogCancel",
    "mtdDialogSubmit"
  ],
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
