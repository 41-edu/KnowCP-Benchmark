import type { Locale } from "../i18n/messages";
import { resolvePublicUrl } from "./url";

interface RuntimeTranslationsPayload {
  generatedAt?: string;
  en?: Record<string, string>;
  zh?: Record<string, string>;
  enNormalized?: Record<string, string>;
  zhNormalized?: Record<string, string>;
}

let mapPromise: Promise<RuntimeTranslationsPayload> | null = null;

function normalizeTranslationKey(value: string): string {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\\n/g, "\n")
    .split("\n")
    .map((line) => line.trimEnd())
    .join("\n")
    .trim();
}

function buildNormalizedMap(source: Record<string, string>): Record<string, string> {
  const normalized: Record<string, string> = {};
  for (const [key, value] of Object.entries(source)) {
    const nk = normalizeTranslationKey(key);
    if (!nk) {
      continue;
    }
    if (!(nk in normalized)) {
      normalized[nk] = value;
    }
  }
  return normalized;
}

async function loadRuntimeTranslations(): Promise<RuntimeTranslationsPayload> {
  if (!mapPromise) {
    mapPromise = (async () => {
      try {
        const response = await fetch(resolvePublicUrl("/content/runtime-translations.json"), {
          cache: "force-cache",
        });
        if (!response.ok) {
          return { en: {}, zh: {} };
        }
        const payload = (await response.json()) as RuntimeTranslationsPayload;
        const en = payload?.en || {};
        const zh = payload?.zh || {};
        return {
          en,
          zh,
          enNormalized: buildNormalizedMap(en),
          zhNormalized: buildNormalizedMap(zh),
        };
      } catch {
        return { en: {}, zh: {}, enNormalized: {}, zhNormalized: {} };
      }
    })();
  }
  return mapPromise;
}

export async function translateRuntimeText(
  text: string,
  locale: Locale,
  _options?: { preserveChoiceOptions?: boolean },
): Promise<string> {
  const source = String(text || "");
  if (!source.trim()) {
    return text;
  }

  const payload = await loadRuntimeTranslations();
  const dict = locale === "en" ? payload.en || {} : payload.zh || {};
  const normalizedDict = locale === "en" ? payload.enNormalized || {} : payload.zhNormalized || {};

  const candidates = [
    source,
    source.replace(/\\n/g, "\n"),
    source.replace(/\n/g, "\\n"),
    source.replace(/\r\n/g, "\n"),
  ];

  const dedupedCandidates = Array.from(new Set(candidates));
  let translated: string | undefined;
  for (const candidate of dedupedCandidates) {
    const hit = dict[candidate];
    if (typeof hit === "string" && hit.length > 0) {
      translated = hit;
      break;
    }
  }

  if (!translated) {
    const normalizedSource = normalizeTranslationKey(source);
    if (normalizedSource) {
      const hit = normalizedDict[normalizedSource];
      if (typeof hit === "string" && hit.length > 0) {
        translated = hit;
      }
    }
  }

  return translated || text;
}
