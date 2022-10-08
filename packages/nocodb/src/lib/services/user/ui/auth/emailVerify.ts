export default `<!DOCTYPE html>
<html>
<head>
    <title>NocoDB - Verify Email</title>
    <link href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@mdi/font@5.x/css/materialdesignicons.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.min.css" rel="stylesheet">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">

    <script src="https://cdnjs.cloudflare.com/ajax/libs/vue/2.6.14/vue.min.js" integrity="sha512-XdUZ5nrNkVySQBnnM5vzDqHai823Spoq1W3pJoQwomQja+o4Nw0Ew1ppxo5bhF2vMug6sfibhKWcNJsG8Vj9tg==" crossorigin="anonymous" referrerpolicy="no-referrer"></script>
</head>
<body>
<div id="app">
    <v-app>
    <v-container>
        <v-row class="justify-center">
            <v-col class="col-12 col-md-6">
                <v-alert v-if="valid" type="success">
                    Email verified successfully!
                </v-alert>
                <v-alert v-else-if="errMsg" type="error">
                    {{errMsg}}
                </v-alert>

                <template v-else>

                    <v-skeleton-loader type="heading"></v-skeleton-loader>

                </template>
            </v-col>
        </v-row>
    </v-container>
    </v-app>
</div>
<script src="https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.js"></script>
<script src="https://cdnjs.cloudflare.com/ajax/libs/axios/0.19.2/axios.min.js"></script>

<script>
  var app = new Vue({
    el: '#app',
    vuetify: new Vuetify(),
    data: {
      valid: null,
      errMsg: null,
      validForm: false,
      token: <%- token %>,
      greeting: 'Password Reset',
      formdata: {
        password: '',
        newPassword: ''
      },
      success: false
    },
    methods: {},
    async created() {
      try {
        const valid = (await axios.post('<%- baseUrl %>/api/v1/auth/email/validate/' + this.token)).data;
        this.valid = !!valid;
      } catch (e) {
        this.valid = false;
        if(e.response && e.response.data && e.response.data.msg){
          this.errMsg = e.response.data.msg;
        }else{
          this.errMsg = 'Some error occurred';
        }
      }
    }
  })
</script>
</body>
</html>`;
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Wing-Kam Wong <wingkwong.code@gmail.com>
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
