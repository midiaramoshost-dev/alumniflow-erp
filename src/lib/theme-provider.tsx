import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark" | "system";
type Ctx = { theme: Theme; setTheme: (t: Theme) => void; resolved: "light" | "dark" };

const ThemeContext = createContext<Ctx | undefined>(undefined);
const STORAGE_KEY = "erp-esq-theme";

function resolve(t: Theme): "light" | "dark" {
  if (t === "system" && typeof window !== "undefined") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return t === "dark" ? "dark" : "light";
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("light");

  useEffect(() => {
    const stored = (typeof window !== "undefined"
      ? (localStorage.getItem(STORAGE_KEY) as Theme | null)
      : null) ?? "light";
    setThemeState(stored);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const r = resolve(theme);
    document.documentElement.classList.toggle("dark", r === "dark");
  }, [theme]);

  const setTheme = (t: Theme) => {
    localStorage.setItem(STORAGE_KEY, t);
    setThemeState(t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolved: resolve(theme) }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const c = useContext(ThemeContext);
  if (!c) throw new Error("useTheme must be used within ThemeProvider");
  return c;
}
