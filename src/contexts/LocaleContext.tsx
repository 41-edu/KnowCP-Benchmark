import { createContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { messages, resolveMessage, type Locale } from "../i18n/messages";

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: string, fallback?: string) => string;
}

const LOCALE_STORAGE_KEY = "knowcp_locale";

export const LocaleContext = createContext<LocaleContextValue>({
  locale: "en",
  setLocale: () => {},
  t: (key, fallback) => fallback || key,
});

function readInitialLocale(): Locale {
  const saved = window.localStorage.getItem(LOCALE_STORAGE_KEY);
  if (saved === "zh" || saved === "en") {
    return saved;
  }
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => readInitialLocale());

  useEffect(() => {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => {
    const t = (key: string, fallback?: string): string => {
      const current = resolveMessage(locale, key);
      if (current) {
        return current;
      }
      const english = resolveMessage("en", key);
      if (english) {
        return english;
      }
      return fallback || key;
    };

    return {
      locale,
      setLocale: (nextLocale: Locale) => {
        if (nextLocale in messages) {
          setLocaleState(nextLocale);
        }
      },
      t,
    };
  }, [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}
