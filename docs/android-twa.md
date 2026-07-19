# Android TWA Package

This project has an experimental Bubblewrap Trusted Web Activity wrapper in `android-twa/`.

## Current Test Build

- Package id: `com.aireader.pwa`
- Web origin: `https://881817.xyz`
- APK: `android-twa/app-release-signed.apk`
- AAB: `android-twa/app-release-bundle.aab`
- Signing key: `C:\Users\21022\.bubblewrap\ai-reader.keystore`

The APK is configured for the production domain. The domain must serve this PWA, including `/.well-known/assetlinks.json`, before the installed app can verify into fullscreen TWA behavior.

## Digital Asset Links

`public/.well-known/assetlinks.json` contains the SHA-256 fingerprint for the local Bubblewrap signing key. This lets Chrome verify that `com.aireader.pwa` and the served PWA belong together, which is required for fullscreen TWA behavior.

If the signing key changes, regenerate the fingerprint and update `assetlinks.json`.

## Rebuild

From `android-twa/`:

```powershell
npx.cmd --yes @bubblewrap/cli@1.24.1 build
```

Bubblewrap validates the live PWA icons and web manifest from `https://881817.xyz`. If the domain is not yet serving AI Reader, build the Android project directly instead:

```powershell
$env:JAVA_HOME="C:\Users\21022\.bubblewrap\jdk\jdk-17.0.11+9"
$env:ANDROID_HOME="C:\Users\21022\.bubblewrap\android_sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:Path="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:Path"
.\gradlew.bat assembleRelease bundleRelease
```

If Gradle cannot reserve a large heap on this machine, keep `android-twa/gradle.properties` at `-Xmx1024m`.

## Before a Real Release

1. Serve the AI Reader PWA from `https://881817.xyz`.
2. Serve the matching `/.well-known/assetlinks.json` from that production domain.
3. Use a deliberate release keystore and store its credentials outside the repository.
4. Rebuild the APK/AAB and test on a device with Chrome installed.
