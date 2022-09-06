<template>
  <v-container>
    <v-row>
      <v-col cols="12">
        <v-card class="pa-5">
          <v-form ref="formType" v-model="valid" lazy-validation>
            <v-text-field v-model="user.username" label="username" disabled />

            <v-text-field v-model="user.firstName" label="firstName" disabled />

            <v-text-field v-model="user.lastName" label="lastName" disabled />

            <v-text-field v-model="user.provider" label="provider" disabled />

            <v-text-field v-model="user.roles" label="roles" disabled />

            <v-btn color="primary" @click="editUser">
              {{ $t('general.edit') }}
            </v-btn>

            <v-btn color="red" @click="removeUser">
              {{ $t('general.delete') }}
            </v-btn>
          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
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
      user: {
        username: '',
        _id: 0,
        firstName: '',
        lastName: '',
        email: '',
        provider: '',
        created: '',
        roles: [],
      },
      valid: true,
    };
  },
  head() {
    return {};
  },
  computed: {},
  watch: {},
  created() {},
  async mounted() {
    // console.log('routeparams',this.$route.params);
    const user = await this.$store.dispatch('users/ActGetUser', this.$route.params.userId);

    if ('username' in user) {
      this.user = user;
    }

    // console.log(this.user);
  },
  beforeDestroy() {},
  methods: {
    removeUser() {
      // console.log('remove user');
    },
    editUser(args) {
      // console.log('edit user');
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
