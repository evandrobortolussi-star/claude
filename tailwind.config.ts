import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'media',
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      colors: {
        // "Institutional Ledger" — paleta papel/tinta com verde-floresta e
        // cobre, em OKLCH. `brand` é a escala principal (forest no 600);
        // income/expense/paper/cream/ink/faint/line são tokens semânticos
        // de apoio. Tailwind 3.4 aplica modificadores de opacidade
        // (`bg-brand-600/50`) a qualquer formato de cor, incluindo oklch().
        brand: {
          50: 'oklch(0.93 0.025 155)',
          100: 'oklch(0.88 0.035 155)',
          200: 'oklch(0.80 0.05 155)',
          300: 'oklch(0.70 0.06 155)',
          400: 'oklch(0.58 0.065 155)',
          500: 'oklch(0.46 0.06 155)',
          600: 'oklch(0.372 0.052 155)',
          700: 'oklch(0.30 0.045 155)',
          800: 'oklch(0.24 0.038 155)',
          900: 'oklch(0.19 0.03 155)',
        },
        income: 'oklch(0.372 0.052 155)',
        expense: 'oklch(0.514 0.117 47)',
        paper: 'oklch(0.955 0.014 88)',
        cream: 'oklch(0.979 0.008 88)',
        ink: 'oklch(0.213 0.008 75)',
        faint: 'oklch(0.607 0.014 78)',
        line: 'oklch(0.902 0.021 85)',
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
