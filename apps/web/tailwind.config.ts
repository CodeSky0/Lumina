import type { Config } from "tailwindcss";

export default {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./lib/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        indigo: {
          50: "#eef2ff",
          100: "#e0e7ff",
          500: "#6366f1",
          600: "#5457e5",
          700: "#4548c7"
        },
        ink: "#17181c",
        sidebar: "#18191f"
      },
      fontFamily: {
        sans: ["Geist", "Noto Sans SC", "PingFang SC", "Microsoft YaHei", "sans-serif"],
        mono: ["Geist Mono", "SFMono-Regular", "Consolas", "monospace"]
      },
      boxShadow: {
        panel: "0 16px 40px -28px rgba(24, 25, 31, 0.28)",
        dialog: "0 24px 64px -24px rgba(24, 25, 31, 0.28)"
      },
      keyframes: {
        shimmer: { "100%": { transform: "translateX(100%)" } },
        enter: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        pulseSoft: { "0%, 100%": { opacity: "1" }, "50%": { opacity: ".45" } }
      },
      animation: {
        enter: "enter .32s cubic-bezier(.16,1,.3,1) both",
        pulseSoft: "pulseSoft 2.4s ease-in-out infinite"
      }
    }
  },
  plugins: []
} satisfies Config;
