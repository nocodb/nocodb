const {
    defineConfig,
    globalIgnores,
} = require("eslint/config");

const tsParser = require("@typescript-eslint/parser");
const _import = require("eslint-plugin-import");
const eslintComments = require("eslint-plugin-eslint-comments");
const functional = require("eslint-plugin-functional");

const {
    fixupPluginRules,
    fixupConfigRules,
} = require("@eslint/compat");

const globals = require("globals");
const js = require("@eslint/js");

const {
    FlatCompat,
} = require("@eslint/eslintrc");

const compat = new FlatCompat({
    baseDirectory: __dirname,
    recommendedConfig: js.configs.recommended,
    allConfig: js.configs.all
});

module.exports = defineConfig([{
    languageOptions: {
        parser: tsParser,
        sourceType: "module",

        parserOptions: {
            project: "tsconfig.json",
            tsconfigRootDir: __dirname,
        },

        globals: {
            ...globals.node,
            ...globals.jest,
        },
    },

    plugins: {
        import: fixupPluginRules(_import),
        "eslint-comments": eslintComments,
        functional,
    },

    extends: fixupConfigRules(compat.extends(
        "eslint:recommended",
        "plugin:eslint-comments/recommended",
        "plugin:@typescript-eslint/recommended",
        "plugin:import/typescript",
        "plugin:prettier/recommended",
    )),

    rules: {
        "@typescript-eslint/explicit-module-boundary-types": "off",

        "eslint-comments/disable-enable-pair": ["error", {
            allowWholeFile: true,
        }],

        "eslint-comments/no-unused-disable": "error",

        "sort-imports": ["error", {
            ignoreDeclarationSort: true,
            ignoreCase: true,
        }],

        "import/order": ["error", {
            groups: [
                "builtin",
                "external",
                "internal",
                "parent",
                "sibling",
                "index",
                "object",
                "type",
            ],
        }],

        "@typescript-eslint/no-unused-vars": ["error", {
            argsIgnorePattern: "^_",
            varsIgnorePattern: "^_",
            caughtErrorsIgnorePattern: "^_",
            ignoreRestSiblings: true,
        }],

        "@typescript-eslint/no-this-alias": "off",
        "@typescript-eslint/ban-ts-comment": "off",
        "@typescript-eslint/no-explicit-any": "off",
        "@typescript-eslint/no-var-requires": "off",
        "no-useless-catch": "off",
        "no-empty": "off",
        "@typescript-eslint/no-empty-function": "off",
        "@typescript-eslint/consistent-type-imports": "warn",
    },
}, globalIgnores([
    "**/node_modules",
    "**/build",
    "**/coverage",
    "**/dist",
    "**/nc",
    "**/.eslintrc.js",
    "src/nocodb/cli.js",
])]);
