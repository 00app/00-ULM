import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        ice: '#FDFDFF',
        blue: '#000AFF',
        deep: '#141268',
      },
      fontFamily: {
        sans: ['Roboto', 'sans-serif'],
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
      transitionDuration: {
        'fast': '120ms',
        'normal': '150ms',
        'slow': '180ms',
      },
      transitionTimingFunction: {
        'zero': 'cubic-bezier(0.2, 0.8, 0.2, 1)',
      },
    },
  },
  plugins: [],
}
export default config
