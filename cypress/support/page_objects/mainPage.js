
// main page
export class _mainPage {

    constructor() {

        // Top Right items
        this.SHARE = 0
        this.THEME_BODY = 1
        this.THEME_HEADER = 2
        this.ALERT = 3
        this.LANGUAGE = 4
        this.USER = 5

        // Top Left items
        this.HOME = 0
        this.GIT_HOME = 1
        this.GIT_STAR = 2
        this.GIT_DOCS = 3

        this.AUDIT = 0
        this.APPSTORE = 2
        this.TEAM_N_AUTH = 3
        this.PROJ_METADATA = 4
        this.ROLE_VIEW = 5

        // this.EDITOR = 'editor'
        // this.COMMENTER = 'commenter'
        // this.VIEWER = 'viewer'
    }

    toolBarTopLeft(toolBarItem) {

        cy.get('header.v-toolbar').eq(0).find('a').then((obj) => {
            cy.wrap(obj).eq(toolBarItem).click()

            // just for test
            // only Home page is internal link
            // all others open in another tab
            //
            // if (toolBarItem == toolBar.HOME) {
            //     cy.url({ timeout: 6000 }).should('contain', '#/project')
            //     cy.wait(6000)
            // }
        })
    }

    toolBarTopRight(toolBarItem) {

        cy.get('header.v-toolbar').eq(0).find('button').then((obj) => {
            cy.wrap(obj).eq(toolBarItem).click()
            cy.wait(500)

            // just for test
            // if (toolBarItem == toolBar.SHARE ||
            //     toolBarItem == toolBar.ALERT ||
            //     toolBarItem == toolBar.LANGUAGE ||
            //     toolBarItem == toolBar.USER
            // ) { cy.get('body').type('{esc}') }
        })
    }


    navigationDraw(item) {

        if (item == this.ROLE_VIEW)
            return cy.get('.nc-nav-drawer').find('.v-list').eq(3)
        else
            return cy.get('.nc-nav-drawer').find('.v-list > .v-list-item').eq(item)
    }
}


export const mainPage = new _mainPage;


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