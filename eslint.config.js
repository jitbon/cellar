import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', '**/node_modules/**', 'supabase/.temp/**', '.claude/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { languageOptions: { globals: { ...globals.browser, ...globals.node } } },
  {
    // Constitution III: the core is framework- and platform-free.
    files: ['packages/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['react', 'react-dom', 'react-dom/*', 'react/*'],
              message: 'Core must not depend on React.',
            },
            { group: ['@supabase/*'], message: 'Core must not depend on Supabase.' },
          ],
        },
      ],
    },
  },
);
