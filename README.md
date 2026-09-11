# Voice Recorder

Expo (managed) + TypeScript Android voice recording app.

Record from the microphone, save notes locally, list them, play them back, rename, and delete — with a clean dark UI.

**Repo:** https://github.com/hemantkushwah641-cmd/android-voice-recorder

## Features

- Record voice from the device microphone (Expo Go on Android)
- **Record** / **Stop** with live duration timer
- Save recordings into the app document directory
- Persist metadata (name, duration, date, file URI) with AsyncStorage
- List recordings with name, duration, and date
- **Play** / **Stop** playback
- **Delete** recording (file + metadata)
- **Rename** (display name)
- Graceful empty, permission-denied, and error states

## Tech stack

| Piece | Choice |
| --- | --- |
| Framework | Expo SDK 57 (managed) + TypeScript |
| Audio | `expo-audio` (record + playback) |
| Metadata | `@react-native-async-storage/async-storage` |
| File delete | `expo-file-system/legacy` |
| UI | React Native (dark theme) |

## Project structure

```
android-voice-recorder/
├── App.tsx                      # Main screen: record, list, play, rename, delete
├── app.json                     # Expo config + microphone permissions plugin
├── index.ts                     # Entry
├── package.json
├── src/
│   ├── types.ts                 # RecordingItem type
│   ├── components/
│   │   └── RecordingRow.tsx     # List row actions
│   ├── services/
│   │   └── storage.ts           # AsyncStorage + file delete
│   └── utils/
│       └── format.ts            # Duration / date helpers
└── assets/
```

## Prerequisites

- Node.js 20+
- npm
- An Android phone with **Expo Go** installed from the Play Store
- Same Wi‑Fi network as your computer (for LAN), **or** use tunnel mode

## Run with Expo Go (Android)

1. Clone and install:

   ```bash
   git clone https://github.com/hemantkushwah641-cmd/android-voice-recorder.git
   cd android-voice-recorder
   npm install
   ```

2. Start the Metro bundler:

   ```bash
   npx expo start
   ```

   If the phone cannot reach your LAN, use a tunnel:

   ```bash
   npx expo start --tunnel
   ```

3. On your Android phone:
   - Open **Expo Go**
   - Scan the QR code from the terminal / browser Dev Tools
   - Or enter the `exp://…` URL shown in the terminal

4. When prompted, **Allow microphone** access so recording works.

### Alternative: open project URL in Expo Go

After `npx expo start`, Expo prints a URL like `exp://192.168.x.x:8081`. In Expo Go, use **Enter URL manually** if scanning fails.

## Permissions

- **Android:** `RECORD_AUDIO` (and audio settings) via `app.json` + the `expo-audio` config plugin (`recordAudioAndroid: true`).
- **iOS (if tested):** `NSMicrophoneUsageDescription` set in `app.json` / plugin.

Expo Go will show the system permission dialog the first time you record.

## Scripts

```bash
npm start          # same as npx expo start
npm run android    # start and try to open on Android emulator / device
```

## Notes

- Recordings are stored under the app **document** directory (`directory: 'document'` in `expo-audio` options) so they are not cleared with the cache as easily.
- Metadata lives in AsyncStorage under `@voice_recorder/recordings_v1`.
- Pause/resume while recording is not exposed in the UI; Start/Stop keeps the flow simple and reliable with the current API.
- This is a managed Expo app — no custom native code required for the MVP.

## License

See [LICENSE](./LICENSE).
