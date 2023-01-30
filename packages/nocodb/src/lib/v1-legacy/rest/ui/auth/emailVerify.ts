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
        const valid = (await axios.post('<%- baseUrl %>auth/email/validate/' + this.token)).data;
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
