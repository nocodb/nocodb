<template>
  <section class="section container">
    <div v-if="$store.state.users.user !== null" class="box">
      <div class="field">
        <div class="control">
          <label class="label">firstname</label>
          <input id="firstname" v-model="form.firstName" class="input" type="text" placeholder="firstname" />
        </div>
      </div>

      <div class="field">
        <div class="control">
          <label class="label">lastname</label>
          <input id="lastname" v-model="form.lastName" class="input" type="text" placeholder="lastname" />
        </div>
      </div>

      <div class="field is-grouped">
        <div class="control">
          <button class="button is-link" @click="updateUserProfile">Submit</button>
        </div>
        <div class="control">
          <button class="button is-text">
            <!-- Cancel -->
            {{ $t('general.cancel') }}
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  directives: {},
  components: {},
  validate({ params }) {
    return true;
  },
  props: {},
  data() {
    return {
      form: {
        firstName: null,
        lastName: null,
      },
    };
  },
  head() {
    return {};
  },
  computed: {},
  watch: {},
  created() {},
  mounted() {
    if (this.$store.state.users.user) {
      // console.log('update user profile',this.$store.state);
      this.form.firstName = this.$store.state.users.user.firstName;
      this.form.lastName = this.$store.state.users.user.firstName;
    }
  },
  beforeDestroy() {},
  methods: {
    updateUserProfile() {
      // console.log('update user profile',this.$store.user);
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
