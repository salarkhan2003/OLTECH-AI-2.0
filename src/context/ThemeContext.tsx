"use client";
import React, { createContext, useContext, useEffect, useState } from "react";

const THEME_KEY = "oltech-theme";
const ThemeContext = createContext({
  theme: "system",
  setTheme: (t: string) => {},
});

function getSystemTheme() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem(THEME_KEY) || "dark";
    }
    return "dark";
  });

  // Load theme from localStorage
  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    if (saved) setTheme(saved);
  }, []);

  // Apply theme on mount and when changed
  useEffect(() => {
    let t = theme;
    if (t === "system") t = getSystemTheme();
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(t);
    if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  // Listen for system theme changes if "system" is selected
  useEffect(() => {
    if (theme !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = () => {
      const t = mq.matches ? "dark" : "light";
      document.documentElement.classList.remove("light", "dark");
      document.documentElement.classList.add(t);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
} 