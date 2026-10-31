# VicSync

Personal cloud sync plugin for Obsidian, tailored for **Google Drive** (primary) and **S3-compatible storage** (backup).

> **Attribution:** Forked from [Remotely Save](https://github.com/remotely-save/remotely-save) by [fyears](https://github.com/fyears).

## Key Features

- **Direct Google Drive Sync (Primary):** Authenticates directly with your own Google Cloud OAuth credentials (`refresh_token`)—no third-party proxy servers, subscriptions, or forced 60-day token expirations.
- **S3 / R2 / B2 / MinIO Support (Backup):** Secondary S3-compatible object storage backend.
- **Bidirectional Move Detection:** Detects file moves and folder archiving on both Google Drive and your local Obsidian vault (e.g., archiving weekly journals from `Journals/Current/` to `Journals/~Past/`) and renames files in-place without deleting or re-uploading.
- **Smart Conflict Resolution:** Uses 3-way `diff3` line-level merging for Markdown notes by default, falling back to safe `.dup` copies only when edits overlap.
- **Interactive Dry-Run Preview & Sync Summary:** Preview planned uploads, downloads, moves, merges, and deletions in a categorized modal before executing.
- **Local Vault Debug Log (`_vicsync_debug.md`):** Automatically records sync/auth exceptions with timestamps and stack traces at the root of your vault (ignored by cloud sync).
- **Native Google Workspace Document Filtering:** Automatically ignores native `.gdoc`/`.gsheet`/`.gslides` files (`application/vnd.google-apps.*`) inside your Google Drive folder.

## Project Structure

```text
src/
├── main.ts                      # Plugin lifecycle, ribbon menu, commands & status bar
├── baseTypes.ts                 # Shared TypeScript interfaces & constants
├── storage/
│   ├── fsAll.ts                 # Abstract FakeFs interface
│   ├── fsGetter.ts              # Provider factory (Google Drive & S3)
│   ├── fsLocal.ts               # Obsidian Vault local filesystem adapter
│   ├── fsGoogleDrive.ts         # Google Drive v3 API client
│   └── fsS3.ts                  # S3-compatible storage client
├── sync/
│   ├── sync.ts                  # 3-way sync engine + remote & local move detection
│   ├── cleanSyncDown.ts         # Reset local vault from cloud (Clean Sync Down)
│   ├── conflictLogic.ts         # 3-way diff3 Markdown merge & duplicate naming
│   ├── copyLogic.ts             # File & folder transfer helpers
│   ├── metadataOnRemote.ts      # Remote metadata helpers
│   └── clearDupFiles.ts         # Duplicate file scanner (.dup & (1).md)
├── ui/
│   ├── settings.ts              # Plugin settings tab
│   ├── settingsGoogleDrive.ts   # Google Drive OAuth & folder settings UI
│   ├── settingsClearDupFiles.ts # Duplicate cleanup modal
│   ├── resetLocalModal.ts       # Clean Sync Down confirmation modal
│   └── syncPlanModal.ts         # Dry-Run Preview & Last Sync Summary modal
└── utils/
    ├── baseTypesObs.ts          # Obsidian API version checks
    ├── localdb.ts               # IndexedDB (localforage) sync state & history
    ├── debugMode.ts             # Sync plan exporter & _vicsync_debug.md logger
    ├── misc.ts                  # Path, buffer, and formatting utilities
    ├── obsFolderLister.ts       # Vault folder traversal
    ├── profiler.ts              # Sync step performance profiler
    ├── importExport.ts          # QR/URI settings import & export
    ├── i18n.ts                  # UI string helper
    └── langs/                   # English UI strings (en.json)
```

## Installation via BRAT

1. Install and enable the [BRAT](https://github.com/TfTHacker/obsidian42-brat) plugin in Obsidian.
2. Open **Settings → BRAT → Add Beta plugin** and enter:
   ```text
   victor-chan-dev/VicSync-Obsidian
   ```
3. Enable **VicSync** under **Settings → Community plugins**.

## Development & Releases

```bash
# Run unit tests
npm test

# Build production bundle (requires GOOGLEDRIVE_CLIENT_ID & GOOGLEDRIVE_CLIENT_SECRET in .env)
npm run build
```

Pushing to `master` automatically triggers `.github/workflows/release.yml`, which bumps the patch version in `manifest.json` / `package.json` / `versions.json`, builds `main.js`, and publishes a new GitHub Release for BRAT.
