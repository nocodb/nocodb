import { loginPage, projectsPage } from "../../support/page_objects/navigation"
import { staticProjects, roles } from "../../support/page_objects/projectConstants"
import { mainPage } from "../../support/page_objects/mainPage"

// https://stackoverflow.com/questions/38552003/how-to-decode-jwt-token-in-javascript-without-using-a-library
// sample code to parse Jwt
//
function parseJwt (token) {
    var base64Url = token.split('.')[1];
    var base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    var jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
    }).join(''))

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
            var decodedToken = parseJwt(mainPage.getAuthToken())
            let email = decodedToken["email"]
            let role = decodedToken["roles"]

            assert.equal(email, roles.owner.credentials.username)
            assert.equal(role, "user")
        })
    })
}

genTest('rest')
genTest('graphql')
genTest('rest', true)
genTest('graphql', true)