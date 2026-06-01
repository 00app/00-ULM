import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./app/**/*.{js,ts,jsx,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        yellow: '#FFD700',
        pink: '#FF00FF',
        purple: '#7800ce',
      },
      fontFamily: {
        sans: ['var(--font-roboto)', 'sans-serif'],
      },
      fontWeight: {
        black: '900',
        regular: '400',
      },
      borderRadius: {
        'button': '40px',
        'input': '30px',
        'input-focus': '40px',
        'dropdown': '30px',
        'dropdown-open': '40px',
        'pill': '18px',
        'pill-selected': '22px',
        'badge': '12px',
        'card': '60px',
        'card-hover': '100px',
        'sheet': '60px',
        'sheet-active': '100px',
      },
      transitionTimingFunction: {
        'zero': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
        'fussy': 'cubic-bezier(0, 0, 0, 1)',
      },
    },
  },
  plugins: [],
}
export default config
