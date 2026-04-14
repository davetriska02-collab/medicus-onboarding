using UnityEngine;
using UnityEngine.UI;
using TMPro;
using QuestMagnifier.Core;

namespace QuestMagnifier.UI
{
    /// <summary>
    /// Displays current zoom level as large text in the top-right corner.
    ///
    /// Requirements:
    /// - Minimum 48pt font size
    /// - High contrast (white text on dark semi-transparent background)
    /// - Visible but unobtrusive
    /// - Updates smoothly as zoom changes
    ///
    /// This creates its own world-space Canvas parented to CenterEyeAnchor
    /// so it follows head movement and stays in the user's peripheral vision.
    /// </summary>
    public class ZoomHUD : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private MagnificationController magnification;

        [Header("Appearance")]
        [SerializeField] private float fontSize = 56f;
        [SerializeField] private Color textColor = Color.white;
        [SerializeField] private Color backgroundColor = new Color(0f, 0f, 0f, 0.6f);

        private Canvas _canvas;
        private TextMeshProUGUI _zoomText;
        private TextMeshProUGUI _statusText;
        private Image _background;
        private float _lastDisplayedZoom = -1f;

        private void Start()
        {
            if (magnification == null)
                magnification = FindObjectOfType<MagnificationController>();

            CreateHUD();
        }

        private void Update()
        {
            if (magnification == null) return;

            float zoom = magnification.CurrentZoom;

            // Only update text when value changes meaningfully
            if (Mathf.Abs(zoom - _lastDisplayedZoom) > 0.05f)
            {
                _lastDisplayedZoom = zoom;
                UpdateZoomDisplay(zoom);
            }
        }

        private void CreateHUD()
        {
            // Create world-space canvas
            var canvasObj = new GameObject("ZoomHUD_Canvas");
            _canvas = canvasObj.AddComponent<Canvas>();
            _canvas.renderMode = RenderMode.WorldSpace;
            canvasObj.AddComponent<CanvasScaler>();
            canvasObj.AddComponent<GraphicRaycaster>();

            // Parent to CenterEyeAnchor
            var rig = FindObjectOfType<OVRCameraRig>();
            if (rig != null && rig.centerEyeAnchor != null)
            {
                canvasObj.transform.SetParent(rig.centerEyeAnchor, false);
            }

            // Position: top-right corner of user's view
            canvasObj.transform.localPosition = new Vector3(0.25f, 0.18f, 0.5f);
            canvasObj.transform.localRotation = Quaternion.identity;
            canvasObj.transform.localScale = Vector3.one * 0.001f; // World-space canvas scale

            // Set canvas size
            var rectTransform = canvasObj.GetComponent<RectTransform>();
            rectTransform.sizeDelta = new Vector2(200f, 120f);

            // Background panel
            var bgObj = new GameObject("Background");
            bgObj.transform.SetParent(canvasObj.transform, false);
            _background = bgObj.AddComponent<Image>();
            _background.color = backgroundColor;
            var bgRect = bgObj.GetComponent<RectTransform>();
            bgRect.anchorMin = Vector2.zero;
            bgRect.anchorMax = Vector2.one;
            bgRect.offsetMin = Vector2.zero;
            bgRect.offsetMax = Vector2.zero;

            // Round corners via sprite — skip for simplicity, solid rect is fine

            // Zoom text
            var textObj = new GameObject("ZoomText");
            textObj.transform.SetParent(canvasObj.transform, false);
            _zoomText = textObj.AddComponent<TextMeshProUGUI>();
            _zoomText.text = "2.0x";
            _zoomText.fontSize = fontSize;
            _zoomText.color = textColor;
            _zoomText.alignment = TextAlignmentOptions.Center;
            _zoomText.fontStyle = FontStyles.Bold;

            var textRect = textObj.GetComponent<RectTransform>();
            textRect.anchorMin = new Vector2(0f, 0.3f);
            textRect.anchorMax = new Vector2(1f, 1f);
            textRect.offsetMin = Vector2.zero;
            textRect.offsetMax = Vector2.zero;

            // Status text (for "FROZEN" indicator etc.)
            var statusObj = new GameObject("StatusText");
            statusObj.transform.SetParent(canvasObj.transform, false);
            _statusText = statusObj.AddComponent<TextMeshProUGUI>();
            _statusText.text = "";
            _statusText.fontSize = 28f;
            _statusText.color = new Color(1f, 0.3f, 0.3f, 1f); // Red for alerts
            _statusText.alignment = TextAlignmentOptions.Center;

            var statusRect = statusObj.GetComponent<RectTransform>();
            statusRect.anchorMin = new Vector2(0f, 0f);
            statusRect.anchorMax = new Vector2(1f, 0.35f);
            statusRect.offsetMin = Vector2.zero;
            statusRect.offsetMax = Vector2.zero;
        }

        private void UpdateZoomDisplay(float zoom)
        {
            if (_zoomText != null)
            {
                _zoomText.text = $"{zoom:F1}x";
            }
        }

        /// <summary>Show or hide the FROZEN status indicator.</summary>
        public void SetFrozenIndicator(bool frozen)
        {
            if (_statusText != null)
            {
                _statusText.text = frozen ? "FROZEN" : "";
            }
        }

        /// <summary>Flash a brief status message (e.g., voice command confirmation).</summary>
        public void ShowStatus(string message, float duration = 1.5f)
        {
            if (_statusText != null)
            {
                _statusText.text = message;
                if (!string.IsNullOrEmpty(message))
                    StartCoroutine(ClearStatusAfterDelay(duration));
            }
        }

        private System.Collections.IEnumerator ClearStatusAfterDelay(float delay)
        {
            yield return new WaitForSeconds(delay);
            if (_statusText != null)
                _statusText.text = "";
        }
    }
}
