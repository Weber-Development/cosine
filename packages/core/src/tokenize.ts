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
  return text.toLowerCase().replace(/ß/g, "ss").normalize("NFD").replace(/\p{M}/gu, "");
}

/** Splits text into normalized words, without stop words. */
export function tokenize(text: string): string[] {
  const words = normalize(text).match(/[\p{L}\p{N}]+(?:[._-][\p{L}\p{N}]+)*/gu) ?? [];
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
