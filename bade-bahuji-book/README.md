# Bade Bahuji — Digital Book (Android)

A digital book app for Android with realistic animated page turns
(drag a page corner and the paper curls with your finger). Built as a
lightweight WebView shell (no AndroidX, ~26 KB APK) around the
[StPageFlip](https://www.npmjs.com/package/page-flip) engine.

**Ready-made APK:** `dist/bade-bahuji.apk` — copy to a phone and install
(sideload; enable "install from unknown sources" when prompted).
Requires Android 7.0+.

## Current status

This build ships **sample pages** — the original *Bade Bahuji* media zip
was not available to the build environment. To put the real book in:

1. Copy the book's page images into `apk/assets/book/pages/`
   (e.g. `001.jpg`, `002.jpg`, … in reading order).
2. Edit `apk/assets/book/pages.js`: replace the sample entries with
   `{ type: "image", src: "pages/001.jpg" }`, one per page
   (keep the first/last cover entries, or make the cover an image too).
3. Run `./build.sh` — the new APK appears at `dist/bade-bahuji.apk`.

## Features

- Realistic page-curl animation that follows your finger (StPageFlip)
- Tap screen edges, swipe, or use the ‹ › buttons to turn pages
- Portrait = single page, landscape = two-page book spread
- Remembers your last-read page
- Soft synthesized paper-swish sound on each turn (no audio files)
- Full-screen immersive reading, screen stays awake

## Build (no Android SDK required)

`./build.sh` does everything. It was designed for environments where
`dl.google.com` (the official Android SDK host) is unreachable — every
tool comes from Maven Central:

| Tool | Purpose |
|------|---------|
| `apktool-cli` | compiles AndroidManifest.xml + resources into the APK |
| `dalvik-dx` | converts compiled Java classes to `classes.dex` |
| `apksig` | APK Signature Scheme v2 signing + verification |
| `android-all` (Robolectric) | Android 14 framework jar as compile classpath |

Pipeline: `javac` → `dx` → `apktool b` → inject `classes.dex` →
sign (v2) → verify.

The signing keystore lives in `keystore/badebahuji.p12`
(store password `badebahuji123`, alias `badebahuji`). It is a
self-signed sideload key — keep using the same keystore so updated
builds install over the old ones.

## Layout

```
apk/                  apktool packaging project
  AndroidManifest.xml
  res/                app name + launcher icon
  assets/book/        the book itself (HTML/CSS/JS + page-flip engine)
    pages.js          page manifest — edit this to change book content
src/                  MainActivity.java (WebView shell)
signer/               Signer.java / Verifier.java (apksig wrappers)
make_icon.py          generates the launcher icon (Pillow)
build.sh              one-command build
dist/bade-bahuji.apk  signed output
```
