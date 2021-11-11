import { loginPage } from "../../support/page_objects/navigation"
import { isTestSuiteActive } from "../../support/page_objects/projectConstants"
import { mainPage } from "../../support/page_objects/mainPage"

let baseURL = ''

// 0: all enabled
// 1: field hide
// 2: field sort
// 3: field filter
// 4: default (address table): for view operation validation
// 5: default (country table): for update row/column validation
let viewURL = {}

export const genTest = (type, xcdb) => {
    if(!isTestSuiteActive(type, xcdb)) return;

    const generateViewLink = (viewName) => {
        // click on share view 
        cy.get('.v-navigation-drawer__content > .container')
            .find('.v-list > .v-list-item')
            .contains('Share View')
            .click()

        // wait, as URL initially will be /undefined
        cy.wait(1000)

        // copy link text, visit URL
        cy.getActiveModal().find('.share-link-box')
            .contains('/nc/view/', {timeout: 10000})
            .then(($obj) => {
                cy.get('body').type('{esc}')
                // viewURL.push($obj.text())
                viewURL[viewName] = $obj.text()
                cy.wait(1000)
            })
    }    

    describe(`${type.toUpperCase()} api - GRID view (Share)`, () => {
        // Run once before test- create project (rest/graphql)
        //
        before(() => {
            // open a table to work on views
            //
            cy.openTableTab('Address');
            cy.saveLocalStorage()
        })

        beforeEach(() => {
            cy.restoreLocalStorage();
        })

        afterEach(() => {
            cy.saveLocalStorage();
        })
        
        after(() => {
            // close table
            // mainPage.deleteCreatedViews()
            cy.closeTableTab('Address')
        })      
        
        // Common routine to create/edit/delete GRID & GALLERY view
        // Input: viewType - 'grid'/'gallery'
        //
        const viewTest = (viewType) => {

            it(`Create ${viewType.toUpperCase()} view`, () => {
                // create a normal public view
                cy.get(`.nc-create-${viewType}-view`).click();
                cy.getActiveModal().find('button:contains(Submit)').click()
                cy.wait(1000)

                // // create view for fields verification
                // cy.get(`.nc-create-${viewType}-view`).click();
                // cy.getActiveModal().find('button:contains(Submit)').click()
                // cy.wait(1000)
                
                // // create view for Sort verification
                // cy.get(`.nc-create-${viewType}-view`).click();
                // cy.getActiveModal().find('button:contains(Submit)').click()
                // cy.wait(1000)
                
                // // create view for Filter verification
                // cy.get(`.nc-create-${viewType}-view`).click();
                // cy.getActiveModal().find('button:contains(Submit)').click()
                // cy.wait(1000)

                // store base URL- to re-visit and delete form view later
                cy.url().then((url) => {
                    baseURL = url
                })
            })

            it(`Share ${viewType.toUpperCase()} hide, sort, filter & verify`, () => {
                cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Address1').click()
                mainPage.hideUnhideField('Address2')
                mainPage.sortField('District', 'Z -> A')
                mainPage.filterField('Address', 'is like', 'Ab')                
                generateViewLink('combined')
                cy.log(viewURL['combined'])
            })

            it(`Share GRID view : ensure we have only one link even if shared multiple times`, () => {
                // generate view link multiple times
                generateViewLink('combined')
                generateViewLink('combined')

                // verify if only one link exists in table
                cy.get('.v-navigation-drawer__content > .container')
                    .find('.v-list > .v-list-item')
                    .contains('Share View')
                    .parent().find('button.mdi-dots-vertical').click()

                cy.getActiveMenu().find('.v-list-item').contains('Views List').click()

                cy.wait(1000)

                // cy.get('.container').find('button.mdi-delete-outline')

                cy.get('th:contains("View Link")').parent().parent()
                    .next().find('tr').its('length').should('eq', 1)
                    .then(() => {
                        cy.get('.v-overlay__content > .d-flex > .v-icon').click()
                    })
            })

            it(`Share ${viewType.toUpperCase()} view : Visit URL, Verify title`, () => {
                // visit public view
                cy.visit(viewURL['combined'])
        
                // wait for public view page to load!
                cy.wait(5000)

                // verify title
                cy.get('div.model-name').contains('Address1').should('exist')
            })

            it(`Share ${viewType.toUpperCase()} view : verify fields hidden/open`, () => {
                // verify column headers
                cy.get('[data-col="Address"]').should('exist')
                cy.get('[data-col="Address2"]').should('not.exist')
                cy.get('[data-col="District"]').should('exist')
            })

            it(`Share ${viewType.toUpperCase()} view : verify fields sort/ filter`, () => {
                // country column content verification before sort
                mainPage.getCell("District", 1).contains("West Bengali").should('exist')
                mainPage.getCell("District", 2).contains("Tutuila").should('exist')
                mainPage.getCell("District", 3).contains("Tamil Nadu").should('exist')
            })
            
            it(`Share ${viewType.toUpperCase()} view : verify download CSV`, () => {
                mainPage.hideUnhideField('LastUpdate')
                const verifyCsv = (retrievedRecords) => {
                    // expected output, statically configured
                    let storedRecords = [
                        `Address,District,PostalCode,Phone,Location,Address => Customer,Address => Staff,City <= Address,Address <=> Staff`,
                        `1013 Tabuk Boulevard,West Bengali,96203,158399646978,[object Object],2,,Kanchrapara,`,
                        `1892 Nabereznyje Telny Lane,Tutuila,28396,478229987054,[object Object],2,,Tafuna,`,
                        `1993 Tabuk Lane,Tamil Nadu,64221,648482415405,[object Object],2,,Tambaram,`,
                        `1661 Abha Drive,Tamil Nadu,14400,270456873752,[object Object],1,,Pudukkottai,`
                    ]
                    
                    for (let i = 0; i < storedRecords.length; i++) {
                        let strCol = storedRecords[i].split(',')
                        let retCol = retrievedRecords[i].split(',')
                        for (let j = 0; j < 4; j++) {
                            expect(strCol[j]).to.be.equal(retCol[j])
                        }
                        // expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
                    }
                }                

                // download & verify
                mainPage.downloadAndVerifyCsv(`Address_exported_1.csv`, verifyCsv)
                mainPage.hideUnhideField('LastUpdate')
            })

            // it(`Share ${viewType} view generate URL with all fields enabled`, () => {
            //     cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country1').click()
            //     generateViewLink('default')
            //     cy.log(viewURL['default'])
            // })

            // it(`Share ${viewType} view generate URL with a field hidden`, () => {
            //     cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country2').click()
            //     mainPage.hideUnhideField('LastUpdate')
            //     generateViewLink('hide')
            // })

            // it(`Share ${viewType} view generate URL with a field sorted`, () => {
            //     cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country3').click()
            //     mainPage.sortField('Country', 'Z -> A')
            //     generateViewLink('sort')
            // })

            // it(`Share ${viewType} view generate URL with a field filtered`, () => {
            //     cy.get(`.nc-view-item.nc-${viewType}-view-item`).contains('Country4').click()
            //     mainPage.filterField('Country', 'is equal', 'India')
            //     generateViewLink('filter')
            // })        

            // it(`Share ${viewType} view : Access URL with a field hidden`, () => {
            //     // visit public view
            //     cy.visit(viewURL['hide'])
        
            //     // wait for public view page to load!
            //     cy.wait(5000)

            //     // verify title
            //     cy.get('div.model-name').contains('Country2').should('exist')

            //     // verify column headers
            //     cy.get('[data-col="Country"]').should('exist')
            //     cy.get('[data-col="LastUpdate"]').should('not.exist')
            //     cy.get('[data-col="Country => City"]').should('exist')

            //     // country column content verification before sort
            //     mainPage.getCell("Country", 1).contains("Afghanistan").should('exist')
            //     mainPage.getCell("Country", 2).contains("Algeria").should('exist')
            //     mainPage.getCell("Country", 3).contains("American Samoa").should('exist')
            // })
            
            // it(`Share ${viewType} view : Access URL with a field sorted`, () => {
            //     // visit public view
            //     cy.visit(viewURL['sort'])
        
            //     // wait for public view page to load!
            //     cy.wait(5000)

            //     // verify title
            //     cy.get('div.model-name').contains('Country3').should('exist')                

            //     // verify column headers
            //     cy.get('[data-col="Country"]').should('exist')
            //     cy.get('[data-col="LastUpdate"]').should('exist')
            //     cy.get('[data-col="Country => City"]').should('exist')

            //     // country column content verification before sort
            //     mainPage.getCell("Country", 1).contains("Zambia").should('exist')
            // })
            
            // it(`Share ${viewType} view : Access URL with a field filtered`, () => {
            //     // visit public view
            //     cy.visit(viewURL['filter'])
        
            //     // wait for public view page to load!
            //     cy.wait(5000)

            //     // verify title
            //     cy.get('div.model-name').contains('Country4').should('exist')                

            //     // verify column headers
            //     cy.get('[data-col="Country"]').should('exist')
            //     cy.get('[data-col="LastUpdate"]').should('exist')
            //     cy.get('[data-col="Country => City"]').should('exist')

            //     // country column content verification before sort
            //     mainPage.getCell("Country", 1).contains("India").should('exist')
            // })          

            // it(`Share ${viewType} view : Access URL with all fields enabled`, () => {
            //     // visit public view
            //     cy.visit(viewURL['default'])
        
            //     // wait for public view page to load!
            //     cy.wait(5000)

            //     // verify title
            //     cy.get('div.model-name').contains('Country1').should('exist')                

            //     // verify column headers
            //     cy.get('[data-col="Country"]').should('exist')
            //     cy.get('[data-col="LastUpdate"]').should('exist')
            //     cy.get('[data-col="Country => City"]').should('exist')

            //     // country column content verification before sort
            //     mainPage.getCell("Country", 1).contains("Afghanistan").should('exist')
            //     mainPage.getCell("Country", 2).contains("Algeria").should('exist')
            //     mainPage.getCell("Country", 3).contains("American Samoa").should('exist')
            // })

            it(`Share ${viewType.toUpperCase()} view : Disable sort`, () => {
                // remove sort and validate
                mainPage.clearSort()
                mainPage.getCell("District", 1).contains("Southern Mindanao").should('exist')
            })

            it(`Share ${viewType.toUpperCase()} view : Enable sort`, () => {
                // Sort menu operations (Country Column, Z->A)
                //cy.wait(5000)
                mainPage.sortField('District', 'Z -> A')
                mainPage.getCell("District", 1).contains("West Bengali").should('exist')
            })

            it(`Share ${viewType.toUpperCase()} view : Create Filter`, () => {
                // add filter & validate
                mainPage.filterField('District', 'is like', 'Tamil')
                cy.wait(1000)
                mainPage.getCell("District", 1).contains("Tamil").should('exist')
            })

            it(`Share ${viewType.toUpperCase()} view : verify download CSV after local filter`, () => {
                mainPage.hideUnhideField('LastUpdate')
                const verifyCsv = (retrievedRecords) => {
                    // expected output, statically configured
                    let storedRecords = [
                        `Address,District,PostalCode,Phone,Location,Address => Customer,Address => Staff,City <= Address,Address <=> Staff`,
                        `1993 Tabuk Lane,Tamil Nadu,64221,648482415405,[object Object],2,,Tambaram,`,
                        `1661 Abha Drive,Tamil Nadu,14400,270456873752,[object Object],1,,Pudukkottai,`
                    ]
                    
                    // for (let i = 0; i < storedRecords.length; i++) {
                    //     expect(retrievedRecords[i]).to.be.equal(storedRecords[i])
                    // }

                    for (let i = 0; i < storedRecords.length; i++) {
                        let strCol = storedRecords[i].split(',')
                        let retCol = retrievedRecords[i].split(',')
                        for (let j = 0; j < 4; j++) {
                            expect(strCol[j]).to.be.equal(retCol[j])
                        }
                    }                    
                }                  
                mainPage.downloadAndVerifyCsv(`Address_exported_1.csv`, verifyCsv)
                mainPage.hideUnhideField('LastUpdate')
            })            

            it(`Share ${viewType.toUpperCase()} view : Delete Filter`, () => {
                // Remove sort and Validate
                mainPage.filterReset()
                mainPage.getCell("District", 1).contains("West Bengali").should('exist')
            })
            
            it(`Share GRID view : Virtual column validation > has many`, () => {
                // verify column headers
                cy.get('[data-col="Address => Customer"]').should('exist')
                cy.get('[data-col="Address => Staff"]').should('exist')
                cy.get('[data-col="City <= Address"]').should('exist')
                cy.get('[data-col="Address <=> Staff"]').should('exist')

                // has many field validation
                mainPage.getCell("Address => Customer", 3).click().find('button.mdi-close-thick').should('not.exist')
                mainPage.getCell("Address => Customer", 3).click().find('button.mdi-plus').should('not.exist')
                mainPage.getCell("Address => Customer", 3).click().find('button.mdi-arrow-expand').click()

                cy.getActiveModal().find('button.mdi-reload').should('exist')
                cy.getActiveModal().find('button').contains('Link to').should('not.exist')
                cy.getActiveModal().find('.child-card').contains('2').should('exist')
                cy.getActiveModal().find('.child-card').find('button').should('not.exist')
                cy.get('body').type('{esc}')
            })

            it(`Share GRID view : Virtual column validation > belongs to`, () => {
                // belongs to field validation
                mainPage.getCell("City <= Address", 1).click().find('button.mdi-close-thick').should('not.exist')
                mainPage.getCell("City <= Address", 1).click().find('button.mdi-arrow-expand').should('not.exist')
                mainPage.getCell("City <= Address", 1).find('.v-chip').contains('Kanchrapara').should('exist')
            })

            it(`Share GRID view : Virtual column validation > many to many`, () => {
                // many-to-many field validation
                mainPage.getCell("Address <=> Staff", 1).click().find('button.mdi-close-thick').should('not.exist')
                mainPage.getCell("Address <=> Staff", 1).click().find('button.mdi-plus').should('not.exist')
                mainPage.getCell("Address <=> Staff", 1).click().find('button.mdi-arrow-expand').click()

                cy.getActiveModal().find('button.mdi-reload').should('exist')
                cy.getActiveModal().find('button').contains('Link to').should('not.exist')
                // cy.getActiveModal().find('.child-card').contains('Mike').should('exist')
                //cy.getActiveModal().find('.child-card').find('button').should('not.exist')
                cy.get('body').type('{esc}')
            })       

            it(`Delete ${viewType.toUpperCase()} view`, () => {
                // go back to base page
                cy.visit(baseURL)

                // number of view entries should be 2 before we delete
                cy.get('.nc-view-item').its('length').should('eq', 2)

                // // click on delete icon (becomes visible on hovering mouse)
                // cy.get('.nc-view-delete-icon').eq(3).click({ force: true })
                // cy.wait(1000)

                // cy.get('.nc-view-delete-icon').eq(2).click({ force: true })
                // cy.wait(1000)            

                // cy.get('.nc-view-delete-icon').eq(1).click({ force: true })
                // cy.wait(1000)

                cy.get('.nc-view-delete-icon').eq(0).click({ force: true })
                cy.wait(1000)
                
                // confirm if the number of veiw entries is reduced by 1
                cy.get('.nc-view-item').its('length').should('eq', 1)
            })
        }

        // below scenario's will be invoked twice, once for rest & then for graphql
        viewTest('grid')
    })
    
    // describe(`${type.toUpperCase()} api - Grid view/ Virtual column verification`, () => {

    //     before(() => {
    //         // Address table has belongs to, has many & many-to-many
    //         cy.openTableTab('Address');
    //         cy.saveLocalStorage()
    //         // store base URL- to re-visit and delete form view later
    //         cy.url().then((url) => {
    //             baseURL = url
    //             generateViewLink('virtualColumn')
    //         })            
    //     })

    //     beforeEach(() => {
    //         cy.restoreLocalStorage();
    //     })

    //     afterEach(() => {
    //         cy.saveLocalStorage();
    //     })
        
    //     after(() => {
    //         // close table
    //         cy.visit(baseURL)
    //         mainPage.deleteCreatedViews()
    //         cy.closeTableTab('Address')
    //     })

    //     it(`Generate default Shared GRID view URL`, () => {
    //         // visit public view
    //         cy.visit(viewURL['virtualColumn'])
    //         // wait for public view page to load!
    //         cy.wait(5000)
    //     })

    //     it(`Share GRID view : Virtual column validation > has many`, () => {
    //         // verify column headers
    //         cy.get('[data-col="Address => Customer"]').should('exist')
    //         cy.get('[data-col="Address => Staff"]').should('exist')
    //         cy.get('[data-col="City <= Address"]').should('exist')
    //         cy.get('[data-col="Address <=> Staff"]').should('exist')

    //         // has many field validation
    //         mainPage.getCell("Address => Staff", 3).click().find('button.mdi-close-thick').should('not.exist')
    //         mainPage.getCell("Address => Staff", 3).click().find('button.mdi-plus').should('not.exist')
    //         mainPage.getCell("Address => Staff", 3).click().find('button.mdi-arrow-expand').click()

    //         cy.getActiveModal().find('button.mdi-reload').should('exist')
    //         cy.getActiveModal().find('button').contains('Link to').should('not.exist')
    //         cy.getActiveModal().find('.child-card').contains('Mike').should('exist')
    //         cy.getActiveModal().find('.child-card').find('button').should('not.exist')
    //         cy.get('body').type('{esc}')
    //     })

    //     it(`Share GRID view : Virtual column validation > belongs to`, () => {
    //         // belongs to field validation
    //         mainPage.getCell("City <= Address", 1).click().find('button.mdi-close-thick').should('not.exist')
    //         mainPage.getCell("City <= Address", 1).click().find('button.mdi-arrow-expand').should('not.exist')
    //         mainPage.getCell("City <= Address", 1).find('.v-chip').contains('Lethbridge').should('exist')
    //     })

    //     it(`Share GRID view : Virtual column validation > many to many`, () => {
    //         // many-to-many field validation
    //         mainPage.getCell("Address <=> Staff", 1).click().find('button.mdi-close-thick').should('not.exist')
    //         mainPage.getCell("Address <=> Staff", 1).click().find('button.mdi-plus').should('not.exist')
    //         mainPage.getCell("Address <=> Staff", 1).click().find('button.mdi-arrow-expand').click()

    //         cy.getActiveModal().find('button.mdi-reload').should('exist')
    //         cy.getActiveModal().find('button').contains('Link to').should('not.exist')
    //         cy.getActiveModal().find('.child-card').contains('Mike').should('exist')
    //         cy.getActiveModal().find('.child-card').find('button').should('not.exist')
    //         cy.get('body').type('{esc}')
    //     })
    // })

    describe(`${type.toUpperCase()} api - Grid view/ row-column update verification`, () => {
        before(() => {
            // Address table has belongs to, has many & many-to-many
            cy.openTableTab('Country')
            cy.saveLocalStorage()
            // store base URL- to re-visit and delete form view later
            cy.url().then((url) => {
                baseURL = url
                generateViewLink('rowColUpdate')
            })            
        })
        
        after(() => {
            // close table
            cy.restoreLocalStorage();
            cy.visit(baseURL)

            // delete row
            mainPage.getPagination(5).click()
            cy.wait(3000)
            mainPage.getRow(10).find('.mdi-checkbox-blank-outline').click({ force: true })
            mainPage.getCell("Country", 10).rightclick()
            cy.getActiveMenu().contains('Delete Selected Row').click()

            // delete column
            cy.get(`th:contains('dummy') .mdi-menu-down`)
                .trigger('mouseover')
                .click()
            cy.get('.nc-column-delete').click()
            cy.get('button:contains(Confirm)').click()

            mainPage.deleteCreatedViews()
            
            // close table
            cy.closeTableTab('Country')
        })

        it(`Generate default Shared GRID view URL`, () => {
            // add row
            cy.get('.nc-add-new-row-btn').click({force: true})
            cy.get('#data-table-form-Country > input').first().click().type('a')
            cy.contains('Save Row').filter('button').click({ force: true })
            cy.wait(1000)

            // add column
            mainPage.addColumn('dummy')
            cy.wait(5000)

            // visit public view
            cy.log(viewURL['rowColUpdate'])
            cy.restoreLocalStorage();
            cy.visit(viewURL['rowColUpdate']) //5
            // wait for public view page to load!
            cy.wait(5000)
        })

        it(`Share GRID view : new row visible`, () => {
            // verify row 
            cy.get(`.v-pagination > li:contains('5') button`).click()
            cy.wait(3000)
            mainPage.getCell('Country', 10).contains('a').should('exist')            
        })

        it.skip(`Share GRID view : new column visible`, () => {
            // verify column headers
            cy.get('[data-col="dummy"]').should('exist')
        })
    })
}

// invoke for different API types supported
//
// genTest('rest', false)
// genTest('graphql', false)


/**
 * @copyright Copyright (c) 2021, Xgene Cloud Ltd
 *
 * @author Pranav C Balan <pranavxc@gmail.com>
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
