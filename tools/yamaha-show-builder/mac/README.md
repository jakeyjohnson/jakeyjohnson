# KobiKraken Show Builder for Mac

The whole Show Builder as a normal Mac app: its own window, your saved shows and templates, and the desk/RF bridge built in. No Terminal and no Node.js needed.

## Install

1. Download the zip for your Mac:
   - **Apple Silicon** (M1, M2, M3, M4…): `KobiKraken-Show-Builder-<version>-arm64.zip`
   - **Intel**: `KobiKraken-Show-Builder-<version>-x64.zip`

   Not sure which you have? Look in  → About This Mac. "Chip: Apple M…" means Apple Silicon.
2. Double-click the zip, then drag **KobiKraken Show Builder** into **Applications**.
3. **The first time you open it,** macOS says it can't check the developer, because the app isn't signed with an Apple Developer ID yet:
   - **macOS 15 and later:** open it once and close the warning. Then go to System Settings → Privacy & Security, scroll down and press **Open Anyway**.
   - **macOS 14 and earlier:** right-click the app, choose **Open**, then **Open**.

   After that it opens normally.
4. **When it asks to find devices on your local network, press Allow.** Without that it can't reach the desk, amps or radio mics.

If macOS says the app "is damaged", that's the download quarantine. In Terminal, run `xattr -cr "/Applications/KobiKraken Show Builder.app"` once, then open it again.

## Using it

- **Saved work:** your show, templates and line-check ticks are saved on this Mac between launches.
- **Save and Patch sheet:** both ask where to save the file.
- **Paperwork:** opens in its own window.
- **Local only:** the app's bridge listens on this Mac only (127.0.0.1, port 47820). To use a tablet on the show network, run `npm start` from the folder above instead.

## Building it

```bash
cd mac
npm install
npm run build        # zips for Apple Silicon and Intel in mac/dist, ad-hoc signed
npm run build:dmg    # on a Mac: .dmg installers too
npm start            # run it without packaging
```

On Linux, `npm run build` needs [rcodesign](https://github.com/indygreg/apple-platform-rs) for the signature (set `RCODESIGN` to its path). On a Mac, Apple's own `codesign` is used.

The GitHub workflow `.github/workflows/show-builder-mac.yml` builds the .dmg installers on a Mac and attaches them to the run.

## Signing properly

The app has an ad-hoc signature, which is why macOS asks for permission the first time. To remove that step:
1. Join the Apple Developer Program (£79 / $99 a year).
2. Make a "Developer ID Application" certificate.
3. Sign and notarise the app with it. rcodesign can do both from any computer with an App Store Connect API key.

Then it opens with a double-click like any app.
