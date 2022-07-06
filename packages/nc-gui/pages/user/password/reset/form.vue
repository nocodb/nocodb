<template>
  <section class="section container">
    <div class="box">
      <div class="field">
        <div class="control">
          <label class="label">newPassword</label>
          <input
            id="newPassword"
            v-model="passwordDetails.newPassword"
            class="input"
            type="password"
            placeholder="newPassword"
          />
        </div>
      </div>

      <div class="field">
        <div class="control">
          <label class="label">verifyPassword</label>
          <input
            id="verifyPassword"
            v-model="passwordDetails.verifyPassword"
            class="input"
            type="password"
            placeholder="verifyPassword"
          />
        </div>
      </div>

      <div class="field is-grouped">
        <div class="control">
          <button class="button is-link" @click="resetUserPassword">Submit</button>
        </div>
      </div>
    </div>

    <v-row>
      <v-col cols="6">
        <v-card class="pa-5">
          <v-form ref="formType" v-model="valid" lazy-validation>
            <v-text-field
              v-model="passwordDetails.newPassword"
              name="input-10-2"
              label="New password"
              :append-icon="e3 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e3 = !e3)"
              :rules="formRules.password"
              :type="e3 ? 'password' : 'text'"
            />

            <v-text-field
              v-model="passwordDetails.verifyPassword"
              name="input-10-2"
              label="Confirm new password"
              :append-icon="e3 ? 'visibility' : 'visibility_off'"
              :append-icon-cb="() => (e3 = !e3)"
              :rules="formRules.password"
              :type="e3 ? 'password' : 'text'"
            />

            <v-btn :disabled="!valid" @click="resetUserPassword"> submit </v-btn>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </section>
</template>

<script>
import { isEmail } from '@/helpers';

export default {
  directives: {},
  components: {},
  validate({ params }) {
    return true;
  },
  props: {},
  data() {
    return {
      passwordDetails: {
        newPassword: null,
        verifyPassword: null,
      },

      formRules: {
        email: [v => !!v || 'E-mail is required', v => isEmail(v) || 'E-mail must be valid'],
      },

      valid: true,
      e3: true,
      alert: true,
    };
  },
  head() {
    return {};
  },
  computed: {},
  watch: {},
  created() {},
  mounted() {},
  beforeDestroy() {},
  methods: {
    resetUserPassword() {
      // console.log('resetuserpassword');
    },
  },
  beforeCreated() {},
  destroy() {},
};
</script>

<style scoped></style>
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
