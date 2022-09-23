import { isTestSuiteActive } from '../../support/page_objects/projectConstants'
import { mainPage } from '../../support/page_objects/mainPage'
import { loginPage } from '../../support/page_objects/navigation'

const formTitle = '4G Survey Form'
const formDescription = '4G Survey Form Description'

export const genTest = (apiType, dbType) => {
  if (!isTestSuiteActive(apiType, dbType)) return

  describe(`${apiType.toUpperCase()} api - FORM view (Share)`, () => {
    before(() => {
      // loginPage.loginAndOpenProject(apiType, dbType);
      cy.restoreLocalStorage()
      cy.openTableTab('City', 25)
    })

    beforeEach(() => {
      cy.restoreLocalStorage()
    })

    afterEach(() => {
      cy.saveLocalStorage()
    })

    after(() => {
      cy.restoreLocalStorage()
      cy.closeTableTab('City')
      cy.saveLocalStorage()
    })

    it(`Create form view`, () => {
      // click on create grid view button
      cy.get(`.nc-create form-view`).click()

      // Pop up window, click Submit (accepting default name for view)
      cy.getActiveModal('.nc-modal-view-create').find('button:contains(Submit)').click()

      cy.toastWait('View created successfully')

      // validate if view was creted && contains default name 'Country1'
      cy.get(`.nc-view-item.nc form-view-item`).contains('Form-1').should('exist')

      // Prepare form
      //      add header, description
      //      add post submission message
      //      swap position for City, LastUpdate fields
      //      remove City=>Address field
      // enable "Submit another form" check box
      cy.get('button.nc-form-checkbox-show-blank-form').click()

      // Update header & add some description, verify
      cy.get('.nc-form').find('[placeholder="Form Title"]').clear().type(formTitle)
      cy.get('.nc-form').find('[placeholder="Add form description"]').type(formDescription)

      // add message
      cy.get('textarea.nc-form-after-submit-msg').type('Congratulations!')

      // move Country field down (drag, drop)
      cy.get('.nc-form-drag-LastUpdate').drag('.nc-form-drag-City')

      cy.get('[title="Address List"]').drag('.nc-drag-n-drop-to-hide')
    })

    it(`Share form view`, () => {
      cy.get(`.nc-view-item.nc form-view-item`).contains('Form-1').click()

      cy.wait(2000)
      mainPage.shareView().click()

      // copy link text, visit URL
      cy.getActiveModal('.nc-modal-share-view')
        .should('exist')
        .find('.share-link-box')
        .contains('/nc/form/', { timeout: 10000 })
        .should('exist')
        .then(($obj) => {
          const linkText = $obj.text().trim()
          cy.log(linkText)

          cy.signOut()

          cy.visit(linkText, {
            baseUrl: null,
          })
          cy.wait(5000)

          // wait for share view page to load!

          cy.get('.nc-form').should('exist')

          // New form appeared? Header & description should exist
          cy.get('.nc-form-view', { timeout: 10000 }).find('h1').contains(formTitle).should('exist')
          cy.get('.nc-form-view', { timeout: 10000 }).find('h2').contains(formDescription).should('exist')

          // all fields, barring removed field should exist
          cy.get('[title="City"]').should('exist')
          cy.get('[title="LastUpdate"]').should('exist')
          cy.get('[title="Country"]').should('exist')
          cy.get('[title="Address List"]').should('not.exist')

          // order of LastUpdate & City field is retained
          cy.get('.nc-form-column-label').eq(0).contains('LastUpdate').should('exist')
          cy.get('.nc-form-column-label').eq(1).contains('City').should('exist')

          // submit form, to read message
          cy.get('.nc-form-input-City').type('_abc')
          cy.get('.nc-form-input-LastUpdate').click()
          cy.get('.ant-picker-now-btn:visible').contains('Now').click()
          cy.get('.ant-btn-primary:visible').contains('Ok').click()
        })
    })

    it(`Delete form view`, () => {
      // go back to base page
      loginPage.loginAndOpenProject(apiType, dbType)
      cy.openTableTab('City', 25)

      // number of view entries should be 2 before we delete
      cy.get('.nc-view-item').its('length').should('eq', 2)

      // click on delete icon (becomes visible on hovering mouse)
      cy.get('.nc-view-delete-icon').click({ force: true })
      cy.wait(1000)
      cy.getActiveModal('.nc-modal-view-delete').find('.ant-btn-dangerous').should('exist').click()
      cy.toastWait('View deleted successfully')

      // confirm if the number of veiw entries is reduced by 1
      cy.get('.nc-view-item').its('length').should('eq', 1)
    })
  })
}
