import {createEmailClient} from "vue-extensible-mail";
import components from "./templates/components";
import assets from "./templates/assets";
import * as fs from "node:fs";
import decode from 'html-entities-decoder';


const emailClient = createEmailClient({
    path: "./src/templates",
    components: {
        ...components,
        ...assets
    },
});


const exportString = 'export default `'

if (fs.existsSync("./.dist")) {
    fs.rmdirSync("./.dist", {recursive: true});
}


for (const file of fs.readdirSync("./src/templates")) {
    if (file.endsWith(".vue")) {
        const markup = decode(await emailClient.renderEmail(file, {}, {}))

        if (!fs.existsSync("./.dist")) {
            fs.mkdirSync("./.dist");
        }
        fs.writeFileSync(`./.dist/${file.replace(".vue", ".ts")}`, exportString + markup + "`")
    }
}