using UnityEngine;
using System.Collections;

namespace QuestMagnifier.Core
{
    /// <summary>
    /// Handles passthrough magnification from 1x to 8x.
    ///
    /// Technical approach:
    /// The Quest 3's passthrough is composited at the OS level, outside Unity's
    /// render pipeline, so we cannot post-process it directly. Instead we:
    ///
    /// 1. Use OVRPassthroughLayer as the background (underlay).
    /// 2. At zoom levels > 1x, we access the Quest camera feed via WebCamTexture
    ///    and render it magnified onto a full-viewport quad using a shader that
    ///    scales UVs around the center.
    /// 3. If WebCamTexture isn't available (camera permissions / device restrictions),
    ///    we fall back to native passthrough at 1x and show a HUD notice.
    ///
    /// The magnification quad is parented to CenterEyeAnchor so it moves with
    /// the user's head.
    /// </summary>
    public class MagnificationController : MonoBehaviour
    {
        public const float MinZoom = 1f;
        public const float MaxZoom = 8f;
        public const float DefaultZoom = 2f;
        public const float ZoomStep = 0.5f;

        [Header("Zoom")]
        [SerializeField] private float currentZoom = DefaultZoom;
        [SerializeField] private float zoomSmoothSpeed = 8f;

        [Header("Magnification Quad")]
        [SerializeField] private GameObject magnificationQuad;
        [SerializeField] private Material magnifyMaterial;

        private float _targetZoom;
        private float _displayZoom;
        private WebCamTexture _webcamTexture;
        private bool _cameraAvailable;
        private bool _initialized;

        // Shader property IDs (cached for performance)
        private static readonly int ZoomLevelProp = Shader.PropertyToID("_ZoomLevel");
        private static readonly int BrightnessProp = Shader.PropertyToID("_Brightness");
        private static readonly int ContrastProp = Shader.PropertyToID("_Contrast");

        public float CurrentZoom => _displayZoom;
        public bool CameraAvailable => _cameraAvailable;

        public event System.Action<float> OnZoomChanged;

        public void Initialize()
        {
            _targetZoom = currentZoom;
            _displayZoom = currentZoom;
            StartCoroutine(SetupCamera());
        }

        private IEnumerator SetupCamera()
        {
            // Request camera permission on Android
            if (!Application.HasUserAuthorization(UserAuthorization.WebCam))
            {
                yield return Application.RequestUserAuthorization(UserAuthorization.WebCam);
            }

            if (!Application.HasUserAuthorization(UserAuthorization.WebCam))
            {
                Debug.LogWarning("[MagnificationController] Camera permission denied — magnification disabled");
                _cameraAvailable = false;
                _initialized = true;
                yield break;
            }

            // Find available cameras
            WebCamDevice[] devices = WebCamTexture.devices;
            if (devices.Length == 0)
            {
                Debug.LogWarning("[MagnificationController] No cameras found — magnification disabled");
                _cameraAvailable = false;
                _initialized = true;
                yield break;
            }

            // Prefer the first camera (typically the passthrough camera on Quest)
            string camName = devices[0].name;
            Debug.Log($"[MagnificationController] Using camera: {camName}");

            _webcamTexture = new WebCamTexture(camName, 2064, 2208, 30);
            _webcamTexture.Play();

            // Wait a frame for the texture to initialize
            yield return null;

            if (_webcamTexture.width <= 16)
            {
                // Texture didn't initialize — camera not accessible
                Debug.LogWarning("[MagnificationController] Camera texture failed to initialize");
                _webcamTexture.Stop();
                _webcamTexture = null;
                _cameraAvailable = false;
                _initialized = true;
                yield break;
            }

            _cameraAvailable = true;
            SetupMagnificationQuad();
            ApplyZoom();
            _initialized = true;
            Debug.Log($"[MagnificationController] Camera ready ({_webcamTexture.width}x{_webcamTexture.height}), zoom={currentZoom}x");
        }

        private void SetupMagnificationQuad()
        {
            if (magnificationQuad == null)
            {
                // Create a quad that fills the user's viewport
                magnificationQuad = GameObject.CreatePrimitive(PrimitiveType.Quad);
                magnificationQuad.name = "MagnificationQuad";

                // Remove collider — not needed
                var col = magnificationQuad.GetComponent<Collider>();
                if (col != null) Destroy(col);
            }

            // Parent to CenterEyeAnchor so it follows head movement
            var rig = FindObjectOfType<OVRCameraRig>();
            if (rig != null && rig.centerEyeAnchor != null)
            {
                magnificationQuad.transform.SetParent(rig.centerEyeAnchor, false);
            }

            // Position close to the camera, covering the FOV
            magnificationQuad.transform.localPosition = new Vector3(0f, 0f, 0.5f);
            magnificationQuad.transform.localRotation = Quaternion.identity;
            // Scale to fill approximately 90-degree FOV at 0.5m distance
            float halfSize = 0.5f * Mathf.Tan(45f * Mathf.Deg2Rad);
            magnificationQuad.transform.localScale = new Vector3(halfSize * 2f, halfSize * 2f, 1f);

            // Apply material with camera texture
            var renderer = magnificationQuad.GetComponent<Renderer>();
            if (magnifyMaterial != null)
            {
                renderer.material = magnifyMaterial;
            }
            else
            {
                // Create material at runtime if none assigned
                var shader = Shader.Find("QuestMagnifier/MagnifyPassthrough");
                if (shader == null)
                    shader = Shader.Find("Unlit/Texture");

                renderer.material = new Material(shader);
            }

            renderer.material.mainTexture = _webcamTexture;
        }

        private void Update()
        {
            if (!_initialized) return;

            // Smooth zoom transition
            _displayZoom = Mathf.Lerp(_displayZoom, _targetZoom, Time.deltaTime * zoomSmoothSpeed);
            ApplyZoom();
        }

        private void ApplyZoom()
        {
            if (!_cameraAvailable || magnificationQuad == null) return;

            var renderer = magnificationQuad.GetComponent<Renderer>();
            if (renderer != null && renderer.material != null)
            {
                renderer.material.SetFloat(ZoomLevelProp, _displayZoom);
            }

            // Show quad only when zoomed past 1x
            magnificationQuad.SetActive(_displayZoom > 1.05f);
        }

        /// <summary>Set zoom to an exact value.</summary>
        public void SetZoom(float zoom)
        {
            _targetZoom = Mathf.Clamp(zoom, MinZoom, MaxZoom);
            OnZoomChanged?.Invoke(_targetZoom);
        }

        /// <summary>Increment zoom by the given amount.</summary>
        public void AdjustZoom(float delta)
        {
            SetZoom(_targetZoom + delta);
        }

        /// <summary>Reset zoom to default (2x).</summary>
        public void ResetZoom()
        {
            SetZoom(DefaultZoom);
        }

        /// <summary>Jump to maximum zoom.</summary>
        public void MaxZoom_()
        {
            SetZoom(MaxZoom);
        }

        /// <summary>
        /// Set brightness on the magnification shader (not the passthrough layer).
        /// Range: -1 to 1.
        /// </summary>
        public void SetShaderBrightness(float value)
        {
            if (magnificationQuad == null) return;
            var renderer = magnificationQuad.GetComponent<Renderer>();
            if (renderer != null && renderer.material != null)
                renderer.material.SetFloat(BrightnessProp, value);
        }

        /// <summary>
        /// Set contrast on the magnification shader.
        /// Range: -1 to 1.
        /// </summary>
        public void SetShaderContrast(float value)
        {
            if (magnificationQuad == null) return;
            var renderer = magnificationQuad.GetComponent<Renderer>();
            if (renderer != null && renderer.material != null)
                renderer.material.SetFloat(ContrastProp, value);
        }

        private void OnDestroy()
        {
            if (_webcamTexture != null)
            {
                _webcamTexture.Stop();
                _webcamTexture = null;
            }
        }
    }
}
