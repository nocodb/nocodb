<template>
  <v-app>
    <v-app-bar
      class="elevation-0"
      color="primary"
      app
      clipped-left
      dense
      dark
      height="40"
    >
      <v-toolbar-title>
        <v-tooltip bottom>
          <template #activator="{ on }">
            <v-btn
              to="/projects"
              icon class="pa-1 brand-icon nc-noco-brand-icon"
              v-on="on"
            >
              <v-img :src="require('~/assets/img/icons/512x512-trans.png')" max-height="30px" max-width="30px" />
            </v-btn>
          </template>
          NocoDB Home
        </v-tooltip>
        <template v-if="!isDashboard">
          <span class="title"> Noco Cloud</span>
        </template>
      </v-toolbar-title>
    </v-app-bar>

    <v-main class="primary">
      <v-container fluid style="">
        <v-card class="card">
          <nuxt />
        </v-card>
      </v-container>
    </v-main>
  </v-app>
</template>

<script>
export default {
  name: 'Public'
}
</script>

<style scoped>
.card{
  min-height: calc(100vh - 64px);
}
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
