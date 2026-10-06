export type { BuildOptions, BuiltIndex } from "./build";
export { buildIndex, passageText } from "./build";
export type { ChunkOptions } from "./chunk";
export {
  chunkMarkdown,
  htmlToMarkdown,
  parseFrontMatter,
  slugify,
} from "./chunk";
export type { TransformersEmbedderOptions } from "./embedder";
export { DEFAULT_MODEL, MODELS, transformersEmbedder } from "./embedder";
export type { GroupOptions, GroupResult } from "./group";
export { CosineGroup, loadIndexes } from "./group";
export type { LexicalOptions, ParsedQuery } from "./lexical";
export { editDistance, LexicalIndex, parseQuery } from "./lexical";
export type { CosineOptions, Facet, FacetOptions, LoadIndexOptions } from "./search";
export { Cosine, countFacets, fuse, loadIndex, scopeFilter, siblingUrl } from "./search";
export { highlightParts, makeSnippet } from "./snippet";
export type { SearchTexts } from "./texts";
export { TEXTS, textsFor } from "./texts";
export { normalize, tokenize } from "./tokenize";
export type * from "./types";
export { cosineSimilarity, normalizeVector, VectorStore } from "./vectors";
