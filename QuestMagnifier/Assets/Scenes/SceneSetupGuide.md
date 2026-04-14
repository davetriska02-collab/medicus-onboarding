# Scene Setup Guide

Unity scene files (.unity) are binary and can't be version-controlled as text.
Follow these steps to set up the scene in Unity Editor.

## Scene Hierarchy

Create a new scene and build this hierarchy:

```
MainScene
├── OVRCameraRig            (Meta XR SDK prefab)
│   ├── TrackingSpace
│   │   ├── LeftEyeAnchor
│   │   ├── CenterEyeAnchor
│   │   │   └── (HUD + magnification quad auto-created at runtime)
│   │   ├── RightEyeAnchor
│   │   ├── LeftControllerAnchor
│   │   └── RightControllerAnchor
│   └── OVRPassthroughLayer  (component on OVRCameraRig)
│
├── AppManager              (empty GameObject)
│   ├── AppManager.cs
│   ├── PassthroughController.cs
│   └── MagnificationController.cs
│
├── InputManager            (empty GameObject)
│   ├── InputManager.cs
│   └── VoiceCommandManager.cs
│
├── UIManager               (empty GameObject)
│   ├── ZoomHUD.cs
│   └── SettingsPanel.cs
│
└── FreezeFrame             (empty GameObject)
    └── FreezeFrameController.cs
```

## Step-by-Step Setup

### 1. OVRCameraRig
1. Delete the default Main Camera
2. Drag `OVRCameraRig` prefab from `Packages/Meta XR Core SDK/Prefabs/`
3. On the OVRCameraRig's **OVRManager** component:
   - Check **"Insight Passthrough → Enable Passthrough"**
   - Set **Tracking Origin Type** to "Floor Level"
   - Set **Target Devices** to "Quest 3"
4. Add an **OVRPassthroughLayer** component to OVRCameraRig:
   - Set **Overlay Type** to "Underlay"
   - Set **Composition Depth** to 0
5. On the CenterEyeAnchor Camera:
   - Set **Clear Flags** to "Solid Color"
   - Set **Background** to `(0, 0, 0, 0)` (transparent black)

### 2. AppManager GameObject
1. Create empty GameObject named "AppManager"
2. Attach: `AppManager.cs`, `PassthroughController.cs`, `MagnificationController.cs`
3. References are auto-found at runtime — no manual assignment needed

### 3. InputManager GameObject
1. Create empty GameObject named "InputManager"
2. Attach: `InputManager.cs`, `VoiceCommandManager.cs`

### 4. UIManager GameObject
1. Create empty GameObject named "UIManager"
2. Attach: `ZoomHUD.cs`, `SettingsPanel.cs`

### 5. FreezeFrame GameObject
1. Create empty GameObject named "FreezeFrame"
2. Attach: `FreezeFrameController.cs`

### 6. MagnifyPassthrough Material (optional)
1. Create a new Material in `Assets/Materials/`
2. Set shader to `QuestMagnifier/MagnifyPassthrough`
3. Assign to `MagnificationController.magnifyMaterial` (or leave empty for auto-creation)

## Build Settings

1. **File → Build Settings**
2. Switch platform to **Android**
3. Add `MainScene` to Scenes In Build
4. **Player Settings:**
   - Company Name: QuestMagnifier
   - Product Name: QuestMagnifier
   - Package Name: `com.questmagnifier.app`
   - Minimum API Level: 29
   - Target API Level: 32
   - Scripting Backend: IL2CPP
   - Target Architectures: ARM64 only
   - Color Space: Linear
5. **XR Plug-in Management:**
   - Enable **Oculus** under Android tab
   - Set Target Devices to **Quest 3**
6. **Build** → save as `QuestMagnifier.apk`
