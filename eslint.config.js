
import eslintPluginUnicorn from "eslint-plugin-unicorn";

import eslintReact from "@eslint-react/eslint-plugin";

import js from "@eslint/js";
import importPlugin from "eslint-plugin-import";
import eslintPluginPrettier from "eslint-plugin-prettier";
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: [ "dist" ] },
  {
    settings: {
      "import/resolver": {
        typescript: {
          project: [ "tsconfig.app.json" ],
          tsconfigRootDir: "./",
        }, // this loads <root>/tsconfig.json to eslint
      },
    },
    extends: [
      js.configs.recommended,
      ...tseslint.configs.recommended,
      eslintReact.configs.recommended,
      eslintPluginPrettierRecommended

    ],
    files: [ "**/*.{ts,tsx}" ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      unicorn: eslintPluginUnicorn,
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
      react: react,
      prettier: eslintPluginPrettier,
      "unused-imports": unusedImports,
      import: importPlugin,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "no-restricted-imports": [
        "error",
        {
          "patterns": [ "@mui/*/*/*" ]
        }
      ],
      "import/order": [
        "error",
        {
          "groups": [ "builtin", "external", "internal" ],
          "pathGroups": [
            {
              "pattern": "react",
              "group": "external",
              "position": "before"
            }
          ],
          "pathGroupsExcludedImportTypes": [ "react" ],
          "newlines-between": "always",
          "alphabetize": {
            "order": "asc",
            "caseInsensitive": true
          }
        }
      ],
      "unicorn/filename-case": [
        "error",
        {
          case: "kebabCase",
        },
      ],
      "@eslint-react/naming-convention/component-name": [
        "error",
        {
          rule: "PascalCase",
        },
      ],

      "@eslint-react/no-array-index-key": "off",
      "@eslint-react/no-unstable-context-value": "error",
      "import/no-unresolved": "error",
      "react/jsx-key": [ 1, { checkFragmentShorthand: true } ],
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
      "react/jsx-uses-react": "off",
      "react/react-in-jsx-scope": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-empty-object-type": "off",
      "no-unused-vars": "off", // or "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "prettier/prettier": [
        "error",
        {},
        {
          "usePrettierrc": true,
          "fileInfoOptions": {
            "withNodeModules": true
          }
        }
      ]
    },
  },
);
