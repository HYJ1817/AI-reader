# Android TWA Package

This project has an experimental Bubblewrap Trusted Web Activity wrapper in `android-twa/`.

## Current Test Build

- Package id: `com.aireader.pwa`
- Web origin: `https://ver-liabilities-riverside-warehouse.trycloudflare.com`
- APK: `android-twa/app-release-signed.apk`
- AAB: `android-twa/app-release-bundle.aab`
- Signing key: `C:\Users\21022\.bubblewrap\ai-reader.keystore`

The APK is useful for local Android installation testing. The current origin is a temporary Cloudflare quick tunnel, so it is not a production Android target.

## Digital Asset Links

`public/.well-known/assetlinks.json` contains the SHA-256 fingerprint for the local Bubblewrap signing key. This lets Chrome verify that `com.aireader.pwa` and the served PWA belong together, which is required for fullscreen TWA behavior.

If the signing key changes, regenerate the fingerprint and update `assetlinks.json`.

## Rebuild

From `android-twa/`:

```powershell
npx.cmd --yes @bubblewrap/cli@1.24.1 build
```

If Gradle cannot reserve a large heap on this machine, keep `android-twa/gradle.properties` at `-Xmx1024m`.

## Before a Real Release

1. Replace the temporary Cloudflare host in `android-twa/twa-manifest.json` and `android-twa/app/build.gradle` with the production HTTPS domain.
2. Serve the matching `/.well-known/assetlinks.json` from that production domain.
3. Use a deliberate release keystore and store its credentials outside the repository.
4. Rebuild the APK/AAB and test on a device with Chrome installed.
