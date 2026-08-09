/** @type {import('tailwindcss').Config} */
// Sendy Errands design tokens — mirror of design.md §5–§7.
// Edit a hex here and every screen updates.
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  // Sendy Errands is a light-only product (app.json sets userInterfaceStyle: light).
  // 'class' keeps NativeWind off the prefers-color-scheme media path, which
  // throws on web when anything tries to set the scheme imperatively.
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        pink: {
          50: '#FFF1F7',
          100: '#FFE1EE',
          200: '#FFC4DC',
          400: '#F569A6',
          600: '#E6297A', // PRIMARY
          700: '#C21E63',
          900: '#7A1140',
        },
        ink: '#191420',
        body: '#4A4652',
        muted: '#8A8690',
        surface: '#F7F7F8',
        hairline: '#ECEBEE',
        success: '#12A150',
        star: '#F5A623',
        savings: '#FF8A00',
        error: '#E5484D',
        info: '#2E90FA',
      },
      borderRadius: {
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '20px',
      },
      fontFamily: {
        display: ['PlusJakartaSans_700Bold', 'system-ui', 'sans-serif'],
        sans: ['Inter_400Regular', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
