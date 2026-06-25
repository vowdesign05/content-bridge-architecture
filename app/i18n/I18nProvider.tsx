import React, { createContext, useContext, useMemo } from "react";
import { useLocation } from "react-router";
import { translations, type LocaleKey } from "./translations";

type I18nValue = {
  locale: LocaleKey;
  t: (keyPath: string, vars?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

function getLocaleFromShopifyParam(search: string): LocaleKey {
  const sp = new URLSearchParams(search);
  const locale = (sp.get("locale") || "").toLowerCase(); // e.g. ja-JP
  if (locale.startsWith("ja")) return "ja";
  return "en";
}

function interpolate(template: string, vars?: Record<string, string | number>) {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`));
}

function getByPath(obj: unknown, path: string) {
  return path.split(".").reduce<unknown>((acc, k) => {
    if (!acc || typeof acc !== "object") return undefined;
    return (acc as Record<string, unknown>)[k];
  }, obj);
}

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const { search } = useLocation();

  const value = useMemo<I18nValue>(() => {
    const locale = getLocaleFromShopifyParam(search);
    const dict = translations[locale];

    const t = (keyPath: string, vars?: Record<string, string | number>) => {
      const raw = getByPath(dict, keyPath);
      if (typeof raw !== "string") return keyPath; // 未翻訳はキーを返す
      return interpolate(raw, vars);
    };

    return { locale, t };
  }, [search]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}
