using UnityEngine;

namespace QuestMagnifier.Core
{
    /// <summary>
    /// Configures Meta passthrough on Quest 3.
    /// Requires OVRManager and OVRPassthroughLayer on the OVRCameraRig.
    ///
    /// Brightness / contrast / saturation are exposed for the SettingsPanel.
    /// These use the native OVRPassthroughLayer colorMap editor which runs
    /// on the compositor — zero GPU cost.
    /// </summary>
    public class PassthroughController : MonoBehaviour
    {
        [Header("Passthrough Settings")]
        [SerializeField] private OVRPassthroughLayer passthroughLayer;
        [SerializeField] private OVRManager ovrManager;

        // Brightness: -1 to 1 (0 = default)
        private float _brightness = 0f;
        // Contrast: -1 to 1 (0 = default)
        private float _contrast = 0f;

        public float Brightness
        {
            get => _brightness;
            set
            {
                _brightness = Mathf.Clamp(value, -1f, 1f);
                ApplyColorAdjustments();
            }
        }

        public float Contrast
        {
            get => _contrast;
            set
            {
                _contrast = Mathf.Clamp(value, -1f, 1f);
                ApplyColorAdjustments();
            }
        }

        public void Initialize()
        {
            SetupPassthrough();
        }

        private void SetupPassthrough()
        {
            // Find OVRManager if not assigned
            if (ovrManager == null)
                ovrManager = FindObjectOfType<OVRManager>();

            if (ovrManager == null)
            {
                Debug.LogError("[PassthroughController] OVRManager not found in scene!");
                return;
            }

            // Enable insight passthrough
            ovrManager.isInsightPassthroughEnabled = true;

            // Find or create passthrough layer
            if (passthroughLayer == null)
                passthroughLayer = FindObjectOfType<OVRPassthroughLayer>();

            if (passthroughLayer == null)
            {
                // Create passthrough layer on the OVRManager's GameObject
                passthroughLayer = ovrManager.gameObject.AddComponent<OVRPassthroughLayer>();
            }

            // Configure as underlay (renders behind everything)
            passthroughLayer.overlayType = OVROverlay.OverlayType.Underlay;
            passthroughLayer.compositionDepth = 0;
            passthroughLayer.textureOpacity = 1f;
            passthroughLayer.hidden = false;

            // Clear camera background so passthrough shows through
            Camera centerCam = FindCenterEyeCamera();
            if (centerCam != null)
            {
                centerCam.clearFlags = CameraClearFlags.SolidColor;
                centerCam.backgroundColor = Color.clear;
            }

            ApplyColorAdjustments();
            Debug.Log("[PassthroughController] Passthrough enabled");
        }

        private void ApplyColorAdjustments()
        {
            if (passthroughLayer == null) return;

            passthroughLayer.SetColorMapControls(
                _brightness,
                _contrast,
                0f  // saturation — leave at default
            );
        }

        /// <summary>Reset brightness and contrast to defaults.</summary>
        public void ResetColorAdjustments()
        {
            Brightness = 0f;
            Contrast = 0f;
        }

        private Camera FindCenterEyeCamera()
        {
            var rig = FindObjectOfType<OVRCameraRig>();
            if (rig != null && rig.centerEyeAnchor != null)
                return rig.centerEyeAnchor.GetComponent<Camera>();
            return Camera.main;
        }
    }
}
