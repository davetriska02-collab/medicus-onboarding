# Quest Magnifier

Passthrough magnification app for Meta Quest 3, designed for users with macular degeneration and low vision. Launches straight into a magnified passthrough view — no menus, no setup.

## Features

| Feature | Control | Details |
|---------|---------|---------|
| **Zoom 1x–8x** | Right thumbstick up/down | Smooth, continuous zoom. Defaults to 2x on launch |
| **Voice commands** | Say: "zoom in", "zoom out", "reset", "max zoom" | Hands-free control via Quest microphone |
| **Zoom HUD** | Always visible | Large text (56pt) in top-right corner showing current zoom |
| **Brightness / Contrast** | Left menu button → sliders | Adjusts both passthrough and magnified views |
| **Freeze frame** | Right trigger | Captures current view as a still. Tap again to unfreeze |

## Requirements

- **Meta Quest 3** headset
- **Unity 2022.3 LTS** (2022.3.20f1 or later)
- **Meta XR Core SDK v60+** (installed via Unity Package Manager)
- **Android SDK** with API level 29+
- **ADB** for sideloading

## Quick Start

### 1. Clone and open in Unity

```bash
git clone <this-repo>
```

Open `QuestMagnifier/` as a Unity project. Unity will install packages from `Packages/manifest.json` including the Meta XR SDK.

### 2. Set up the scene

Follow `Assets/Scenes/SceneSetupGuide.md` to build the scene hierarchy. Key steps:

1. Add `OVRCameraRig` prefab (from Meta XR SDK)
2. Enable Passthrough on `OVRManager`
3. Create empty GameObjects and attach the scripts
4. Set CenterEyeAnchor camera background to transparent

### 3. Build the APK

1. **File → Build Settings → Android**
2. Player Settings: IL2CPP, ARM64, API 29+, Linear color space
3. XR Plug-in Management: enable Oculus, target Quest 3
4. Build → `QuestMagnifier.apk`

### 4. Sideload to Quest 3

```bash
# Connect Quest 3 via USB (enable Developer Mode first)
adb install QuestMagnifier.apk

# Or reinstall over existing
adb install -r QuestMagnifier.apk
```

The app appears in **Unknown Sources** on the Quest. Launch it — you'll go straight into magnified passthrough.

## How to Enable Developer Mode

1. Install the **Meta Quest app** on your phone
2. Go to **Menu → Devices → your Quest 3**
3. Tap **Settings → Developer Mode → toggle ON**
4. Restart the headset

## Architecture

```
Assets/Scripts/
├── Core/
│   ├── AppManager.cs              # Boot controller, no splash screen
│   ├── PassthroughController.cs   # OVR passthrough + brightness/contrast
│   └── MagnificationController.cs # Camera-based zoom (WebCamTexture)
├── Input/
│   ├── InputManager.cs            # Controller mapping (thumbstick, trigger, menu)
│   └── VoiceCommandManager.cs     # Android SpeechRecognizer integration
├── UI/
│   ├── ZoomHUD.cs                 # Zoom level display (48pt+ text)
│   └── SettingsPanel.cs           # Brightness/contrast sliders
├── Features/
│   └── FreezeFrameController.cs   # Freeze/unfreeze current view
└── Shaders/
    └── MagnifyPassthrough.shader  # UV-based zoom + brightness/contrast
```

## Technical Notes

### Magnification approach

Quest 3 passthrough is composited at the OS level, outside Unity's render pipeline. Direct zoom of the passthrough layer isn't supported by the Meta XR SDK. This app uses `WebCamTexture` to access the Quest's camera feed and renders it magnified via a custom shader with UV scaling. This provides reliable zoom control at the cost of losing stereoscopic depth at zoom levels above 1x.

At 1x zoom, native passthrough is used for the best quality experience.

### Brightness and contrast

Two layers of adjustment are applied:
- **Native passthrough**: `OVRPassthroughLayer.SetColorMapControls()` for the base passthrough
- **Magnification shader**: `_Brightness` and `_Contrast` uniforms for the zoomed camera feed

Both are synchronized by the SettingsPanel.

### Voice commands

Uses Android's `SpeechRecognizer` API via JNI (AndroidJavaObject). Runs on-device keyword recognition — no internet required for basic commands. Listens continuously and restarts automatically after each recognition cycle.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Black screen on launch | Ensure passthrough is enabled in OVRManager AND AndroidManifest |
| No magnification | Check camera permissions in Quest settings. WebCamTexture needs CAMERA permission |
| Voice commands not working | Check microphone permission. Say commands clearly with a pause before and after |
| App not in Unknown Sources | Ensure Developer Mode is enabled and ADB install succeeded |
| Low framerate | Reduce zoom level. Higher zoom = more GPU work on the shader |

## License

MIT
