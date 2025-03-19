import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import reacteslint from 'eslint-plugin-react';
import eslintPluginReactHooks from 'eslint-plugin-react-hooks';

export default tseslint.config(
  eslint.configs.recommended,
  reacteslint.configs.flat.recommended,
  reacteslint.configs.flat['jsx-runtime'],
  tseslint.configs.recommendedTypeChecked,
  {
    plugins: {
      'react-hooks': eslintPluginReactHooks,
    },
    rules: { ...eslintPluginReactHooks.configs.recommended.rules },
  },
  {
    ignores: ['dist/**', '**/*.mjs', '**/*.js'],
  },
  {
    files: ['src/**/*.{ts, tsx}'],
    ...reacteslint.configs.flat.recommended,
  },
  {
    settings: { react: { version: '18.3' } },
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  }
);