import { mainPage, settingsPage } from "../../support/page_objects/mainPage";
import {loginPage} from "../../support/page_objects/navigation";
import { isTestSuiteActive, mysqlSakilaSqlViews, mysqlSakilaTables, pgSakilaSqlViews, pgSakilaTables, sqliteSakilaSqlViews } from "../../support/page_objects/projectConstants";

import {getProjectString} from "../../support/page_objects/projectConstants";

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return;

  let projectId;
  let sakilaTables, sakilaSqlViews;


  describe(`${apiType.toUpperCase()} ERD`, () => {
    before(() => {
      cy.restoreLocalStorage();
      
      // loginPage.loginAndOpenProject(apiType, dbType);
      
      cy.openTableTab("Country", 25);
      projectId = getProjectString()
      cy.log('erd:getProjectString' + projectId)
      if (dbType === "postgres") {
        sakilaTables = pgSakilaTables;
        sakilaSqlViews = pgSakilaSqlViews;
      } else if(dbType === "mysql") {
        sakilaTables = mysqlSakilaTables;
        sakilaSqlViews = mysqlSakilaSqlViews;
      } else if(dbType === "xcdb") {
        sakilaTables = mysqlSakilaTables.map((tableName) => `${projectId}${tableName}`);
        sakilaSqlViews = sqliteSakilaSqlViews.map((viewName) => `${projectId}${viewName}`);
      }
      cy.saveLocalStorage();
    });

    beforeEach(() => {
      cy.restoreLocalStorage();
    })

    afterEach(() => {
      cy.saveLocalStorage();
    })

    after(() => {
      cy.restoreLocalStorage();
      cy.closeTableTab("Country");
      cy.saveLocalStorage();
    });

    // Test cases

    it(`Enable MM setting Open Table ERD`, () => {
      // cy.openTableTab("Country", 25);
      mainPage.toggleShowMMSetting();
      
      mainPage.openErdTab();
      mainPage.closeMetaTab();
    });

    it(`Verify ERD Context menu in all table view`, () => {
      mainPage.openErdTab();
      cy.wait(2000)
      // todo: Edges are not rendering properly in cypress in first render
      settingsPage.openTab(settingsPage.UI_ACCESS_CONTROL)
      settingsPage.openTab(settingsPage.ERD)

      cy.get('.nc-erd-context-menu').should('be.visible');
      cy.get('.nc-erd-context-menu').get('.nc-erd-histogram').should('be.visible');
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').should('have.length', 3);
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(0).should('have.class', 'ant-checkbox-checked');
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(1).should('have.class', 'ant-checkbox-checked');
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').eq(2).should('not.have.class', 'ant-checkbox-checked');

      cy.get('.nc-erd-context-menu').find('.nc-erd-showColumns-label').dblclick();
      cy.get('.nc-erd-context-menu').find('.ant-checkbox').should('have.length', 5);

      // todo: Enabling and disabling showJunctionTableNames rerenders `mm` edges since `mm` edges is not getting rendered in cypress
      cy.get('.nc-erd-context-menu').get('.nc-erd-showJunctionTableNames-checkbox').click();
      cy.get('.nc-erd-context-menu').get('.nc-erd-showJunctionTableNames-checkbox').click();
    });

    it("Verify ERD of all tables view and verify columns of actor and payment with default config", () => {
      if(dbType === "mysql") {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 12)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 14)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 11)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 17)
      } else if (dbType === "postgres") {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 17)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 32)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 29)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 35)
      } else {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 12)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 14)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 11)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 17)
      }

      for(const tableName of sakilaTables) {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${tableName}`).should('exist');
      }

      // Actor table
      [
        'actor_id',
        'first_name',
        'last_name',
        'last_update',
        'film_list'
      ].forEach((colTitle) => {
        if (dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}actor`).find(`.nc-erd-table-node-${projectId}actor-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-actor`).find(`.nc-erd-table-node-actor-column-${colTitle}`).should('exist');
        }
      });

      // Payment table
      if(dbType === "mysql") {
        [
          'payment_id',
          'customer_id',
          'staff_id',
          'rental_id',
          'amount',
          'payment_date',
          'last_update',
          'customer',
          'rental',
          'staff'
        ]
        .forEach((colTitle) => {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-payment`).find(`.nc-erd-table-node-payment-column-${colTitle}`).should('exist');
        });
      } else if(dbType === "postgres") {
        [
          'payment_id',
          'customer_id',
          'staff_id',
          'rental_id',
          'amount',
          'payment_date',
          'customer',
          'rental',
          'staff'
        ]
        .forEach((colTitle) => {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-payment`).find(`.nc-erd-table-node-payment-column-${colTitle}`).should('exist');
        });
      } else {
        [
          'payment_id',
          'customer_id',
          'staff_id',
          'rental_id',
          'amount',
          'payment_date',
          'last_update',
          'customer',
          'rental',
          'staff'
        ]
        .forEach((colTitle) => {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}payment`).find(`.nc-erd-table-node-${projectId}payment-column-${colTitle}`).should('exist');
        });
      }
    });

    it("Verify ERD of all tables view and verify columns of actor and payment with default config with showAllColumn disabled", () => {
      cy.get('.nc-erd-context-menu').get('.nc-erd-showColumns-checkbox').click();
      cy.get('.nc-erd-showPkAndFk-checkbox-disabled').should('exist');
      cy.get('.nc-erd-showPkAndFk-checkbox-unchecked').should('exist');

      // Actor table
      [
        'film_list'
      ].forEach((colTitle) => {
        if(dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}actor`).find(`.nc-erd-table-node-${projectId}actor-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-actor`).find(`.nc-erd-table-node-actor-column-${colTitle}`).should('exist');
        }
      });

      // Payment table
      [
        'customer',
        'rental',
        'staff'
      ].forEach((colTitle) => {
        if(dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}payment`).find(`.nc-erd-table-node-${projectId}payment-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-payment`).find(`.nc-erd-table-node-payment-column-${colTitle}`).should('exist');
        }
      });
    });

    it("Verify ERD of all tables view and verify columns of actor and payment with default config with showPkAndFk disabled", () => {
      // enable showAllColumn
      cy.get('.nc-erd-context-menu').get('.nc-erd-showColumns-checkbox').click();
      cy.get('.nc-erd-context-menu').get('.nc-erd-showPkAndFk-checkbox').click();

      // Actor table
      [
        'last_name',
        'last_update',
        'film_list'
      ].forEach((colTitle) => {
        if(dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}actor`).find(`.nc-erd-table-node-${projectId}actor-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-actor`).find(`.nc-erd-table-node-actor-column-${colTitle}`).should('exist');
        }
      });

      // Payment table
      if(dbType === "mysql") {
        [
          'amount',
          'payment_date',
          'last_update',
          'customer',
          'rental',
          'staff'
        ].forEach((colTitle) => {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-payment`).find(`.nc-erd-table-node-payment-column-${colTitle}`).should('exist');
        });
      } else if(dbType === "postgres") {
        [
          'amount',
          'payment_date',
          'customer',
          'rental',
          'staff'
        ].forEach((colTitle) => {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-payment`).find(`.nc-erd-table-node-payment-column-${colTitle}`).should('exist');
        });
      } else {
        [
          'amount',
          'payment_date',
          'last_update',
          'customer',
          'rental',
          'staff'
        ].forEach((colTitle) => {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}payment`).find(`.nc-erd-table-node-${projectId}payment-column-${colTitle}`).should('exist');
        });
      }
    });

    it("Verify ERD of all tables view with sql grid on and verify columns of ActorInfo", () => {
      cy.get('.nc-erd-context-menu').get('.nc-erd-showViews-checkbox').click();

      if(dbType === "mysql") {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 19)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 14)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 11)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 17)
      } else if(dbType === "postgres") {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 24)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 32)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 29)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 35)
      } else {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 19)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 14)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 11)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 17)
      }

      for(const tableName of sakilaTables) {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${tableName}`).should('exist');
      }
      
      for(const tableName of sakilaSqlViews) {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${tableName}`).should('exist');
      }

      // ActorInfo SQL View
      let actorInfoColumns;
      if(dbType === "xcdb") {
        actorInfoColumns = [
          'ID',
          'name',
          'address',
          'zip_code',
          'phone',
          'city',
          'country',
          'SID',
        ];
      } else {
        actorInfoColumns = [
          'actor_id',
          'first_name',
          'last_name',
          'film_info'
        ];
      }
      actorInfoColumns.forEach((colTitle) => {
        if(dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}actor_info`).find(`.nc-erd-table-node-${projectId}actor_info-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-actor_info`).find(`.nc-erd-table-node-actor_info-column-${colTitle}`).should('exist');
        }
      })

    });

    it("Verify show MM tables", () => {
      if(dbType === "xcdb") {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}store`).should('not.exist');
      } else {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-store`).should('not.exist');
      }
      // disable showViews
      cy.get('.nc-erd-context-menu').get('.nc-erd-showViews-checkbox').click();
      cy.get('.nc-erd-context-menu').get('.nc-erd-showMMTables-checkbox').click();

      // Enabling and disabling showJunctionTableNames rerenders `mm` edges since `mm` edges is not getting rendered in cypress
      cy.get('.nc-erd-context-menu').get('.nc-erd-showJunctionTableNames-checkbox').click();
      cy.get('.nc-erd-context-menu').get('.nc-erd-showJunctionTableNames-checkbox').click();

      if(dbType === "mysql") {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 16)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 26)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 22)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 30)
      } else if(dbType === "postgres") {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 21)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 44)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 40)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 48)
      } else {
        cy.get('.nc-erd-vue-flow').find('.nc-erd-table-node').should('have.length', 16)
        cy.get('.nc-erd-vue-flow').find('.vue-flow__edge').should('have.length', 26)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-circle').should('have.length', 22)
        cy.get('.nc-erd-vue-flow').find('.nc-erd-edge-rect').should('have.length', 30)
      }
        
      // Check if store table is present
      if(dbType === "xcdb") {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-${projectId}store`).should('exist');
      } else {
        cy.get('.nc-erd-vue-flow').find(`.nc-erd-table-node-store`).should('exist');
      }
    })

    it("Verify show junction table names", () => {
      // disable showViews
      cy.get('.nc-erd-context-menu').get('.nc-erd-showJunctionTableNames-checkbox').click();

      if(dbType === "xcdb") {
        cy.get('.nc-erd-vue-flow').get(`.nc-erd-table-label-filmactor-${projectId}film_actor`).should('exist');
      } else {
        cy.get('.nc-erd-vue-flow').get('.nc-erd-table-label-filmactor-film_actor').should('exist');
      }
      mainPage.closeMetaTab();
    })

    it('Verify table ERD view of country', () => {
      mainPage.openTableErdView();

      cy.get('.nc-erd-vue-flow-single-table').find('.nc-erd-table-node').should('have.length', 2)
      cy.get('.nc-erd-vue-flow-single-table').find('.vue-flow__edge').should('have.length', 1)
      cy.get('.nc-erd-vue-flow-single-table').find('.nc-erd-edge-circle').should('have.length', 1)
      cy.get('.nc-erd-vue-flow-single-table').find('.nc-erd-edge-rect').should('have.length', 1)

      const countryColumns = [
        'country_id',
        'country',
        'last_update',
        'city_list'
      ]

      // Country table
      countryColumns.forEach((colTitle) => {
        if(dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow-single-table').find(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow-single-table').find(`.nc-erd-table-node-country`).find(`.nc-erd-table-node-country-column-${colTitle}`).should('exist');
        }
      });

      const cityColumns = [
        'city_id',
        'city',
        'last_update',
        'country',
        'address_list'
      ]

      // City table
      cityColumns.forEach((colTitle) => {
        if(dbType === "xcdb") {
          cy.get('.nc-erd-vue-flow-single-table').find(`.nc-erd-table-node-${projectId}city`).find(`.nc-erd-table-node-${projectId}city-column-${colTitle}`).should('exist');
        } else {
          cy.get('.nc-erd-vue-flow-single-table').find(`.nc-erd-table-node-city`).find(`.nc-erd-table-node-city-column-${colTitle}`).should('exist');
        }
      });
    })

    it('Verify table ERD view of country showAllColumn disabled', () => {
      cy.get('.nc-erd-vue-flow-single-table').within(() => {
        cy.get('.nc-erd-context-menu').get('.nc-erd-showColumns-checkbox').click();
        cy.get('.nc-erd-showPkAndFk-checkbox-disabled').should('exist');
        cy.get('.nc-erd-showPkAndFk-checkbox-unchecked').should('exist');

        const countryColumns = [
          'city_list'
        ]
  
        // Country table
        countryColumns.forEach((colTitle) => {
          if(dbType === "xcdb") {
            cy.get(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-${colTitle}`).should('exist');
          } else {
            cy.get(`.nc-erd-table-node-country`).find(`.nc-erd-table-node-country-column-${colTitle}`).should('exist');
          }
        });
  
        const cityColumns = [
          'country',
          'address_list'
        ]
  
        // City table
        cityColumns.forEach((colTitle) => {
          if(dbType === "xcdb") {
            cy.get(`.nc-erd-table-node-${projectId}city`).find(`.nc-erd-table-node-${projectId}city-column-${colTitle}`).should('exist');
          } else {
            cy.get(`.nc-erd-table-node-city`).find(`.nc-erd-table-node-city-column-${colTitle}`).should('exist');
          }
        });

        cy.get('.nc-erd-context-menu').get('.nc-erd-showColumns-checkbox').click();
      })
    })

    it('Verify table ERD view of country show PK AND FK disabled', () => {
      cy.get('.nc-erd-vue-flow-single-table').within(() => {
        cy.get('.nc-erd-context-menu').get('.nc-erd-showPkAndFk-checkbox').click();

        const countryColumns = [
          'country',
          'last_update',
          'city_list'
        ]
  
        // Country table
        countryColumns.forEach((colTitle) => {
          if(dbType === "xcdb") {
            cy.get(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-${colTitle}`).should('exist');
          } else {
            cy.get(`.nc-erd-table-node-country`).find(`.nc-erd-table-node-country-column-${colTitle}`).should('exist');
          }
        });
  
        const cityColumns = [
          'city',
          'last_update',
          'country',
          'address_list'
        ]
  
        // City table
        cityColumns.forEach((colTitle) => {
          if(dbType === "xcdb") {
            cy.get(`.nc-erd-table-node-${projectId}city`).find(`.nc-erd-table-node-${projectId}city-column-${colTitle}`).should('exist');
          } else {
            cy.get(`.nc-erd-table-node-city`).find(`.nc-erd-table-node-city-column-${colTitle}`).should('exist');
          }
        });

        cy.get('.nc-erd-context-menu').get('.nc-erd-showPkAndFk-checkbox').click();

      })
      cy.getActiveModal().find('.nc-modal-close').click({ force: true });
    })

    it('create column and check if the change is in the schema', () => {
      mainPage.addColumn('test_column', 'country')

      // table view
      mainPage.openTableErdView();
      cy.get('.nc-erd-vue-flow-single-table').within(() => {
        if(dbType === "xcdb") {
          cy.get(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-test_column`).should('exist');
        } else {
          cy.get('.nc-erd-table-node-country').find('.nc-erd-table-node-country-column-test_column').should('exist');
        }
      })
      cy.getActiveModal().find('.nc-modal-close').click({ force: true });

      // All table view
      mainPage.openErdTab();
      cy.get('.nc-erd-vue-flow').within(() => {
        if(dbType === "xcdb") {
          cy.get(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-test_column`).should('exist');
        } else {
          cy.get('.nc-erd-table-node-country').find('.nc-erd-table-node-country-column-test_column').should('exist');
        }
      })
      mainPage.closeMetaTab();


      mainPage.deleteColumn('test_column')
      
      // table view
      mainPage.openTableErdView();
      cy.get('.nc-erd-vue-flow-single-table').within(() => {
        if(dbType === "xcdb") {
          cy.get(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-test_column`).should('not.exist');
        } else {
          cy.get('.nc-erd-table-node-country').find('.nc-erd-table-node-country-column-test_column').should('not.exist');
        }
      })
      cy.getActiveModal().find('.nc-modal-close').click({ force: true });

      // All table view
      mainPage.openErdTab();
      cy.get('.nc-erd-vue-flow').within(() => {
        if(dbType === "xcdb") {
          cy.get(`.nc-erd-table-node-${projectId}country`).find(`.nc-erd-table-node-${projectId}country-column-test_column`).should('not.exist');
        } else {
          cy.get('.nc-erd-table-node-country').find('.nc-erd-table-node-country-column-test_column').should('not.exist');
        }
      })
      mainPage.closeMetaTab();
    })

    it('Create table should reflected in ERD', () => {
      cy.createTable('new')

      mainPage.openErdTab();
      cy.get('.nc-erd-vue-flow').within(() => {
        if(dbType === "xcdb") {
          cy.get(`.nc-erd-table-node-${projectId}new`).should('exist');
        } else {
          cy.get('.nc-erd-table-node-new').should('exist');
        }
      })
      mainPage.closeMetaTab();

      cy.deleteTable('new')
      
      mainPage.openErdTab();
      cy.get('.nc-erd-vue-flow').within(() => {
        if(dbType === "xcdb") {
          cy.get(`.nc-erd-table-node-${projectId}new`).should('not.exist');
        } else {
          cy.get('.nc-erd-table-node-new').should('not.exist');
        }
      })
      mainPage.closeMetaTab();
    })

    it(`Disable MM setting Open Table ERD and check easter egg should not work`, () => {
      mainPage.toggleShowMMSetting();
      
      mainPage.openErdTab();
      cy.get('.nc-erd-vue-flow').within(() => {
        cy.get('.nc-erd-context-menu').find('.nc-erd-showColumns-label').dblclick();
        cy.get('.nc-erd-context-menu').find('.ant-checkbox').should('have.length', 3);
      })

      mainPage.closeMetaTab();
    });
  });
};

/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Raju Udava <sivadstala@gmail.com>
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