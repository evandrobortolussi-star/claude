import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eefcf5',
          100: '#d6f7e6',
          200: '#b0edd0',
          300: '#7bdcb3',
          400: '#43c391',
          500: '#1fa876',
          600: '#14875f',
          700: '#136c4e',
          800: '#135640',
          900: '#124737',
        },
        income: '#1fa876',
        expense: '#e5484d',
      },
      borderRadius: {
        xl: '1rem',
        '2xl': '1.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(0 0 0 / 0.04), 0 1px 6px -1px rgb(0 0 0 / 0.06)',
      },
    },
  },
  plugins: [],
};

export default config;
