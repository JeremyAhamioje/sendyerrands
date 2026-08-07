/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      // Mirrors sendy/tailwind.config.js so the dashboard reads as the same product.
      colors: {
        pink: {
          50: '#FFF1F7',
          100: '#FFE1EE',
          200: '#FFC4DC',
          400: '#F569A6',
          600: '#E6297A',
          700: '#C21E63',
          900: '#7A1140',
        },
        ink: '#191420',
        body: '#4A4652',
        muted: '#8A8690',
        surface: '#F7F7F8',
        hairline: '#ECEBEE',
        success: '#12A150',
        warning: '#FF8A00',
        error: '#E5484D',
        info: '#2E90FA',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
