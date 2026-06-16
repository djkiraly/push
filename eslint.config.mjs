// ESLint v9 flat config. Next 16 removed `next lint`, and ESLint v9 no longer
// reads legacy `.eslintrc.*`, so the project's lint rules live here. The
// `eslint-config-next` v16 subpaths export flat-config arrays directly, so we
// spread them — no FlatCompat needed.
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "dist/**",
      "coverage/**",
      "data/**",
      "logs/**",
      "media/**",
      "prisma/migrations/**",
    ],
  },
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports" },
      ],
      "react/no-unescaped-entities": "off",
    },
  },
];

export default config;
