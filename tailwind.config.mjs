/** @type {import('tailwindcss').Config} */
export default {
  content: ["./src/**/*.{astro,html,js,jsx,ts,tsx,md,mdx}"],
  theme: {
    extend: {
      colors: {
        olive: {
          DEFAULT: "#7B7A2A",
          50: "#F5F5E6",
          100: "#EAEACD",
          200: "#D5D59B",
          300: "#C0C069",
          400: "#9D9C3D",
          500: "#7B7A2A",
          600: "#626222",
          700: "#4A4919",
          800: "#313111",
          900: "#191808"
        },
        cream: {
          DEFAULT: "#F6F1E6",
          50: "#FFFFFF",
          100: "#FDFCFA",
          200: "#F6F1E6",
          300: "#E8DCC5",
          400: "#DAC7A4",
          500: "#CCB283"
        },
        terracotta: {
          DEFAULT: "#8B4A2B",
          50: "#F5E6DE",
          100: "#EBCDBD",
          200: "#D79B7B",
          300: "#C36939",
          400: "#A05730",
          500: "#8B4A2B",
          600: "#6F3B22",
          700: "#532C1A",
          800: "#371E11",
          900: "#1C0F09"
        },
        charcoal: {
          DEFAULT: "#161616",
          50: "#F5F5F5",
          100: "#E0E0E0",
          200: "#B8B8B8",
          300: "#8F8F8F",
          400: "#666666",
          500: "#3D3D3D",
          600: "#2B2B2B",
          700: "#1F1F1F",
          800: "#161616",
          900: "#0A0A0A"
        },
        success: "#1F7A3A",
        error: "#B3261E"
      },
      fontFamily: {
        display: ["Oswald", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"]
      },
      fontSize: {
        "display-xl": ["4rem", { lineHeight: "1.1", letterSpacing: "-0.02em" }],
        "display-lg": ["3rem", { lineHeight: "1.15", letterSpacing: "-0.01em" }],
        "display-md": ["2.25rem", { lineHeight: "1.2" }],
        "display-sm": ["1.75rem", { lineHeight: "1.25" }]
      },
      spacing: {
        18: "4.5rem",
        88: "22rem",
        128: "32rem"
      },
      maxWidth: {
        "8xl": "88rem",
        container: "1120px"
      },
      borderRadius: {
        "4xl": "2rem"
      },
      boxShadow: {
        soft: "0 4px 20px -4px rgba(0,0,0,0.08)",
        medium: "0 8px 30px -8px rgba(0,0,0,0.12)",
        glow: "0 0 40px -10px rgba(123,122,42,0.3)"
      },
      animation: {
        "fade-in": "fadeIn 0.5s ease-out",
        "fade-up": "fadeUp 0.6s ease-out",
        "slide-in": "slideIn 0.4s ease-out"
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" }
        },
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        slideIn: {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" }
        }
      }
    }
  },
  plugins: []
};
