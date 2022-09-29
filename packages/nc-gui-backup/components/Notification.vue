<template>
  <v-menu offset-y :close-on-content-click="false" class="">
    <!--        notification button -->

    <template #activator="{ on }">
      <div class="d-flex align-center ml-4 justify-center">
        <v-badge v-if="GetHasErrors && !GetPendingStatus" color="red" overlap bottom>
          <template #badge>
            <v-icon v-ripple="{ class: 'nc-ripple' }" size="10" v-on="on"> mdi-exclamation </v-icon>
          </template>
          <v-icon v-ripple="{ class: 'nc-ripple' }" size="20" class="nc-menu-alert" v-on="on"> mdi-bell-ring </v-icon>
        </v-badge>
        <v-icon v-else v-ripple="{ class: 'nc-ripple' }" size="20" class="nc-menu-alert" v-on="on">
          mdi-bell-ring
        </v-icon>
        <v-progress-circular
          v-if="GetPendingStatus"
          style="position: absolute"
          :width="3"
          size="30"
          color="orange"
          indeterminate
        />
      </div>
    </template>

    <v-list v-if="notificationList.length" style="max-height: 250px; overflow-y: auto">
      <div v-for="item in notificationList" :key="item.time">
        <v-list-item>
          <v-list-item-avatar size="30">
            <v-progress-circular v-if="item.status === 'pending'" :width="3" size="30" color="orange" indeterminate />
            <v-icon v-else v-ripple="{ class: 'nc-ripple' }" size="20" :class="notificationIcons[item.status].class">
              {{ notificationIcons[item.status].icon }}
            </v-icon>
          </v-list-item-avatar>

          <v-list-item-content>
            <v-list-item-title>
              {{ item.type }}
              <b>"{{ item.module }}.{{ item.title }}"</b>{{ notificationIcons[item.status].message }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ timeDifference(item.time) }}</v-list-item-subtitle>
          </v-list-item-content>
        </v-list-item>
        <v-divider />
      </div>
    </v-list>
    <v-list>
      <v-list-item v-if="notificationList.length" style="min-height: 30px">
        <a class="text-center mb-0" style="width: 100%; min-width: 200px" @click.prevent="clearNotification">{{
          $t('msg.info.notifications.clear')
        }}</a>
      </v-list-item>
      <v-list-item v-else>
        <v-list-item-content>
          <v-list-item-subtitle class="px-3">
            {{ $t('msg.info.notifications.no_new') }}
          </v-list-item-subtitle>
        </v-list-item-content>
      </v-list-item>
    </v-list>
  </v-menu>
</template>

<script>
import { mapGetters } from 'vuex';

export default {
  name: 'Notification',
  computed: {
    ...mapGetters({
      GetHasErrors: 'notification/GetHasErrors',
      GetPendingStatus: 'notification/GetPendingStatus',
    }),
    notificationList() {
      return this.$store.state.notification.list;
    },
  },
  filters: {
    capitalize(value) {
      if (!value) {
        return '';
      }
      value = value.toString();
      return value.charAt(0).toUpperCase() + value.slice(1);
    },
  },
  data() {
    return {
      notificationIcons: {
        success: {
          message: ' successful',
          class: 'success',
          icon: 'mdi-check-circle',
        },
        error: {
          message: ' failed',
          class: 'error',
          icon: 'mdi-cloud-alert',
        },
        pending: {
          message: ' pending',
          class: 'success',
          icon: 'mdi-check-circle',
        },
      },
    };
  },
  methods: {
    timeDifference(previous) {
      const current = Date.now();
      const msPerMinute = 60 * 1000;
      const msPerHour = msPerMinute * 60;
      const msPerDay = msPerHour * 24;
      const msPerMonth = msPerDay * 30;
      const msPerYear = msPerDay * 365;

      const elapsed = current - previous;

      if (elapsed < msPerMinute) {
        return Math.round(elapsed / 1000) + ' seconds ago';
      } else if (elapsed < msPerHour) {
        return Math.round(elapsed / msPerMinute) + ' minutes ago';
      } else if (elapsed < msPerDay) {
        return Math.round(elapsed / msPerHour) + ' hours ago';
      } else if (elapsed < msPerMonth) {
        return 'approximately ' + Math.round(elapsed / msPerDay) + ' days ago';
      } else if (elapsed < msPerYear) {
        return 'approximately ' + Math.round(elapsed / msPerMonth) + ' months ago';
      } else {
        return 'approximately ' + Math.round(elapsed / msPerYear) + ' years ago';
      }
    },
    clearNotification() {
      this.$store.commit('notification/MutListClearFinished');
    },
  },
};
</script>

<style scoped></style>
<!--
/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Naveen MR <oof1lab@gmail.com>
 * @author Pranav C Balan <pranavxc@gmail.com>
 * @author Alejandro Moreno <info@pixplix.com>
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
