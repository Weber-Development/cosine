export interface SearchTexts {
  label: string;
  placeholder: string;
  noResults: string;
  /** `{count}` is replaced with the number of results. */
  results: string;
  loadingModel: string;
  modelReady: string;
  modelFailed: string;
}

export const TEXTS: Record<"en" | "de" | "fr" | "it", SearchTexts> = {
  en: {
    label: "Search the docs",
    placeholder: "Search the docs…",
    noResults: "No results",
    results: "{count} results",
    loadingModel: "Loading smart search…",
    modelReady: "Smart search ready",
    modelFailed: "Keyword search only",
  },
  de: {
    label: "Dokumentation durchsuchen",
    placeholder: "Dokumentation durchsuchen…",
    noResults: "Keine Treffer",
    results: "{count} Treffer",
    loadingModel: "Intelligente Suche wird geladen…",
    modelReady: "Intelligente Suche bereit",
    modelFailed: "Nur Stichwortsuche",
  },
  fr: {
    label: "Rechercher dans la documentation",
    placeholder: "Rechercher dans la documentation…",
    noResults: "Aucun résultat",
    results: "{count} résultats",
    loadingModel: "Chargement de la recherche intelligente…",
    modelReady: "Recherche intelligente prête",
    modelFailed: "Recherche par mots-clés uniquement",
  },
  it: {
    label: "Cerca nella documentazione",
    placeholder: "Cerca nella documentazione…",
    noResults: "Nessun risultato",
    results: "{count} risultati",
    loadingModel: "Caricamento della ricerca intelligente…",
    modelReady: "Ricerca intelligente pronta",
    modelFailed: "Solo ricerca per parole chiave",
  },
};

/** Texts for a BCP 47 language tag, e.g. `de-CH` → German. Falls back to English. */
export function textsFor(lang: string | null | undefined): SearchTexts {
  const key = (lang ?? "en").slice(0, 2).toLowerCase() as keyof typeof TEXTS;
  return TEXTS[key] ?? TEXTS.en;
}
