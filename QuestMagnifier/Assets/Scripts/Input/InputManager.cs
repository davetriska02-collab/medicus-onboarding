using UnityEngine;
using QuestMagnifier.Core;
using QuestMagnifier.Features;
using QuestMagnifier.UI;

namespace QuestMagnifier.Input
{
    /// <summary>
    /// Maps Quest 3 controller inputs to app actions.
    ///
    /// Right thumbstick up/down  → zoom in/out (continuous)
    /// Right index trigger       → freeze frame toggle
    /// Left menu button          → settings panel toggle
    ///
    /// Uses OVRInput which is polled each frame — no event system needed.
    /// </summary>
    public class InputManager : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private MagnificationController magnification;
        [SerializeField] private FreezeFrameController freezeFrame;
        [SerializeField] private SettingsPanel settingsPanel;

        [Header("Tuning")]
        [SerializeField] private float thumbstickZoomSpeed = 3f;
        [SerializeField] private float thumbstickDeadzone = 0.15f;

        // Debounce for button presses
        private bool _triggerWasPressed;
        private bool _menuWasPressed;

        private void Start()
        {
            AutoFindReferences();
        }

        private void Update()
        {
            HandleThumbstickZoom();
            HandleFreezeFrameToggle();
            HandleSettingsToggle();
        }

        private void HandleThumbstickZoom()
        {
            if (magnification == null) return;

            // Right thumbstick Y axis
            Vector2 thumbstick = OVRInput.Get(OVRInput.Axis2D.SecondaryThumbstick);
            float y = thumbstick.y;

            if (Mathf.Abs(y) > thumbstickDeadzone)
            {
                float delta = y * thumbstickZoomSpeed * Time.deltaTime;
                magnification.AdjustZoom(delta);
            }
        }

        private void HandleFreezeFrameToggle()
        {
            if (freezeFrame == null) return;

            // Right index trigger — detect press (not hold)
            bool triggerPressed = OVRInput.Get(OVRInput.Button.SecondaryIndexTrigger);

            if (triggerPressed && !_triggerWasPressed)
            {
                freezeFrame.ToggleFreeze();
            }

            _triggerWasPressed = triggerPressed;
        }

        private void HandleSettingsToggle()
        {
            if (settingsPanel == null) return;

            // Left menu button
            bool menuPressed = OVRInput.GetDown(OVRInput.Button.Start);

            if (menuPressed && !_menuWasPressed)
            {
                settingsPanel.TogglePanel();
            }

            _menuWasPressed = menuPressed;
        }

        private void AutoFindReferences()
        {
            if (magnification == null)
                magnification = FindObjectOfType<MagnificationController>();
            if (freezeFrame == null)
                freezeFrame = FindObjectOfType<FreezeFrameController>();
            if (settingsPanel == null)
                settingsPanel = FindObjectOfType<SettingsPanel>();
        }
    }
}
