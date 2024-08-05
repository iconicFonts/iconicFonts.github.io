import globals from "globals"
import pluginJs from "@eslint/js"
import html from "@html-eslint/eslint-plugin"
import js from "@eslint/js"

export default [
  js.configs.recommended,
  pluginJs.configs.recommended,
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
        myCustomGlobal: "readonly",
      },
    },
    rules: {
      semi: "error",
    },
  },
  {
    files: ["**/*.html"],
    ...html.configs["flat/recommended"],
    rules: {
      ...html.configs["flat/recommended"].rules, // Must be defined. If not, all recommended rules will be lost
      "@html-eslint/indent": ["error", 2],
      // "@html-eslint/require-closing-tags": [
      //   "error",
      //   { selfClosingCustomPatterns: ["meta", "link"] },
      // ],
      // "@html-eslint/no-extra-spacing-attrs": [
      //   "error",
      //   { enforceBeforeSelfClose: true },
      // ],
    },
  },
]
