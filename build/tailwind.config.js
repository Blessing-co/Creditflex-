module.exports = {
  content: ["./src.html"],
  theme: {
    extend: {
      colors: {
        "background": "#f9f9ff", "surface": "#f9f9ff", "surface-bright": "#f9f9ff", "surface-dim": "#d0daf2",
        "surface-variant": "#d9e3fb", "surface-container-lowest": "#ffffff", "surface-container-low": "#f0f3ff",
        "surface-container": "#e8eeff", "surface-container-high": "#dfe8ff", "surface-container-highest": "#d9e3fb",
        "on-surface": "#111c2d", "on-surface-variant": "#3f4944", "on-background": "#111c2d",
        "outline": "#6f7a73", "outline-variant": "#bec9c2",
        "primary": "#00513a", "on-primary": "#ffffff", "primary-container": "#0b6b4f", "on-primary-container": "#96e8c5",
        "primary-fixed": "#a0f3cf", "primary-fixed-dim": "#85d7b4", "on-primary-fixed": "#002116",
        "secondary": "#535f71", "secondary-container": "#d7e3f9", "on-secondary-container": "#596577",
        "secondary-fixed": "#d7e3f9", "on-secondary-fixed": "#101c2c",
        "tertiary": "#673d00", "tertiary-container": "#885200", "on-tertiary-container": "#ffd09f",
        "tertiary-fixed": "#ffddbb", "on-tertiary-fixed": "#2b1700",
        "error": "#ba1a1a", "on-error": "#ffffff", "error-container": "#ffdad6", "on-error-container": "#93000a"
      },
      borderRadius: { DEFAULT: "0.25rem", lg: "0.5rem", xl: "0.75rem", full: "9999px" },
      fontFamily: { sans: ["Public Sans", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"] },
      fontSize: {
        "headline-xl-mobile": ["26px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "800" }],
        "headline-lg": ["24px", { lineHeight: "32px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "headline-lg-mobile": ["20px", { lineHeight: "28px", fontWeight: "700" }],
        "title-md": ["18px", { lineHeight: "24px", fontWeight: "600" }],
        "currency-item": ["18px", { lineHeight: "24px", letterSpacing: "-0.01em", fontWeight: "700" }],
        "currency-display": ["30px", { lineHeight: "36px", letterSpacing: "-0.02em", fontWeight: "800" }],
        "body-lg": ["16px", { lineHeight: "24px", fontWeight: "500" }],
        "body-md": ["14px", { lineHeight: "20px", fontWeight: "500" }],
        "label-lg": ["14px", { lineHeight: "20px", letterSpacing: "0.01em", fontWeight: "700" }],
        "label-md": ["12px", { lineHeight: "16px", letterSpacing: "0.04em", fontWeight: "700" }]
      }
    }
  }
};
