# HarisCo Internal Portal – Release Checklist

This document outlines the required checks before tagging and pushing a release to `main`.

## ✅ Pre-Release Checklist

### Code Quality
- [ ] All feature branches have been merged via approved Pull Requests
- [ ] No outstanding unresolved review comments on merged PRs
- [ ] TypeScript errors: `npm run build` passes in `server/` with 0 errors
- [ ] Frontend build: `npm run build` passes in `client/` with 0 errors

### Testing
- [ ] All backend tests pass: `cd server && npm test`
- [ ] All frontend tests pass: `cd client && npm test`
- [ ] Manual smoke test completed in browser (see test accounts in README)
- [ ] Verified login/logout and inactivity auto-logout work correctly
- [ ] Verified all procurement approval steps (PENDING_IT → PENDING_ADMIN → PENDING_DIRECTOR → APPROVED)
- [ ] Verified repair workflow end-to-end
- [ ] Verified Audit Log CSV and PDF exports download correctly

### Security
- [ ] `server/.env` contains a strong, unique `JWT_SECRET` (not the dev default)
- [ ] `.env` is NOT committed to git (verify with `git status`)
- [ ] Test account passwords have been changed from defaults if using a real deployment

### Documentation
- [ ] `README.md` is up to date with any new environment variables or setup steps
- [ ] `CHANGELOG.md` (if applicable) has been updated

### Docker / Production
- [ ] `docker-compose up -d --build` completes without errors
- [ ] Portal is accessible at `http://<SERVER_IP>:5000`
- [ ] SQLite volume mounts are working (data persists after `docker restart`)

## 🏷️ Tagging a Release
Once all checks are complete, create a version tag:
```bash
git tag -a v1.x.x -m "Release v1.x.x – <brief description>"
git push origin v1.x.x
```
