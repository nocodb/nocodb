<template>
  <v-container class="text-center">
    <v-row>
      <v-col cols="12">
        <v-card v-for="u in users1" :key="u.users_id">
          <v-card-title primary-title>
            <router-link :to="{ path: '/user/admin/user/' + u.users_id }">
              {{ u.username }}
            </router-link>
            <v-btn color="info">
              {{ $t('general.edit') }}
            </v-btn>
            <v-btn color="error">
              {{ $t('general.delete') }}
            </v-btn>
          </v-card-title>
          <hr />
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
      users: this.$store.state.users,
    };
  },
  head() {
    return {};
  },
  computed: {
    users1() {
      // console.log(this.$store.state);
      return this.$store.state.creator.users;
    },
  },
  watch: {},
  created() {},
  mounted() {
    this.$store.dispatch('admin/ActGetUsers');
  },
  beforeDestroy() {},
  methods: {},
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
