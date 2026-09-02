import type { Config } from 'tailwindcss';

/**
 * Ryse Design System
 * -------------------------------------------------------------------------
 * Todas as cores sao expostas como canais HSL em `app/globals.css`, o que
 * permite usar modificadores de opacidade do Tailwind (ex.: `bg-brand/10`)
 * e trocar o tema inteiro apenas alternando a classe `.dark` no <html>.
 *
 * Light: branco + laranja + detalhes pretos
 * Dark:  preto  + laranja + detalhes brancos
 */
const withAlpha = (variable: string) => `hsl(var(${variable}) / <alpha-value>)`;

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* superficies */
        canvas: withAlpha('--canvas'),
        surface: withAlpha('--surface'),
        'surface-2': withAlpha('--surface-2'),
        'surface-3': withAlpha('--surface-3'),

        /* texto */
        fg: withAlpha('--fg'),
        muted: withAlpha('--fg-muted'),
        subtle: withAlpha('--fg-subtle'),

        /* linhas */
        line: withAlpha('--line'),
        'line-strong': withAlpha('--line-strong'),

        /* marca (laranja) */
        brand: {
          DEFAULT: withAlpha('--brand'),
          on: withAlpha('--brand-on'),
          text: withAlpha('--brand-text'),
          soft: withAlpha('--brand-soft'),
          line: withAlpha('--brand-line'),
          hover: withAlpha('--brand-hover'),
        },

        /* estados */
        success: {
          DEFAULT: withAlpha('--success'),
          soft: withAlpha('--success-soft'),
        },
        danger: {
          DEFAULT: withAlpha('--danger'),
          soft: withAlpha('--danger-soft'),
        },
        warn: {
          DEFAULT: withAlpha('--warn'),
          soft: withAlpha('--warn-soft'),
        },

        /* dataviz — series categoricas validadas (ver globals.css) */
        cat: {
          1: withAlpha('--cat-1'),
          2: withAlpha('--cat-2'),
          3: withAlpha('--cat-3'),
        },
        'chart-grid': withAlpha('--chart-grid'),
        'chart-axis': withAlpha('--chart-axis'),

        /* contraste puro (preto no light / branco no dark) */
        ink: withAlpha('--ink'),
        'ink-on': withAlpha('--ink-on'),
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        xl: '0.875rem',
        '2xl': '1.125rem',
        '3xl': '1.5rem',
      },
      spacing: {
        'safe-t': 'env(safe-area-inset-top)',
        'safe-b': 'env(safe-area-inset-bottom)',
        'safe-l': 'env(safe-area-inset-left)',
        'safe-r': 'env(safe-area-inset-right)',
        header: '3.5rem',
        tabbar: '4.25rem',
      },
      boxShadow: {
        card: '0 1px 2px 0 hsl(var(--shadow) / 0.05), 0 1px 3px -1px hsl(var(--shadow) / 0.07)',
        lift: '0 4px 12px -2px hsl(var(--shadow) / 0.10), 0 2px 4px -2px hsl(var(--shadow) / 0.06)',
        pop: '0 12px 32px -8px hsl(var(--shadow) / 0.22)',
        brand: '0 6px 20px -6px hsl(var(--brand) / 0.55)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'sheet-up': {
          from: { transform: 'translateY(100%)' },
          to: { transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(.96)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'backdrop-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'drawer-in': {
          from: { transform: 'translateX(-100%)' },
          to: { transform: 'translateX(0)' },
        },
        shimmer: { '100%': { transform: 'translateX(100%)' } },
        'pulse-ring': {
          '0%': { transform: 'scale(.85)', opacity: '.7' },
          '70%': { transform: 'scale(1.5)', opacity: '0' },
          '100%': { opacity: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in .32s cubic-bezier(.16,1,.3,1) both',
        'sheet-up': 'sheet-up .28s cubic-bezier(.16,1,.3,1) both',
        'scale-in': 'scale-in .18s cubic-bezier(.16,1,.3,1) both',
        'backdrop-in': 'backdrop-in .2s ease-out both',
        'drawer-in': 'drawer-in .28s cubic-bezier(.16,1,.3,1) both',
        'pulse-ring': 'pulse-ring 2s cubic-bezier(.24,.6,.35,1) infinite',
      },
      transitionTimingFunction: {
        spring: 'cubic-bezier(.16,1,.3,1)',
      },
    },
  },
  plugins: [],
};

export default config;
