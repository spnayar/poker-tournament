/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        felt: {
          DEFAULT: "#1a5c38",
          dark: "#0f3d25",
          light: "#2d7a4f",
        },
      },
    },
  },
  plugins: [],
};
