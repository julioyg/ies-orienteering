/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./printable-controls.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        iof: {
          orange: '#FF5500',
          dark: '#0F172A',
        }
      },
      fontFamily: {
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', '"Liberation Mono"', '"Courier New"', 'monospace'],
      }
    },
  },
  plugins: [],
}
