using UnityEngine;
using QuestMagnifier.Core;
using QuestMagnifier.UI;

namespace QuestMagnifier.Features
{
    /// <summary>
    /// Freeze frame: captures the current view as a still image so the user
    /// can study it without holding the headset perfectly still.
    ///
    /// How it works:
    /// - When using WebCamTexture magnification: pauses the webcam texture
    ///   update and keeps the last frame displayed.
    /// - When using native passthrough (1x zoom): captures a screenshot
    ///   into a RenderTexture and overlays it.
    ///
    /// Toggle with right trigger. Visual "FROZEN" indicator shown on HUD.
    /// </summary>
    public class FreezeFrameController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private MagnificationController magnification;
        [SerializeField] private ZoomHUD hud;

        [Header("Freeze Frame")]
        [SerializeField] private GameObject freezeQuad;

        private bool _isFrozen;
        private Texture2D _frozenTexture;
        private RenderTexture _captureRT;

        public bool IsFrozen => _isFrozen;

        private void Start()
        {
            if (magnification == null)
                magnification = FindObjectOfType<MagnificationController>();
            if (hud == null)
                hud = FindObjectOfType<ZoomHUD>();
        }

        /// <summary>Toggle freeze state on/off.</summary>
        public void ToggleFreeze()
        {
            if (_isFrozen)
                Unfreeze();
            else
                Freeze();
        }

        private void Freeze()
        {
            _isFrozen = true;

            if (magnification != null && magnification.CameraAvailable)
            {
                // Camera-based magnification: capture current frame to a static texture
                CaptureWebcamFrame();
            }
            else
            {
                // Native passthrough: capture screenshot
                CaptureScreenshot();
            }

            // Update HUD
            if (hud != null)
                hud.SetFrozenIndicator(true);

            Debug.Log("[FreezeFrame] Frozen");
        }

        private void Unfreeze()
        {
            _isFrozen = false;

            // Clean up frozen texture
            if (_frozenTexture != null)
            {
                Destroy(_frozenTexture);
                _frozenTexture = null;
            }

            // Hide freeze overlay
            if (freezeQuad != null)
                freezeQuad.SetActive(false);

            // Resume magnification display
            // (MagnificationController handles its own quad visibility)

            if (hud != null)
                hud.SetFrozenIndicator(false);

            Debug.Log("[FreezeFrame] Unfrozen");
        }

        private void CaptureWebcamFrame()
        {
            // Get the current webcam texture from the magnification quad
            var magQuad = magnification.GetComponentInChildren<Renderer>();
            if (magQuad == null || magQuad.material == null) return;

            Texture currentTex = magQuad.material.mainTexture;
            if (currentTex == null) return;

            // Copy current frame to a Texture2D
            if (currentTex is WebCamTexture webcam)
            {
                _frozenTexture = new Texture2D(webcam.width, webcam.height, TextureFormat.RGBA32, false);
                _frozenTexture.SetPixels32(webcam.GetPixels32());
                _frozenTexture.Apply();

                // Replace the live texture with the frozen one
                magQuad.material.mainTexture = _frozenTexture;
            }
            else if (currentTex is RenderTexture rt)
            {
                _frozenTexture = new Texture2D(rt.width, rt.height, TextureFormat.RGBA32, false);
                RenderTexture.active = rt;
                _frozenTexture.ReadPixels(new Rect(0, 0, rt.width, rt.height), 0, 0);
                _frozenTexture.Apply();
                RenderTexture.active = null;

                magQuad.material.mainTexture = _frozenTexture;
            }
        }

        private void CaptureScreenshot()
        {
            // For native passthrough mode, create an overlay with the captured screen
            Camera cam = Camera.main;
            if (cam == null) return;

            int width = cam.pixelWidth;
            int height = cam.pixelHeight;

            if (_captureRT == null || _captureRT.width != width || _captureRT.height != height)
            {
                if (_captureRT != null) _captureRT.Release();
                _captureRT = new RenderTexture(width, height, 24);
            }

            // Render current camera view to RT
            cam.targetTexture = _captureRT;
            cam.Render();
            cam.targetTexture = null;

            // Create Texture2D from RT
            _frozenTexture = new Texture2D(width, height, TextureFormat.RGBA32, false);
            RenderTexture.active = _captureRT;
            _frozenTexture.ReadPixels(new Rect(0, 0, width, height), 0, 0);
            _frozenTexture.Apply();
            RenderTexture.active = null;

            // Display on freeze quad
            ShowFreezeOverlay(_frozenTexture);
        }

        private void ShowFreezeOverlay(Texture2D texture)
        {
            if (freezeQuad == null)
            {
                freezeQuad = GameObject.CreatePrimitive(PrimitiveType.Quad);
                freezeQuad.name = "FreezeFrameQuad";

                var col = freezeQuad.GetComponent<Collider>();
                if (col != null) Destroy(col);

                // Parent to CenterEyeAnchor
                var rig = FindObjectOfType<OVRCameraRig>();
                if (rig != null && rig.centerEyeAnchor != null)
                {
                    freezeQuad.transform.SetParent(rig.centerEyeAnchor, false);
                }

                freezeQuad.transform.localPosition = new Vector3(0f, 0f, 0.45f);
                freezeQuad.transform.localRotation = Quaternion.identity;
                float halfSize = 0.45f * Mathf.Tan(45f * Mathf.Deg2Rad);
                freezeQuad.transform.localScale = new Vector3(halfSize * 2f, halfSize * 2f, 1f);
            }

            var renderer = freezeQuad.GetComponent<Renderer>();
            renderer.material = new Material(Shader.Find("Unlit/Texture"));
            renderer.material.mainTexture = texture;
            freezeQuad.SetActive(true);
        }

        private void OnDestroy()
        {
            if (_frozenTexture != null) Destroy(_frozenTexture);
            if (_captureRT != null) _captureRT.Release();
        }
    }
}
