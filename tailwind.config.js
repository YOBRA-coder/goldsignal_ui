/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0b0e11",
        panel: "#12161c",
        panel2: "#181d25",
        border: "#232a35",
        bull: "#12b886",
        bear: "#ff4d4f",
        gold: "#d4af37",
        accent: "#3b82f6",
      },
    },
  },
  plugins: [],
};
