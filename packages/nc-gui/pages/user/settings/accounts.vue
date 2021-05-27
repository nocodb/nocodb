<template>

  <section class="section container">
    <div class="box">
      <div class="box">
        <h3 class="title is-3">Connected social accounts (work in progress)</h3>
        <section class="" v-if="isConnectedSocialAccount('facebook')">
          <button class="button">facebook</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('google')">
          <button class="button">google</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('twitter')">
          <button class="button">twitter</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('linkedin')">
          <button class="button">linkedin</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('paypal')">
          <button class="button">paypal</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('github')">
          <button class="button">github</button>
        </section>
      </div>
      <div class="box">
        <h3 class="title is-3">Unconnected social accounts (work in progress)</h3>
        <section class="" v-if="isConnectedSocialAccount('facebook')">
          <button class="button">facebook</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('google')">
          <button class="button">google</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('twitter')">
          <button class="button">twitter</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('linkedin')">
          <button class="button">linkedin</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('paypal')">
          <button class="button">paypal</button>
        </section>
        <section class="" v-if="isConnectedSocialAccount('github')">
          <button class="button">github</button>
        </section>
      </div>

    </div>
  </section>

  <!--<div align="center">-->


    <!--&lt;!&ndash;<h1>user.accounts</h1>&ndash;&gt;-->
    <!--&lt;!&ndash;<section class="row">&ndash;&gt;-->
      <!--&lt;!&ndash;<h3 class="col-md-12 text-center" ng-show="hasConnectedAdditionalSocialAccounts()">Connected social accounts:</h3>&ndash;&gt;-->
      <!--&lt;!&ndash;<div class="col-md-12 text-center">&ndash;&gt;-->
        <!--&lt;!&ndash;&lt;!&ndash;<div ng-repeat="(providerName, providerData) in user.additionalProvidersData" class="social-account-container">&ndash;&gt;&ndash;&gt;-->
        <!--&lt;!&ndash;&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/{{providerName}}.png">&ndash;&gt;&ndash;&gt;&ndash;&gt;-->
        <!--&lt;!&ndash;&lt;!&ndash;<a class="btn btn-danger btn-raised btn-remove-account" ng-click="removeUserSocialAccount(providerName)">&ndash;&gt;&ndash;&gt;-->
        <!--&lt;!&ndash;&lt;!&ndash;<i class="glyphicon glyphicon-trash"></i>&ndash;&gt;&ndash;&gt;-->
        <!--&lt;!&ndash;&lt;!&ndash;</a>&ndash;&gt;&ndash;&gt;-->
        <!--&lt;!&ndash;&lt;!&ndash;</div>&ndash;&gt;&ndash;&gt;-->
      <!--&lt;!&ndash;</div>&ndash;&gt;-->
      <!--&lt;!&ndash;<h3 class="col-md-12 text-center" ng-show="hasConnectedAdditionalSocialAccounts()">&ndash;&gt;-->
        <!--&lt;!&ndash;Unconnected social accounts:</h3>&ndash;&gt;-->
      <!--&lt;!&ndash;<div class="col-md-12 text-center">&ndash;&gt;-->
        <!--&lt;!&ndash;<div class="social-account-container" ng-hide="isConnectedSocialAccount('facebook')">&ndash;&gt;-->
          <!--&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/facebook.png">&ndash;&gt;&ndash;&gt;-->
          <!--&lt;!&ndash;<a class="btn btn-success btn-raised btn-remove-account" href="/api/auth/facebook" target="_self">&ndash;&gt;-->
            <!--&lt;!&ndash;<i class="glyphicon glyphicon-plus">Facebook</i>&ndash;&gt;-->
          <!--&lt;!&ndash;</a>&ndash;&gt;-->
        <!--&lt;!&ndash;</div>&ndash;&gt;-->
        <!--&lt;!&ndash;<div class="social-account-container" ng-hide="isConnectedSocialAccount('twitter')">&ndash;&gt;-->
          <!--&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/twitter.png">&ndash;&gt;&ndash;&gt;-->
          <!--&lt;!&ndash;<a class="btn btn-success btn-raised btn-remove-account" href="/api/auth/twitter" target="_self">&ndash;&gt;-->
            <!--&lt;!&ndash;<i class="glyphicon glyphicon-plus">twitter</i>&ndash;&gt;-->
          <!--&lt;!&ndash;</a>&ndash;&gt;-->
        <!--&lt;!&ndash;</div>&ndash;&gt;-->
        <!--&lt;!&ndash;<div class="social-account-container" ng-hide="isConnectedSocialAccount('google')">&ndash;&gt;-->
          <!--&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/google.png">&ndash;&gt;&ndash;&gt;-->
          <!--&lt;!&ndash;<a class="btn btn-success btn-raised btn-remove-account" href="/api/auth/google" target="_self">&ndash;&gt;-->
            <!--&lt;!&ndash;<i class="glyphicon glyphicon-plus">google</i>&ndash;&gt;-->
          <!--&lt;!&ndash;</a>&ndash;&gt;-->
        <!--&lt;!&ndash;</div>&ndash;&gt;-->
        <!--&lt;!&ndash;<div class="social-account-container" ng-hide="isConnectedSocialAccount('linkedin')">&ndash;&gt;-->
          <!--&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/linkedin.png">&ndash;&gt;&ndash;&gt;-->
          <!--&lt;!&ndash;<a class="btn btn-success btn-raised btn-remove-account" href="/api/auth/linkedin" target="_self">&ndash;&gt;-->
            <!--&lt;!&ndash;<i class="glyphicon glyphicon-plus">linkedin</i>&ndash;&gt;-->
          <!--&lt;!&ndash;</a>&ndash;&gt;-->
        <!--&lt;!&ndash;</div>&ndash;&gt;-->
        <!--&lt;!&ndash;<div class="social-account-container" ng-hide="isConnectedSocialAccount('github')">&ndash;&gt;-->
          <!--&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/github.png">&ndash;&gt;&ndash;&gt;-->
          <!--&lt;!&ndash;<a class="btn btn-success btn-raised btn-remove-account" href="/api/auth/github" target="_self">&ndash;&gt;-->
            <!--&lt;!&ndash;<i class="glyphicon glyphicon-plus">github</i>&ndash;&gt;-->
          <!--&lt;!&ndash;</a>&ndash;&gt;-->
        <!--&lt;!&ndash;</div>&ndash;&gt;-->
        <!--&lt;!&ndash;<div class="social-account-container" ng-hide="isConnectedSocialAccount('paypal')">&ndash;&gt;-->
          <!--&lt;!&ndash;&lt;!&ndash;<img ng-src="/modules/users/client/img/buttons/paypal.png">&ndash;&gt;&ndash;&gt;-->
          <!--&lt;!&ndash;<a class="btn btn-success btn-raised btn-remove-account" href="/api/auth/paypal" target="_self">&ndash;&gt;-->
            <!--&lt;!&ndash;<i class="glyphicon glyphicon-plus">paypal</i>&ndash;&gt;-->
          <!--&lt;!&ndash;</a>&ndash;&gt;-->
        <!--&lt;!&ndash;</div>&ndash;&gt;-->
      <!--&lt;!&ndash;</div>&ndash;&gt;-->
    <!--&lt;!&ndash;</section>&ndash;&gt;-->

  <!--</div>-->
</template>

<script>
  export default {
    data() {
      return {}
    },
    computed: {},
    methods: {
      hasConnectedAdditionalSocialAccounts() {

      },
      removeUserSocialAccount() {

      },
      isConnectedSocialAccount(social) {
        return true;
      }
    },
    beforeCreated() {
    },
    created() {
    },
    mounted() {
    },
    beforeDestroy() {
    },
    destroy() {
    },
    validate({params}) {
      return true
    },
    head() {
      return {}
    },
    props: {},
    watch: {},
    directives: {},
    components: {}
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
