# Release checklist (package-launch)

| Item | Status |
|---|---|
| Repo `Weber-Development/cosine` | private (created by the wekrbank workflow `new-package`, `NPM_TOKEN` set) |
| npm `@sweberdev/cosine`, `@sweberdev/cosine-react` | 0.1.0 in `package.json`. The Release workflow publishes only once the repo is public (npm provenance needs a public repo); after `go-public`, run "Release" by hand once |
| Docs | Markdown in `docs/` with `nav.json`, rendered at packages.sweber.dev/cosine/docs once the repo is public |
| packages.sweber.dev | entry, docs config and live demo via a PR in `sxwxbxr/portfoliov3` |
| Pro | `Weber-Development/cosine-pro` and `-pro-dist` |
| Polar | `wekrbank` workflow `polar-setup` after Seya confirms prices and creates the benefit |
| Trademark check "Cosine" | open (Seya) |

## Open (Seya)

- [ ] Merge the initial PR.
- [ ] Say "öffentlich machen" so the repo goes public, then the Release workflow publishes 0.1.0.
- [ ] Confirm Pro prices.

## Later

- Self-hosted model files as a CLI option (`cosine models download`).
