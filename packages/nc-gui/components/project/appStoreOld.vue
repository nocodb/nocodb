<template>
  <div class="d-flex h-100">
    <v-navigation-drawer width="300" class="pa-1">
      <v-text-field outlined dense
                    v-model="query"
                    hide-details
                    placeholder="Search apps"
                    append-icon="mdi-magnify"

      ></v-text-field>

      <v-list dense>
        <v-list-item v-for="filter of filters" :key="filter">
          <v-checkbox v-model="selectedTags" class="pt-0 mt-0" :value="filter" hide-details dense
                      :label="filter"></v-checkbox>
        </v-list-item>
      </v-list>
    </v-navigation-drawer>
    <v-container class="h-100 app-container">
      <v-row>
        <v-col v-for="app in filteredApps" :key="i" cols="6">
          <v-card
            class="elevation-0 app-item-card"
          >

            <v-btn x-small outlined class="install-btn caption text-capitalize" @click="installApp">
              <v-icon x-small class="mr-1">mdi-plus</v-icon>
              Install
            </v-btn>


            <div class="d-flex flex-no-wrap">
              <v-avatar
                class="ma-3"
                size="100"
                tile
              >
                <v-img v-if="app.img" :src="app.img" contain></v-img>
                <v-img v-else src="https://cdn.vuetifyjs.com/images/cards/foster.jpg" contain></v-img>
              </v-avatar>
              <div class="flex-grow-1">
                <v-card-title
                  class="title "
                  v-text="app.name"
                ></v-card-title>

                <v-card-subtitle v-text="app.description" class="pb-1"></v-card-subtitle>
                <v-card-actions>
                  <div class="d-flex justify-space-between d-100 align-center">
                    <v-rating
                      full-icon="mdi-star"
                      readonly
                      length="5"
                      size="15"
                      value="5"
                    ></v-rating>

                    <span class="subtitles" v-if="app.price && app.price !== 'Free'">${{ app.price }} / mo</span>
                    <span class="subtitles" v-else>Free</span>
                  </div>
                </v-card-actions>

                <!--                <v-card-actions>-->
                <!--                  <v-btn-->
                <!--                    outlined-->
                <!--                    rounded-->
                <!--                    small-->
                <!--                  >-->
                <!--                    Download-->
                <!--                  </v-btn>-->
                <!--                </v-card-actions>-->
              </div>

            </div>
          </v-card>
        </v-col>
      </v-row>
    </v-container>

  </div>
</template>

<script>
export default {
  name: "appStore",
  data: () => ({
    query: '',
    selectedTags: [],
    apps: [
      //   {
      //   name: 'Graph',
      //   description: 'Visualize your records on a bar, line, pie, or scatter chart',
      //   price: '29',
      //   tags: []
      // }, {
      //   name: 'Import / Export',
      //   description: 'Visualize your records on a bar, line, pie, or scatter chart',
      //   price: '39'
      // }, {
      //   name: 'Chart',
      //   description: 'Visualize your records on a bar, line, pie, or scatter chart',
      //   price: '19'
      // },
      {
        name: 'Freshworks',
        img: require('~/assets/img/abcd/freshworks.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      },
      {
        name: 'RazorPay',
        img: require('~/assets/img/abcd/razorpay.svg'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      },
      {
        name: 'Google Ads',
        img: require('~/assets/img/abcd/adsense.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      },
      {
        name: 'Facebook Ads',
        img: require('~/assets/img/abcd/fbads.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      },
      {
        name: 'Stripe',
        img: require('~/assets/img/abcd/320.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      }, {
        name: 'Twilio',
        img: require('~/assets/img/abcd/twilio.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      }, {
        name: 'SendGrid',
        img: require('~/assets/img/abcd/sendgrid.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      }, {
        name: 'Basecamp',
        img: require('~/assets/img/abcd/basecamp.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      }, {
        name: 'Github',
        img: require('~/assets/img/abcd/github.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19',
        tags: ['SaaS']
      }, {
        name: 'Shopify',
        img: require('~/assets/img/abcd/shopify.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '19'
      }, {
        name: 'SAP',
        img: require('~/assets/img/abcd/sap.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '49',
        tags: ['ERP']
      }, {
        name: 'SalesForce',
        img: require('~/assets/img/abcd/salesforce.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: ['ERP']
      }, {
        name: 'NetSuite',
        img: require('~/assets/img/abcd/netsuit.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99'
      }, {
        name: 'Zoho CRM',
        img: require('~/assets/img/abcd/zohocrm.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: ['ERP']
      }, {
        name: 'MySQL',
        img: require('~/assets/img/abcd/mysql.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'Databases']
      }, {
        name: 'PostgreSQL',
        img: require('~/assets/img/abcd/pg.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'Databases']
      }, {
        name: 'SQL Server',
        img: require('~/assets/img/abcd/mssql.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'Databases']
      }, {
        name: 'MariaDB',
        img: require('~/assets/img/abcd/mariaDB.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'Databases']
      }, {
        name: 'SQLite',
        img: require('~/assets/img/temp/db/sqlite.svg'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'Databases']
      }, {
        name: 'Oracle DB',
        img: require('~/assets/img/temp/db/oracle.png.jpg'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'Databases']
      }, {
        name: 'CrateDB',
        img: require('~/assets/img/abcd/cratedb.jpg'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: [ 'Databases']
      },{
        name: 'Cassandra',
        img:require('~/assets/img/abcd/cassandra.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: [ 'Databases']
      },{
        name: 'CouchDB',
        img:require('~/assets/img/abcd/couchdb.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: [ 'Databases']
      },{
        name: 'ElasticSearch',
        img:require('~/assets/img/abcd/elasticsearch.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: [ 'Databases']
      },{
        name: 'Snowflake',
        img:require('~/assets/img/abcd/snowflake.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99',
        tags: [ 'Databases']
      },{
        name: 'MongoDB',
        img: require('~/assets/img/abcd/mongodb.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99'
      },  {
        name: 'BigQuery',
        img: require('~/assets/img/abcd/bigquery.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: '99'
      },

      {
        name: 'REST API',
        img:require('~/assets/img/abcd/rest.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'API']
      }, {
        name: 'GRAPHQL API',
        img:require('~/assets/img/abcd/graphql.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'API']
      }, {
        name: 'gRPC API',
        img:require('~/assets/img/abcd/grpc.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'API']
      },

      {
        name: 'Swagger',
        img:require('~/assets/img/abcd/swagger.png'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: ['Free', 'API Specification']
      },
      {
        name: 'Postman',
        img:require('~/assets/img/abcd/postman.jpg'),
        description: 'Visualize your records on a bar, line, pie, or scatter chart',
        price: 'Free',
        tags: [ 'API Specification']
      },

    ]
  }),
  methods: {
    installApp() {
      this.$toast.info('Coming soon after seed funding.').goAway(5000);
    }
  },
  computed: {
    filters() {
      return this.apps.reduce((arr, app) => arr.concat(app.tags || []), []).filter((f, i, arr) => i === arr.indexOf(f)).sort();
    },
    filteredApps() {
      return this.apps.filter(app => (!this.query.trim() || app.name.toLowerCase().indexOf(this.query.trim().toLowerCase()) > -1)
        && (!this.selectedTags.length || this.selectedTags.some(t => app.tags && app.tags.includes(t)))
      );
    }
  }
}
</script>

<style scoped lang="scss">
.title {
  color: var(--v-textColor-ligten2) !important;
}

.app-item-card {
  transition: .4s background-color;
  position: relative;
  overflow-x: hidden;

  .install-btn {
    position: absolute;
    opacity: 0;
    right: -100%;
    top: 10px;
    transition: .4s opacity, .4s right;
  }

  &:hover .install-btn {
    right: 10px;
    opacity: 1;
  }
}

.app-item-card {
  transition: .4s background-color, .4s transform;
  &:hover {
    background: rgba(123, 126, 136, 0.1) !important;
    transform: scale(1.01);
  }
}
  ::v-deep {
    .v-rating {
      margin-left:6px;
      .v-icon {
        padding-right: 2px;
        padding-left: 2px;
      }
    }
    .v-input__control .v-input__slot .v-input--selection-controls__input {
      transform: scale(.75);
    }

    .v-input--selection-controls .v-input__slot > .v-label{
      font-size: .8rem;
    }
  }
  .app-container {
    height: 100%;
    overflow-y: auto;
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
