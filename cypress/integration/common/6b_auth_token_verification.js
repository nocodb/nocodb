import { loginPage, projectsPage } from "../../support/page_objects/navigation"
import { staticProjects, roles } from "../../support/page_objects/projectConstants"

function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''));

    return JSON.parse(jsonPayload);
};

const genTest = (type, xcdb) => {

    describe(`${type.toUpperCase()} Authentication token validation`, () => {

        // Run once before test- open project (rest/graphql)
        //
        before(() => {
            loginPage.loginAndOpenProject(type, xcdb)
        })

        it('auth info', ()=> {
            let obj = JSON.parse(localStorage['vuex'])
            var decoded = parseJwt(obj["users"]["token"])
            let email = decoded["email"]
            let role = decoded["roles"]

            assert.equal(email, roles.owner.credentials.username)
            assert.equal(role, "user")
        })
    })
}

genTest('rest')
genTest('graphql')
genTest('rest', true)
genTest('graphql', true)