# @sweberdev/cosine-react

## 0.6.0

### Patch Changes

- Updated dependencies [f33b3ab]
  - @sweberdev/cosine@0.6.0

## 0.5.0

### Patch Changes

- Updated dependencies [817f40f]
  - @sweberdev/cosine@0.5.0

## 0.4.0

### Patch Changes

- Updated dependencies [595ec72]
  - @sweberdev/cosine@0.4.0

## 0.3.0

### Minor Changes

- 48b95cd: Typo tolerance and scoped search. A word that is not in the index now also matches close spellings (edit distance 1, from eight letters on 2), so `instalation` finds `installation` without the model. The new `scope` option, `scope` attribute and `scope` prop limit a search to URL paths such as `/docs/api`.

### Patch Changes

- Updated dependencies [48b95cd]
  - @sweberdev/cosine@0.3.0

## 0.2.0

### Minor Changes

- 678e64e: `<cosine-search>` fires `cosine-results` after each search, and `cosine-select` now carries the query and the rank of the chosen result.

### Patch Changes

- Updated dependencies [678e64e]
  - @sweberdev/cosine@0.2.0
