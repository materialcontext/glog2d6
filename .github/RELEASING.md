# Releasing

Releases are automatic. Merge a PR into `main` and the `Release` workflow bumps
the version, tags it, builds the zip, and publishes. There is nothing to do by
hand.

## What happens on merge

1. `npm run test:run` — nothing ships unless the suite is green.
2. The version is bumped in **`system.json`** and **`package.json`**, and
   `system.json`'s `download` URL is repointed at the new tag.
3. The bump is committed to `main` as `Release v<version> [skip ci]` and tagged
   `v<version>`.
4. `glog2d6.zip` is built from the file list in `tools/release.mjs`.
5. A GitHub release is published for `v<version>` with `glog2d6.zip` and
   `system.json` attached.
6. The rolling `release` tag and its assets are updated to match.

## Choosing the bump

Label the PR before merging:

| Label | Result |
| --- | --- |
| *(none)* | patch — `1.0.330` → `1.0.331` |
| `release:patch` | patch |
| `release:minor` | `1.0.330` → `1.1.0` |
| `release:major` | `1.0.330` → `2.0.0` |
| `skip-release` or `no-release` | merge with no release at all |

Patch is the default because that is this project's cadence — the version was
`1.0.330` when this was written.

You can also run the workflow by hand from the Actions tab
(**Release** → *Run workflow*) and pick a level there.

## The two tags

Foundry needs a **stable** manifest URL to poll for updates and a **pinned**
download URL so it installs exactly the version the manifest describes. So each
release writes two places:

- `v<version>` — an immutable tag holding that version's zip. This is what
  `system.json`'s `download` points at.
- `release` — a rolling tag whose `system.json` asset is always the newest.
  This is what `system.json`'s `manifest` points at, and it is the URL every
  existing install already polls. **Do not change the `manifest` URL** —
  installs out in the world have it baked in, and moving it orphans them.

## What is *not* bumped

`CONTENT_VERSION` in `scripts/initialize-content.mjs` is a **world data
migration** version, not the system version. It gates `migrateContent()`, so it
must only move when a migration is actually added — bumping it every release
would re-run every migration against every world. A test asserts it stays out of
the automated bump.

## Adding a file to the release

Add it to `RELEASE_PATHS` in `tools/release.mjs`. The workflow reads that list,
and a test asserts every listed path exists and that everything `glog2d6.mjs`
imports from is covered. `scripts/` is runtime code and ships; `tools/` is build
tooling and does not.

## Repository settings this needs

- **Settings → Actions → General → Workflow permissions** must be
  *Read and write permissions*, so the workflow can push the bump commit, move
  tags, and create releases.
- If `main` has **branch protection** requiring pull requests, the bump commit
  push will be rejected. Either allow `github-actions[bot]` to bypass the rule,
  or drop step 3 and let the tag alone carry the version.
