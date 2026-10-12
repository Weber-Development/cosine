// Small words that carry no meaning for search, in the languages the docs are usually written in.
const STOP_WORDS = new Set(
  (
    "a an and are as at be but by for from how i if in into is it of on or so that the this to was what when where which who why will with you your " +
    "der die das den dem des ein eine einen einem einer und oder ist sind zu im in am an auf aus bei mit von vom für fur wie was wo wer ich du sie es wir ihr nicht auch als " +
    "le la les un une des et ou est sont de du au aux en pour avec il elle " +
    "il lo gli i un una e o è sono di da per con"
  ).split(" "),
);

/** Lowercases, removes accents (ü → u, é → e) and expands ß, so `Grösse` and `Größe` match. */
export function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(
      /([\p{Script=Latin}\p{Script=Greek}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}])\p{M}+/gu,
      "$1",
    )
    .normalize("NFC");
}

/** Splits text into normalized words, without stop words. */
export function tokenize(text: string): string[] {
  const words: string[] = [];
  for (const raw of normalize(text).match(/[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*/gu) ?? []) {
    if (NO_SPACES.test(raw)) for (const part of wordSpans(raw)) words.push(part.word);
    else words.push(raw);
  }
  const out: string[] = [];
  for (const word of words) {
    if (STOP_WORDS.has(word)) continue;
    out.push(word);
    // `use-search` or `search.query` should also match `search`.
    if (/[._-]/.test(word)) {
      for (const part of word.split(/[._-]/)) if (part && !STOP_WORDS.has(part)) out.push(part);
    }
  }
  return out;
}

const NO_SPACES =
  /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Thai}\p{Script=Khmer}\p{Script=Lao}\p{Script=Myanmar}]/u;
let segmenter: Intl.Segmenter | null | undefined;

/** Splits a run of letters into words with the browser's dictionary, for scripts without spaces. */
function segment(run: string, offset: number): Array<{ start: number; end: number; word: string }> {
  if (segmenter === undefined) {
    segmenter =
      typeof Intl !== "undefined" && "Segmenter" in Intl
        ? new Intl.Segmenter(undefined, { granularity: "word" })
        : null;
  }
  if (!segmenter) return [{ start: offset, end: offset + run.length, word: run }];
  const out: Array<{ start: number; end: number; word: string }> = [];
  for (const part of segmenter.segment(run)) {
    if (part.isWordLike)
      out.push({
        start: offset + part.index,
        end: offset + part.index + part.segment.length,
        word: part.segment,
      });
  }
  return out;
}

/**
 * Words of a text with their positions. Chinese, Japanese, Thai and other scripts that do not
 * separate words with spaces are split with `Intl.Segmenter`, so they can be searched and
 * highlighted word by word.
 */
export function wordSpans(text: string): Array<{ start: number; end: number; word: string }> {
  const out: Array<{ start: number; end: number; word: string }> = [];
  for (const m of text.matchAll(/[\p{L}\p{N}]+/gu)) {
    if (NO_SPACES.test(m[0])) out.push(...segment(m[0], m.index));
    else out.push({ start: m.index, end: m.index + m[0].length, word: m[0] });
  }
  return out;
}
