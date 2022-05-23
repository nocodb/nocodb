<template>
  <section class="section container">
    <div class="box">
      <div class="box">
        <h3 class="title is-3">
          Connected social accounts (work in progress)
        </h3>
        <section v-if="isConnectedSocialAccount('facebook')" class="">
          <button class="button">
            facebook
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('google')" class="">
          <button class="button">
            google
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('twitter')" class="">
          <button class="button">
            twitter
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('linkedin')" class="">
          <button class="button">
            linkedin
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('paypal')" class="">
          <button class="button">
            paypal
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('github')" class="">
          <button class="button">
            github
          </button>
        </section>
      </div>
      <div class="box">
        <h3 class="title is-3">
          Unconnected social accounts (work in progress)
        </h3>
        <section v-if="isConnectedSocialAccount('facebook')" class="">
          <button class="button">
            facebook
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('google')" class="">
          <button class="button">
            google
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('twitter')" class="">
          <button class="button">
            twitter
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('linkedin')" class="">
          <button class="button">
            linkedin
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('paypal')" class="">
          <button class="button">
            paypal
          </button>
        </section>
        <section v-if="isConnectedSocialAccount('github')" class="">
          <button class="button">
            github
          </button>
        </section>
      </div>
    </div>
  </section>
</template>

<script>
export default {
  directives: {},
  components: {},
  validate({ params }) {
    return true
  },
  props: {},
  data() {
    return {}
  },
  head() {
    return {}
  },
  computed: {},
  watch: {},
  created() {
  },
  mounted() {
  },
  beforeDestroy() {
  },
  methods: {
    hasConnectedAdditionalSocialAccounts() {

    },
    removeUserSocialAccount() {

    },
    isConnectedSocialAccount(social) {
      return true
    }
  },
  beforeCreated() {
  },
  destroy() {
  }
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
