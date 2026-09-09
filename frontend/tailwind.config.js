/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx}',
    './components/**/*.{js,jsx}',
  ],
  theme: {
    extend: {
      colors: {
        safe: '#16a34a',
        warning: '#d97706',
        danger: '#dc2626',
        ink: '#0f172a',
      },
    },
  },
  plugins: [],
};
