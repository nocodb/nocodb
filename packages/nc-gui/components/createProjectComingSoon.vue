<template>
  <v-expansion-panels
    focusable
    accordion=""
    class="elevation-20"
    style="border: 1px solid grey"
  >
    <v-expansion-panel>
      <v-expansion-panel-header disable-icon-rotate>
        <div>
          <v-icon color="grey darken-1">
            mdi-timer-sand
          </v-icon> &nbsp;
          <span class="grey--text text--darken-1">Coming Soon</span>
        </div>
      </v-expansion-panel-header>

      <v-expansion-panel-content>
        <v-row>
          <v-col v-for="(item,i) in items" :key="i" cols="4">
            <v-card class="card">
              <div
                class="white--text d-flex flex-column card-header"
                :style="{ background: item.background,height:'200px'}"
              >
                <div class="card-icon d-flex flex-grow-1 align-center justify-center">
                  <!--                  <v-icon size="80px">mdi-account-group</v-icon>-->
                </div>
                <v-card-title v-text="item.title" />
              </div>
              <v-card-text class="align-self-end" v-text="item.description" />
            </v-card>
          </v-col>
        </v-row>
      </v-expansion-panel-content>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script>
export default {
  name: 'CreateProjectComingSoon',
  data: () => ({
    items: [
      {
        background: 'linear-gradient(#6458bf1a, #110dec80)',
        title: 'Social Login',
        description: 'Facebook/Google login for the application'
      },
      {
        background: 'linear-gradient(#6458bf1a, #ff5200cc)',
        title: 'Push Notification',
        description: 'Google Firebase based cloud messaging service'
      },
      {
        background: 'linear-gradient(rgba(100, 88, 191, 0.1), #4caf50)',
        title: 'Cron Jobs',
        description: 'Scheduled asynchronous Background/cron jobs'
      },
      {
        background: 'linear-gradient(rgba(100, 88, 191, 0.1), rgb(236 13 13 / 50%))',
        title: 'Cloud Storage',
        description: 'Cloud based file storage like S3'
      },
      {
        background: 'linear-gradient(rgba(100, 88, 191, 0.1), #252526)',
        title: 'Cache',
        description: 'Caching for optimizing speed'
      }

    ]
  })
}
</script>

<style scoped lang="scss">
.card {
  //.card-header{
  //  position: relative;
  //  .card-icon{
  //    position: absolute;
  //    width:80px;
  //    height:80px;
  //    right:0;
  //    left: 0;
  //    top:10px;
  //  }
  //}
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
