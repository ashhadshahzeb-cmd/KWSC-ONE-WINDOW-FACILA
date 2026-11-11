import React, { createContext, useContext, useEffect, useState } from "react";

export type ThemeId = "navy" | "dark" | "emerald" | "violet";

export interface ThemeOption {
  id: ThemeId;
  name: string;
  tagline: string;
  isDark: boolean;
  colors: string[];
  primaryHex: string;
  sidebarClass: string;
}

export const THEMES: Record<ThemeId, ThemeOption> = {
  navy: {
    id: "navy",
    name: "Corporate Navy",
    tagline: "Official KW&SC Royal Navy & Clean White",
    isDark: false,
    colors: ["#1e3a8a", "#ffffff", "#0284c7"],
    primaryHex: "#1e3a8a",
    sidebarClass: "bg-[#1e3a8a] border-blue-900",
  },
  dark: {
    id: "dark",
    name: "Midnight Pro",
    tagline: "Deep Obsidian Dark Mode with Teal Accents",
    isDark: true,
    colors: ["#0b0f19", "#14b8a6", "#38bdf8"],
    primaryHex: "#38bdf8",
    sidebarClass: "bg-[#070b14] border-slate-800",
  },
  emerald: {
    id: "emerald",
    name: "Emerald Executive",
    tagline: "Forest Green & Crisp Mint Executive Style",
    isDark: false,
    colors: ["#064e3b", "#10b981", "#f0fdf4"],
    primaryHex: "#059669",
    sidebarClass: "bg-[#064e3b] border-emerald-900",
  },
  violet: {
    id: "violet",
    name: "Royal Amethyst",
    tagline: "Regal Deep Violet & Indigo Prestige",
    isDark: false,
    colors: ["#4c1d95", "#8b5cf6", "#faf5ff"],
    primaryHex: "#7c3aed",
    sidebarClass: "bg-[#4c1d95] border-purple-900",
  },
};

interface ThemeContextType {
  theme: ThemeId;
  setTheme: (theme: ThemeId) => void;
  toggleTheme: () => void;
  isDark: boolean;
  currentTheme: ThemeOption;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(() => {
    try {
      const saved = localStorage.getItem("kwsc_app_theme") || localStorage.getItem("theme");
      if (saved === "light" || !saved) return "navy";
      if (saved === "dark") return "dark";
      if (saved in THEMES) return saved as ThemeId;
      return "navy";
    } catch {
      return "navy";
    }
  });

  const setTheme = (newTheme: ThemeId) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem("kwsc_app_theme", newTheme);
      localStorage.setItem("theme", newTheme === "dark" ? "dark" : "light");
    } catch (e) {
      console.warn("Could not save theme preference:", e);
    }
  };

  useEffect(() => {
    const root = window.document.documentElement;
    // Remove all previous theme classes
    root.classList.remove(
      "light",
      "dark",
      "theme-navy",
      "theme-dark",
      "theme-emerald",
      "theme-violet"
    );

    // Apply the active theme classes
    root.classList.add(`theme-${theme}`);
    if (THEMES[theme].isDark) {
      root.classList.add("dark");
    } else {
      root.classList.add("light");
    }
  }, [theme]);

  const toggleTheme = () => {
    const themeKeys: ThemeId[] = ["navy", "dark", "emerald", "violet"];
    const nextIdx = (themeKeys.indexOf(theme) + 1) % themeKeys.length;
    setTheme(themeKeys[nextIdx]);
  };

  const currentTheme = THEMES[theme] || THEMES.navy;
  const isDark = currentTheme.isDark;

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark, currentTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
