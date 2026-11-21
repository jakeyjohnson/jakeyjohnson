# Jog On (iOS)

SwiftUI app from the "Jog On: app breakdown and build spec" doc. This is **Milestone 1: shell and theme** with dummy data; tracking, backend and rewards come in later milestones.

## Run it
Needs macOS with Xcode 16+.

```bash
brew install xcodegen
cd jog-on && xcodegen && open JogOn.xcodeproj
```

Fonts: add the four static Archivo files from Google Fonts (Regular, SemiBold, ExtraCondensed ExtraBold Italic, ExtraCondensed Bold) to `JogOn/` before building. Without them the app falls back to the system font.

Design tokens live in `JogOn/Theme/JogOnTheme.swift` (black, white, signal pink #FF4F9A).
