/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  presets: [require("nativewind/preset")], 
  theme: {
    extend: {
      colors: {
        spotify: {
          green: '#1DB954',
          black: '#121212',
          dark:  '#282828',
          gray:  '#B3B3B3',
        }
      }
    },
  },
  plugins: [],
};