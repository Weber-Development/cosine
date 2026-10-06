export interface SearchTexts {
  label: string;
  placeholder: string;
  noResults: string;
  /** `{count}` is replaced with the number of results. */
  results: string;
  loadingModel: string;
  modelReady: string;
  modelFailed: string;
  /** Filter button that shows every section. */
  all: string;
  /** Label of the group of filter buttons. */
  sections: string;
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
    all: "All",
    sections: "Filter by section",
  },
  de: {
    label: "Dokumentation durchsuchen",
    placeholder: "Dokumentation durchsuchen…",
    noResults: "Keine Treffer",
    results: "{count} Treffer",
    loadingModel: "Intelligente Suche wird geladen…",
    modelReady: "Intelligente Suche bereit",
    modelFailed: "Nur Stichwortsuche",
    all: "Alle",
    sections: "Nach Bereich filtern",
  },
  fr: {
    label: "Rechercher dans la documentation",
    placeholder: "Rechercher dans la documentation…",
    noResults: "Aucun résultat",
    results: "{count} résultats",
    loadingModel: "Chargement de la recherche intelligente…",
    modelReady: "Recherche intelligente prête",
    modelFailed: "Recherche par mots-clés uniquement",
    all: "Tout",
    sections: "Filtrer par section",
  },
  it: {
    label: "Cerca nella documentazione",
    placeholder: "Cerca nella documentazione…",
    noResults: "Nessun risultato",
    results: "{count} risultati",
    loadingModel: "Caricamento della ricerca intelligente…",
    modelReady: "Ricerca intelligente pronta",
    modelFailed: "Solo ricerca per parole chiave",
    all: "Tutto",
    sections: "Filtra per sezione",
  },
};

/** Texts for a BCP 47 language tag, e.g. `de-CH` → German. Falls back to English. */
export function textsFor(lang: string | null | undefined): SearchTexts {
  const key = (lang ?? "en").slice(0, 2).toLowerCase() as keyof typeof TEXTS;
  return TEXTS[key] ?? TEXTS.en;
}
