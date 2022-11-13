/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./app/**/*.{ts,tsx,jsx,js}"],
  theme: {
    extend: {
      colors: {
        edtext: "#f5f5f5",
        edbackground: "#000035",
        edspark: {
          1: "#00F6B7",
          10: "#00F38C",
          20: "#7BFC41",
        },
        edwarning: "#FF5757",
        ewwarning: "#FF5757",
        ewtext: "#000035",
        ewbackground: "#F5F5F5",
        ewspark: {
          1: "#00F6B7",
          10: "#4EE794",
          20: "#60E524",
        },
      },
    },
  },
  plugins: [require("@tailwindcss/forms")],
};
