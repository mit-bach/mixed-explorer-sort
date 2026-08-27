# Mix Folders and Files

Sort files and folders together in File Explorer. Folders mix with notes instead of grouping first.

Use the native Files sort menu: modified time (new to old or old to new), created time, or name. The same rule applies to folders.

## Why

Core File Explorer always lists every folder, then every file. This plugin removes that split. A note you edited a minute ago can sit above an older folder. A folder whose contents were edited recently can sit above an older note.

No YAML. No `sortspec`. No per-folder index notes. One global setting.

## Folder time

When sorting by modified or created time, a folder needs a timestamp:

- **Newest descendant** (default): newest file anywhere under that folder
- **Newest direct child**: newest file in that folder only
- **Filesystem**: directory inode time (does not move when you edit a note inside)

## Settings

- Mix folders with files (on/off)
- Folder time mode
- Mix on all sort orders (off = mix only for modified time)

## Commands

- Toggle mix folders with files
- Set folder time to newest descendant
- Set folder time to newest direct child
- Set folder time to filesystem

## Compatibility

Do not enable this together with Custom File Explorer sorting, Flexplorer, or Folder Sort Rules. They patch the same File Explorer method; last one wins.

Requires app version 1.7.2 or later.

## Build

```text
npm install
npm test
npm run build
```

Release assets: `main.js`, `manifest.json`, `styles.css`.
