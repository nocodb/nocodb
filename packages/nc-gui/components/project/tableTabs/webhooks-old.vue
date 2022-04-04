<template>
  <div>
    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <v-toolbar-title>
        <v-breadcrumbs
          :items="[{
                     text: nodes.env,
                     disabled: true,
                     href: '#'
                   },{
                     text: nodes.dbAlias,
                     disabled: true,
                     href: '#'
                   },
                   {
                     text: nodes.table_name + ' (Webhooks)',
                     disabled: true,
                     href: '#'
                   }]"
          divider=">"
          small
        >
          <template #divider>
            <v-icon small color="grey lighten-2">
              forward
            </v-icon>
          </template>
        </v-breadcrumbs>
      </v-toolbar-title>
      <v-spacer />

      <x-btn
        v-ge="['rows','save']"
        outlined
        :tooltip="$t('tooltip.saveChanges')"
        color="primary"
        small

        :disabled="loading || !valid || !hook.event"
        @click.prevent="saveHooks"
      >
        <v-icon small left>
          save
        </v-icon>
        <!-- Save -->
        {{ $t('general.save') }}
      </x-btn>
    </v-toolbar>

    <v-form
      ref="form"
      v-model="valid"
      class="mx-auto"
      lazy-validation
    >
      <v-card>
        <v-container fluid>
          <v-row>
            <v-col cols="6">
              <v-radio-group v-model="hook.event" @change="onEventChange">
                <template #default>
                  <v-simple-table dense>
                    <template #default>
                      <thead>
                        <tr>
                          <th />
                          <th>Operation</th>
                          <th>Event</th>
                        </tr>
                      </thead>

                      <tbody>
                        <tr
                          v-for="(e,i) in eventList"
                          :key="i"
                          :class="{'primary lighten-4 black--text': e.value === hook.event}"
                        >
                          <td>
                            <v-radio :value="e.value" />
                          </td>
                          <td>
                            {{ e.text[1] }}
                          </td>
                          <td>
                            {{ e.text[0] }}
                          </td>
                        </tr>
                      </tbody>
                    </template>
                  </v-simple-table>
                </template>
              </v-radio-group>

              <!--      <v-radio-group v-model="hook.event" @change="onEventChage">-->
              <!--        <v-radio v-for="(e,i) in eventList" :key="i" :label="e.text" :value="e.v"></v-radio>-->
              <!--      </v-radio-group>-->

              <!--      <v-select-->
              <!--        v-model="hook.event"-->
              <!--        :items="['Before','After']"-->
              <!--        label="Event"-->
              <!--        required-->
              <!--      ></v-select>-->

              <!--      <v-select-->
              <!--        v-model="hook.operation"-->
              <!--        :items="['Insert','Update','Delete']"-->
              <!--        label="Operation"-->
              <!--        required-->
              <!--      ></v-select>-->
            </v-col>
            <v-col cols="6">
              <v-card class="">
                <v-card-title>Webhook</v-card-title>
                <v-card-text>
                  <v-text-field
                    v-model="hook.title"
                    :disabled="!hook.event"
                    label="Title"
                    required
                    :rules="[v => !!v || 'Title Required']"
                  />
                  <v-text-field
                    v-model="hook.url"
                    :disabled="!hook.event"
                    label="URL"
                    required
                    type="url"
                    :rules="urlRules"
                  />

                  <!--      <v-textarea-->
                  <!--        v-model="hook.header"-->
                  <!--        label="Headers"-->
                  <!--        required-->
                  <!--      ></v-textarea>-->
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </v-container>
      </v-card>
    </v-form>
  </div>
</template>

<script>
export default {
  name: 'Webhooks',
  props: ['nodes'],
  data: () => ({
    valid: false,
    loading: false,
    eventList: [
      { text: ['Before', 'Insert'], value: ['before', 'insert'] },
      { text: ['After', 'Insert'], value: ['after', 'insert'] },
      { text: ['Before', 'Update'], value: ['before', 'update'] },
      { text: ['After', 'Update'], value: ['after', 'update'] },
      { text: ['Before', 'Delete'], value: ['before', 'delete'] },
      { text: ['After', 'Delete'], value: ['after', 'delete'] }
    ],
    hook: {},
    urlRules: [
      v => !v || !v.trim() || /^https?:\/\/.{1,}/.test(v) || 'Not a valid URL'
    ]

  }),
  methods: {
    async onEventChange() {
      this.loading = true
      this.hook = {
        ...this.hook,
        url: '',
        title: this.hook.event.join('.')
      }

      const result = (await this.$store.dispatch('sqlMgr/ActSqlOp', [
        {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcHooksGet', {
          table_name: this.nodes.table_name,
          data: {
            event: this.hook.event[0],
            operation: this.hook.event[1]
          }
        }
      ]))
      const hooksDetails = result && result.data.list && result.data.list[0]

      if (hooksDetails) {
        this.hook = {
          ...this.hook,
          url: hooksDetails.url,
          title: hooksDetails.title
        }
      }
      this.loading = false
    },
    async saveHooks() {
      if (!this.valid || !this.hook.event) {
        return
      }
      this.loading = true
      await this.$store.dispatch('sqlMgr/ActSqlOp', [
        {
          env: this.nodes.env,
          dbAlias: this.nodes.dbAlias
        }, 'tableXcHooksSet', {
          table_name: this.nodes.table_name,
          data: {
            ...this.hook,
            event: this.hook.event[0],
            operation: this.hook.event[1]
          }
        }
      ])
      this.$toast.success('Webhook details updated successfully').goAway(3000)
      this.loading = false
    }
  }
}
</script>

<style scoped>
/*tr.selected{*/
/*  background: #8ceaf6;*/
/*}*/
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
