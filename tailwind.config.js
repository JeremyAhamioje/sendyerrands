/** @type {import('tailwindcss').Config} */
// Sendy Errands design tokens — mirror of design.md §5–§7.
// Edit here and every screen updates.
module.exports = {
  content: ["./app/**/*.{js,jsx,ts,tsx}", "./components/**/*.{js,jsx,ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pink: {
          50: "#FFF1F7",
          100: "#FFE1EE",
          200: "#FFC4DC",
          400: "#F569A6",
          600: "#E6297A", // PRIMARY
          700: "#C21E63",
          900: "#7A1140",
        },
        ink: "#191420",
        body: "#4A4652",
        muted: "#8A8690",
        surface: "#F7F7F8",
        hairline: "#ECEBEE",
        success: "#12A150",
        star: "#F5A623",
        savings: "#FF8A00",
        error: "#E5484D",
        info: "#2E90FA",
      },
      borderRadius: {
        sm: "8px",
        md: "12px",
        lg: "16px",
        xl: "20px",
      },
      fontFamily: {
        // Load these with expo-font (see SETUP.md). Falls back to system until then.
        display: ["ClashGrotesk", "System"],
        sans: ["Inter", "System"],
      },
    },
  },
  plugins: [],
};
