## Pre-Push Checklist (GitHub)

### Secrets and credentials
- [ ] Confirm no secrets are committed (API keys, tokens, passwords).
- [ ] Verify `.env` is not tracked and `.env.example` contains only safe placeholders.

### Files to exclude
- [ ] Remove `frontend/node_modules/` and ensure it is ignored.
- [ ] Remove local lock/temp files (e.g., `docs/.kate-swp`, `docs/.~lock*`).
- [ ] Remove any licensed or internal documents from `docs/` before pushing.
- [ ] Keep only public, redistributable docs in the repo.

### Repository hygiene
- [ ] `git status` shows no unintended untracked files.
- [ ] Commit messages reviewed and accurate.
- [ ] No large binaries unless explicitly intended.

### Docs and legal
- [ ] `README.md` is current (setup, env vars, run steps).
- [ ] `LICENSE` and `TRADEMARK` are present and correct.
- [ ] `CONTRIBUTING.md` and `SECURITY.md` are present (if required).
- [ ] Required taxonomy docs are present: `docs/taxonomy-ai.md` and `docs/taxonomy-ai-clean.json` (do not delete).

### Build sanity
- [ ] Backend starts with defaults.
- [ ] Frontend builds (`npm run build`).

### Final checks
- [ ] Run tests you consider required.
- [ ] Tag the release (e.g. `git tag v1.0.0`) or create a version note if needed.

### Marlowe 1.0
- [ ] `pyproject.toml` and `app/main.py` set to `1.0.0`
- [ ] `CHANGELOG.md` updated with release notes
