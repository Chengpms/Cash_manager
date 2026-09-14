/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: {
          DEFAULT: "#F6F0E4",
          soft: "#FBF6EC",
          dark: "#EDE3CE",
        },
        ink: {
          DEFAULT: "#2B1B12",
          soft: "#8A7863",
          faint: "#B7A891",
        },
        accent: {
          light: "#F3925A",
          DEFAULT: "#E8703A",
          dark: "#B8501F",
        },
        positive: {
          light: "#7FA184",
          DEFAULT: "#5B7F5E",
          dark: "#42603F",
        },
        negative: {
          light: "#D9795F",
          DEFAULT: "#C1503A",
          dark: "#953B29",
        },
        gold: {
          light: "#E6C27A",
          DEFAULT: "#D3A048",
          dark: "#A87A2E",
        },
        border: "#EAE0CD",
      },
      fontFamily: {
        sans: [
          "Inter",
          "ui-sans-serif",
          "system-ui",
          "-apple-system",
          "Segoe UI",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "1rem",
        "2xl": "1.25rem",
        "3xl": "1.75rem",
      },
      boxShadow: {
        soft: "0 2px 10px 0 rgba(43, 27, 18, 0.06)",
        card: "0 8px 30px -8px rgba(43, 27, 18, 0.12)",
        glow: "0 12px 32px -8px rgba(232, 112, 58, 0.45)",
      },
      keyframes: {
        "modal-in": {
          "0%": { opacity: "0", transform: "scale(0.97) translateY(6px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "modal-in": "modal-in 0.18s ease-out",
        "fade-in": "fade-in 0.15s ease-out",
      },
    },
  },
  plugins: [],
};
