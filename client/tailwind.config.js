/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        harisco: {
          blue: "#004A99",
          dark: "#003366",
          light: "#E6F0FF",
        }
      }
    },
  },
  plugins: [],
}
