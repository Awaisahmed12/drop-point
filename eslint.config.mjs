import coreWebVitals from "eslint-config-next/core-web-vitals";
import typescript from "eslint-config-next/typescript";

// eslint-config-next 16 exports native flat configs; the old FlatCompat
// shim crashes with "Converting circular structure to JSON", and `next lint`
// no longer exists, so `npm run lint` invokes eslint directly.
const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "coverage/**"],
  },
];

export default eslintConfig;
