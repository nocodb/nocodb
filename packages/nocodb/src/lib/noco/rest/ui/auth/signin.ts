export default `<!DOCTYPE html>
<html>
<head>
    <title>Welcome to Vue</title>
    <link href="https://fonts.googleapis.com/css?family=Roboto:100,300,400,500,700,900" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/@mdi/font@5.x/css/materialdesignicons.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/vuetify@2.x/dist/vuetify.min.css" rel="stylesheet">
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, minimal-ui">

    <script src="https://unpkg.com/vue"></script>
</head>
<body>
<div id="app">
    <v-app>
        <v-container>
            <v-row class="justify-center">
                <v-col class="col-12 col-md-6">
                    <v-form ref="form" v-model="validForm" ref="formType" class="ma-auto"
                            lazy-validation>


                        <v-text-field
                                name="input-10-2"
                                label="email"
                                type="email"
                                v-model="formdata.email"
                                :rules="[v => !!v ||  'Email is required']"
                        ></v-text-field>

                        <v-text-field
                                name="input-10-2"
                                type="password"
                                label="Password"
                                v-model="formdata.password"
                                :rules="[v => !!v ||  'Password is required']"
                        ></v-text-field>

                        <v-btn
                                :disabled="!validForm"
                                large
                                @click="signin"
                        >
                            Sign In
                        </v-btn>

                    </v-form>

                    <br>
                    <pre style="overflow: auto" v-if="success" v-html="success"></pre>
                    <v-alert v-else-if="errMsg" type="error">
                        {{errMsg}}
                    </v-alert>


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
      validForm: false,
      greeting: 'Password Reset',
      formdata: {
        password: '',
        newPassword: ''
      },
      success: false,
      errMsg: null
    },
    methods: {
      async signin() {
        if (this.$refs.form.validate()) {
          try {
            const res = await axios.post('<%- baseUrl %>auth/signin', this.formdata);
            this.success = res.data;
          } catch (e) {
            if (e.response && e.response.data && e.response.data.msg) {
              this.errMsg = e.response.data.msg;
            } else {
              this.errMsg = 'Some error occurred';
            }
          }
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
