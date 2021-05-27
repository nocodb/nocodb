<template>
  <div>


    <v-toolbar flat height="42" class="toolbar-border-bottom">
      <!--      <v-toolbar-title>-->
      <!--        <v-breadcrumbs :items="[{-->
      <!--          text: nodes.env,-->
      <!--          disabled: true,-->
      <!--          href: '#'-->
      <!--        },{-->
      <!--          text: nodes.dbAlias,-->
      <!--          disabled: true,-->
      <!--          href: '#'-->
      <!--        },-->
      <!--        {-->
      <!--          text: nodes.tn + ' (Logic)',-->
      <!--          disabled: true,-->
      <!--          href: '#'-->
      <!--        }]" divider=">" small>-->
      <!--          <template v-slot:divider>-->
      <!--            <v-icon small color="grey lighten-2">forward</v-icon>-->
      <!--          </template>-->
      <!--        </v-breadcrumbs>-->

      <!--      </v-toolbar-title>-->
      <v-spacer></v-spacer>

      <x-btn outlined tooltip="Reload roles"
             color="primary"
             small
             :disabled="loading"
             @click="loadRoles(); loadAggrAcl();"
             v-ge="['roles','reload']">
        <v-icon small left>refresh</v-icon>
        Reload
      </x-btn>
      <x-btn outlined tooltip="Add new role"
             color="primary"
             small
             :disabled="loading"
             @click="comingSoon"
             v-ge="['roles','add new']"
             @click.prevent>
        <v-icon small left>mdi-plus</v-icon>
        New Role
      </x-btn>
      <x-btn outlined tooltip="Save Changes"
             color="primary"
             small
             @click="save"
             :disabled="loading || !edited"

             v-ge="['rows','save']"
             @click.prevent>
        <v-icon small left>save</v-icon>
        Save
      </x-btn>


    </v-toolbar>
    <div class="" style="width: 100%">

      <div class="d-flex justify-center mx-auto">


        <v-card class="flex-shrink-1" style="">

          <v-simple-table dense style="width: auto;min-width:500px">
            <thead>
            <tr>

              <th>
                Role Name
              </th>

              <th>
                Role Description
              </th>
              <th></th>
              <!--           <th v-for="op in operations">
                           {{ op }}
                         </th>-->
            </tr>

            </thead>
            <tbody>
            <tr v-for="(role,i) in roles">
              <td>
                <v-edit-dialog
                  lazy
                >
                  <v-chip small :color="colors[i % colors.length]">{{ role.title }}</v-chip>
                  <template v-slot:input>
                    <v-text-field
                      :disabled="role.type === 'SYSTEM'"
                      @input="edited = true"
                      v-model="role.title"
                      label="Edit"
                      single-line
                      v-ge="['roles','title']"
                    ></v-text-field>
                  </template>
                </v-edit-dialog>
              </td>
              <td>

                <v-edit-dialog
                  lazy
                >

                  <span> {{ role.description }}</span>
                  <template v-slot:input>
                    <v-text-field
                      :disabled="role.type === 'SYSTEM'"
                      @input="edited = true"
                      v-model="role.description"
                      label="Edit"
                      single-line
                      v-ge="['roles','title']"
                    ></v-text-field>
                  </template>
                </v-edit-dialog>
              </td>

              <td>
                <x-icon
                  v-if="role.type !== 'SYSTEM'" @click="(deleteId = role.id,deleteIndex =i, showConfirmDlg =true)"
                  small
                  color="error" tooltip="Delete role">
                  mdi-delete-forever
                </x-icon>
                <x-icon
                  small
                  tooltip="System defined role can't be edited"
                  v-else color="info">
                  mdi-information-outline
                </x-icon>
              </td>


              <!--  <td v-for="op in operations">
                  <v-tooltip
                    bottom

                    v-if="role.id && aggrAcl && aggrAcl[role.title]">
                    <template v-slot:activator="{on}">
                      <div v-on="on">
                        <v-checkbox
                          @change="edited = true"
                          v-model="aggrAcl[role.title][op]"
                          hide-details dense class="mt-n1 pt-0"
                        ></v-checkbox>
                      </div>
                    </template>
                    <span>Disable/Enable access to {{ op }} operation for all tables in all databases.</span>
                  </v-tooltip>
                </td>-->
            </tr>
            </tbody>
          </v-simple-table>

        </v-card>
      </div>

    </div>


    <dlg-label-submit-cancel
      type="primary"
      :actions-mtd="confirmDelete"
      heading="Do you want to delete the role?"
      :dialog-show="showConfirmDlg"
    ></dlg-label-submit-cancel>
  </div>
</template>

<script>
import DlgLabelSubmitCancel from "@/components/utils/dlgLabelSubmitCancel";
import UserManagement from "@/components/auth/userManagement";
import colors from "@/mixins/colors";


export default {
  mixins: [colors],
  components: {UserManagement, DlgLabelSubmitCancel},
  props: ['nodes'],
  name: "roles",
  data: () => ({
    loading: false,
    roles: null,
    edited: false,
    showConfirmDlg: false,
    deleteId: null,
    deleteIndex: null,
    aggrAcl: null,

  }),
  async created() {
    await this.loadRoles();
    await this.loadAggrAcl();
  },
  methods: {
    async loadRoles() {
      try {
        this.roles = (await this.$axios.get('/admin/roles', {
          headers: {
            'xc-auth': this.$store.state.users.token
          },
          params: {
            project_id: this.$route.params.project_id
          }
        })).data;
      } catch (e) {
        this.$toast.error('Failed loading role list').goAway(3000);
      }

      this.edited = false;
    },
    async loadAggrAcl() {
      /*      try {
              this.aggrAcl = await this.$store.dispatch('sqlMgr/ActSqlOp', [
                // todo: manage dbAlias or get aggregated
                {dbAlias: 'db'},
                'xcAclAggregatedGet'
              ])
            } catch (e) {
            }*/
    },
    addRole() {
      this.roles.push({
        title: ('role name ' + (this.customRolesCount || '')).trim(),
        description: 'Role description'
      });
      this.edited = true;
      this.scrollAndFocusLastRow();
    },
    async save() {
      try {
        await this.$axios.put('/admin/roles', {roles: this.roles}, {
          headers: {
            'xc-auth': this.$store.state.users.token
          }
        });


        /*        await this.$store.dispatch('sqlMgr/ActSqlOp', [
                  // todo: manage dbAlias or get aggregated
                  {dbAlias: 'db'},
                  'xcAclAggregatedSave',
                  this.aggrAcl
                ])*/

        //
        //
        // this.$axios('sqlMgr/ActSqlOp', [{
        //   env: this.nodes.env,
        //   // todo: handle all dbs
        //   dbAlias: this.$store.state.project.authDbAlias
        // }, 'projectSaveOrUpdateRoles', ]);
        this.$toast.success('Successfully saved all changes').goAway(3000);
      } catch (e) {
        this.$toast.error(e.response.data.msg).goAway(3000);
      }
      await this.loadRoles();
      await this.loadAggrAcl();

    },
    async confirmDelete(hideDialog) {
      if (hideDialog) {
        this.showConfirmDlg = false;
        return
      }
      if (this.deleteId) {
        try {
          await this.$axios.delete('/admin/roles/' + this.deleteId, {
            headers: {
              'xc-auth': this.$store.state.users.token
            }
          })
          this.$toast.success('Successfully deleted role').goAway(3000);
        } catch (e) {
          this.$toast.error('Failed deleting the role').goAway(3000);
        }
        await this.loadRoles();
      } else {
        this.roles.splice(this.deleteIndex, 1)
      }
      this.showConfirmDlg = false;

    },
    scrollAndFocusLastRow() {
      this.$nextTick(() => {
        document.querySelector('.project-container').scrollTop = 9999;
        const menuActivator = this.$el && this.$el.querySelector('tr:last-child .v-small-dialog__activator__content');
        if (menuActivator) {
          menuActivator.click();
          this.$nextTick(() => {
            const inputField = document.querySelector('.menuable__content__active input');
            inputField && inputField.select()
          })
        }
      })
    }
  },
  computed: {
    operations() {
      return [
        'create',
        'read',
        'update',
        'delete'
      ]
    },
    customRolesCount() {
      return (this.roles && this.roles.filter(r => r.type !== 'SYSTEM').length) || 0
    }
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
