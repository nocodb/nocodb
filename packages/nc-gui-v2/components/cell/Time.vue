<script setup lang="ts">
import { inject } from 'vue'

const editEnabled = inject<boolean>('editEnabled')
</script>

<template>
  <v-menu>
    <template #activator="{ on }">
      <input v-model="localState" class="value" v-on="on" />
    </template>
    <div class="d-flex flex-column justify-center" @click.stop>
      <v-time-picker v-model="localState" v-on="parentListeners" />
      <v-btn small color="primary" @click="$emit('save')">
        <!-- Save -->
        {{ $t('general.save') }}
      </v-btn>
    </div>
  </v-menu>
</template>

<style scoped>
.value {
  width: 100%;
  min-height: 20px;
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
