import type { Embedder, EmbedKind, ModelOptions } from "./types";

/** Models that work well for documentation search. All run in the browser via transformers.js. */
export const MODELS = {
  /** English, about 23 MB (q8). The default. */
  english: { model: "Xenova/all-MiniLM-L6-v2", minSimilarity: 0.2 },
  /** 100 languages including German, French and Italian, about 120 MB (q8). Queries and pages may be in different languages. */
  multilingual: {
    model: "Xenova/multilingual-e5-small",
    queryPrefix: "query: ",
    passagePrefix: "passage: ",
  },
} as const satisfies Record<string, { model: string } & ModelOptions>;

export const DEFAULT_MODEL = MODELS.english.model;

// Minimal shape of what we use from @huggingface/transformers, so it stays an optional dependency.
interface Tensor {
  data: ArrayLike<number>;
  dims: number[];
}
type FeatureExtractor = (
  texts: string[],
  options: { pooling: "mean"; normalize: boolean },
) => Promise<Tensor>;
interface TransformersModule {
  pipeline: (
    task: "feature-extraction",
    model: string,
    options?: Record<string, unknown>,
  ) => Promise<unknown>;
}

export interface TransformersEmbedderOptions extends ModelOptions {
  /** Hugging Face model id or a key of `MODELS`. Default `english`. */
  model?: string;
  /** `wasm` (default in browsers), `webgpu`, or `cpu` in Node. */
  device?: string;
  /** Texts per model call. Default 16. */
  batchSize?: number;
  /** Loads transformers.js. Defaults to `import("@huggingface/transformers")`; pass your own for a CDN build. */
  load?: () => Promise<TransformersModule>;
  /** Reports model download progress. */
  onProgress?: (event: { status: string; file?: string; progress?: number }) => void;
}

/** Embeds text with a sentence-embedding model through transformers.js (`@huggingface/transformers`). */
export function transformersEmbedder(options: TransformersEmbedderOptions = {}): Embedder {
  const preset = MODELS[(options.model ?? "english") as keyof typeof MODELS] as
    | ({ model: string } & ModelOptions)
    | undefined;
  const model = preset?.model ?? options.model ?? DEFAULT_MODEL;
  const queryPrefix = options.queryPrefix ?? preset?.queryPrefix ?? "";
  const passagePrefix = options.passagePrefix ?? preset?.passagePrefix ?? "";
  const batchSize = options.batchSize ?? 16;
  let extractor: Promise<FeatureExtractor> | undefined;
  let dimensions: number | undefined;

  const getExtractor = () => {
    extractor ??= (async () => {
      const mod = options.load
        ? await options.load()
        : ((await import(
            /* @vite-ignore */ "@huggingface/transformers"
          )) as unknown as TransformersModule);
      const pipelineOptions: Record<string, unknown> = { dtype: options.dtype ?? "q8" };
      if (options.device) pipelineOptions.device = options.device;
      if (options.onProgress) pipelineOptions.progress_callback = options.onProgress;
      return (await mod.pipeline("feature-extraction", model, pipelineOptions)) as FeatureExtractor;
    })();
    extractor.catch(() => {
      extractor = undefined; // allow a retry, e.g. after the network is back
    });
    return extractor;
  };

  return {
    model,
    get dimensions() {
      return dimensions;
    },
    get options(): ModelOptions {
      const out: ModelOptions = { dtype: options.dtype ?? "q8" };
      if (queryPrefix) out.queryPrefix = queryPrefix;
      if (passagePrefix) out.passagePrefix = passagePrefix;
      const min = options.minSimilarity ?? preset?.minSimilarity;
      if (min !== undefined) out.minSimilarity = min;
      return out;
    },
    async embed(texts: string[], kind: EmbedKind) {
      const run = await getExtractor();
      const prefix = kind === "query" ? queryPrefix : passagePrefix;
      const out: Float32Array[] = [];
      for (let i = 0; i < texts.length; i += batchSize) {
        const batch = texts.slice(i, i + batchSize).map((t) => prefix + t);
        const tensor = await run(batch, { pooling: "mean", normalize: true });
        const d = tensor.dims.at(-1) as number;
        dimensions = d;
        for (let j = 0; j < batch.length; j++) {
          out.push(Float32Array.from(Array.prototype.slice.call(tensor.data, j * d, (j + 1) * d)));
        }
      }
      return out;
    },
  } as Embedder & { options: ModelOptions };
}

/** The options to store in the index so the browser loads the same model the same way. */
export function embedderOptions(embedder: Embedder): ModelOptions | undefined {
  return (embedder as Embedder & { options?: ModelOptions }).options;
}
