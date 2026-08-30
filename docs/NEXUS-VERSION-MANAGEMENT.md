# KWL-NEXUS Version Management

## Semantic Versioning
MAJOR.MINOR.PATCH (e.g. 1.0.0)
- **major** `v1.0.0 → v2.0.0` breaking change
- **minor** `v1.0.0 → v1.1.0` new feature backward compatible
- **patch** `v1.0.0 → v1.0.1` bug fix
- **build** internal rebuild (same semver, different binary)

## Model
```ts
type VersionType = 'major' | 'minor' | 'patch' | 'build'
interface VersionRecord {
  id: string
  app_id: string // e.g. 'kwl-video-downloader'
  version: string // "1.0.2" MAJOR.MINOR.PATCH
  versionType: VersionType
  releaseNotes: string
  isLatest: boolean // exactly one per app_id
  isActive: boolean // publish / unpublish toggle
  created_at: string // ISO-8601
  download_url?: string | null
  github_tag?: string | null // e.g. "v1.0.2"
}
```

Rust: `apps/desktop/src-tauri/src/versions.rs:1`
Frontend types: `apps/desktop/src/ui/versioning/types.ts:1`
Bridge: `apps/desktop/src/ui/versioning/tauriVersionsBridge.ts:1`

## Tauri Commands (typed)
```rust
get_versions(app_id: Option<String>) -> Vec<VersionRecord>
add_version(request: AddVersionInput) -> Result<Vec<VersionRecord>, String>
update_version(request: UpdateVersionInput) -> Result<Vec<VersionRecord>, String>
delete_version(id: String) -> Result<Vec<VersionRecord>, String>
sync_github_release(payload: GithubReleasePayload) -> Result<Vec<VersionRecord>, String>
```
Registered in `apps/desktop/src-tauri/src/main.rs:108`

Storage: `AppData/KWL Video Downloader/versions.json` (override `KWL_VERSIONS_DIR` for tests). Sorting: semver desc → created_at desc. Tests `versions::tests` 8 PASS.

## Admin Panel
Route: `/admin/apps/[id]/versions` → `apps/desktop/src/ui/versioning/AdminVersionsView.tsx:1`
- Form: version input (validates `MAJOR.MINOR.PATCH`), versionType select (Major/Minor/Patch/Build), releaseNotes textarea, download_url, isActive (Publish toggle)
- Actions: Add, Publish toggle per row, Latest checkbox (mutual exclusive), Delete
- GitHub sync: owner/repo inputs + `Sync GitHub Releases` button → `fetchGithubReleases()` + `autoSyncGithubReleases()`

## User Page
- Detail page version history: `apps/desktop/src/ui/versioning/components/VersionHistory.tsx:1`
- Each row: `v{version}` + `VersionBadge` (color-coded) + `LatestBadge` if isLatest + download button (isActive guard)
- Integrated in `AboutViewWithVersions` inside `apps/desktop/src/ui/App.tsx` — shows latest 10 active versions for `kwl-video-downloader`.

## GitHub Integration
```ts
// apps/desktop/src/ui/versioning/github.ts
parseReleaseToVersion({tag_name: "v1.0.2", body: "Fix..."}) → {version:"1.0.2", releaseNotes:"Fix...", tag:"v1.0.2"}
parseGithubTag("v1.0.0") → "1.0.0"          // strips leading v/V, validates semver
fetchGithubReleases("kwl","video-downloader") → GithubRelease[]
autoSyncGithubReleases(releases, appId) → calls sync_github_release per release (idempotent)
```
Rust mirrors: `parse_github_tag()`, `derive_version_type(prev,next)` → major/minor/patch/build, `compare_semver()`.

## Next.js API route example (for KWL-NEXUS web)
```ts
// app/api/admin/apps/[id]/versions/route.ts
import { NextRequest, NextResponse } from 'next/server'
// POST body: { version, versionType, releaseNotes, isActive, download_url }
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const body = await req.json()
  // validate semver / versionType enum
  // insert into DB, recompute isLatest (demote old latest if new is greater semver)
  // return updated list sorted by semver desc
}
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  // return versions where app_id = params.id sorted semver desc
}
// PATCH /api/admin/apps/[id]/versions/[versionId] -> toggle isActive/isLatest
// POST /api/admin/apps/[id]/versions/sync-github { owner, repo } -> fetch GitHub releases, parse tag/body, upsert
```

## Pull-to-Refresh (bonus fix)
- TitleBar `apps/desktop/src/ui/components/TitleBar.tsx:66` now dynamic `v{appVersion}` via `getAppInfo()` (was hardcoded 1.0.0)
- `lib.rs:get_app_info_impl:1015` now `env!("CARGO_PKG_VERSION")`
- AppShell `apps/desktop/src/ui/layout/AppShell.tsx:201` pull indicator now uses circular rotate icon with `rotateDeg = pullProgress * 360` — scroll barale rotate barbe, komale kombe; full 360 → release to refresh. Added pointer (mouse) + wheel support plus touch.
