<template>
  <v-container >
    <v-row  >
      <v-col cols="12">
        <v-card class="pa-5">
          <v-form v-model="valid" ref="formType" lazy-validation>
            <v-text-field
              label="username"
              v-model="user.username"
              disabled
            ></v-text-field>

            <v-text-field
              label="firstName"
              v-model="user.firstName"
              disabled
            ></v-text-field>

            <v-text-field
              label="lastName"
              v-model="user.lastName"
              disabled
            ></v-text-field>

            <v-text-field
              label="provider"
              v-model="user.provider"
              disabled
            ></v-text-field>

            <v-text-field
              label="roles"
              v-model="user.roles"
              disabled
            ></v-text-field>

            <v-btn @click="editUser" color="primary">
              Edit
            </v-btn>

            <v-btn @click="removeUser" color="red">
              Delete
            </v-btn>


          </v-form>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>

<script>
  export default {
    data() {
      return {
        user : {
          username :'',
          _id: 0,
          firstName: '',
          lastName: '',
          email: '',
          provider: '',
          created: '',
          roles: []
        },
        valid: true

      }
    },
    computed : {

    },
    methods : {
      removeUser(){
        //console.log('remove user');
      },
      editUser(args) {
        //console.log('edit user');
      }

    },
    beforeCreated () {},
    created () { },
    async mounted () {

      //console.log('routeparams',this.$route.params);
      let user = await this.$store.dispatch('users/ActGetUser',this.$route.params.userId)

      if ('username' in user){
        this.user = user;
      }

      //console.log(this.user);
    },
    beforeDestroy () {},
    destroy () {},
    validate({params}) { return true },
    head() { return {} },
    props: { },
    watch: { },
    directives : { },
    components : { }
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
