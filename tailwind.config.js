/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Material 3 Dark palette configurations
        background: "#11111b",
        surface: "#1e1e2e",
        accent: "#f5c2e7",
        textPrimary: "#cdd6f4",
        textSecondary: "#a6adc8",
        error: "#f38ba8",
        success: "#a6e3a1",
        primary: "#cba6f7",
        secondary: "#89b4fa",
        muted: "#313244",
      },
      borderRadius: {
        'm3-lg': '18px',
        'm3-md': '12px',
        'm3-sm': '8px',
      },
      spacing: {
        'm3-grid': '8px',
      }
    },
  },
  plugins: [],
}
