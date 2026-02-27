/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'atomic-orange': '#E85D04',
        'sunshine-yellow': '#FFC300',
        'paprika': '#DC2F02',
        'turquoise': '#00B4D8',
        'groovy-teal': '#0077B6',
      },
      transitionTimingFunction: {
        groovy: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
      },
    },
  },
  plugins: [],
}
