using UnityEngine;
using UnityEngine.UI;
using TMPro;
using QuestMagnifier.Core;

namespace QuestMagnifier.UI
{
    /// <summary>
    /// Floating settings panel with brightness and contrast sliders.
    /// Toggled via left controller menu button.
    ///
    /// Design: large touch targets, high-contrast labels, minimal controls.
    /// The panel appears in front of the user at a comfortable reading distance.
    /// </summary>
    public class SettingsPanel : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private PassthroughController passthroughController;
        [SerializeField] private MagnificationController magnificationController;

        [Header("Panel Settings")]
        [SerializeField] private float panelDistance = 0.6f;
        [SerializeField] private float sliderWidth = 300f;
        [SerializeField] private float sliderHeight = 60f;
        [SerializeField] private float labelFontSize = 36f;
        [SerializeField] private float valueFontSize = 32f;

        private Canvas _canvas;
        private GameObject _panelRoot;
        private Slider _brightnessSlider;
        private Slider _contrastSlider;
        private TextMeshProUGUI _brightnessValueText;
        private TextMeshProUGUI _contrastValueText;
        private bool _isVisible;

        private void Start()
        {
            if (passthroughController == null)
                passthroughController = FindObjectOfType<PassthroughController>();
            if (magnificationController == null)
                magnificationController = FindObjectOfType<MagnificationController>();

            CreatePanel();
            _panelRoot.SetActive(false);
            _isVisible = false;
        }

        /// <summary>Toggle panel visibility.</summary>
        public void TogglePanel()
        {
            _isVisible = !_isVisible;
            _panelRoot.SetActive(_isVisible);
        }

        public bool IsVisible => _isVisible;

        private void CreatePanel()
        {
            // World-space canvas
            _panelRoot = new GameObject("SettingsPanel");
            _canvas = _panelRoot.AddComponent<Canvas>();
            _canvas.renderMode = RenderMode.WorldSpace;
            _panelRoot.AddComponent<CanvasScaler>();
            _panelRoot.AddComponent<GraphicRaycaster>();

            // Parent to CenterEyeAnchor
            var rig = FindObjectOfType<OVRCameraRig>();
            if (rig != null && rig.centerEyeAnchor != null)
            {
                _panelRoot.transform.SetParent(rig.centerEyeAnchor, false);
            }

            _panelRoot.transform.localPosition = new Vector3(0f, -0.05f, panelDistance);
            _panelRoot.transform.localRotation = Quaternion.identity;
            _panelRoot.transform.localScale = Vector3.one * 0.001f;

            var canvasRect = _panelRoot.GetComponent<RectTransform>();
            canvasRect.sizeDelta = new Vector2(450f, 350f);

            // Dark background
            var bg = CreateChild(_panelRoot, "Background");
            var bgImage = bg.AddComponent<Image>();
            bgImage.color = new Color(0.1f, 0.1f, 0.1f, 0.9f);
            StretchFill(bg);

            // Title
            var title = CreateChild(_panelRoot, "Title");
            var titleText = title.AddComponent<TextMeshProUGUI>();
            titleText.text = "Settings";
            titleText.fontSize = 42f;
            titleText.color = Color.white;
            titleText.alignment = TextAlignmentOptions.Center;
            titleText.fontStyle = FontStyles.Bold;
            var titleRect = title.GetComponent<RectTransform>();
            titleRect.anchorMin = new Vector2(0f, 0.82f);
            titleRect.anchorMax = new Vector2(1f, 1f);
            titleRect.offsetMin = new Vector2(10f, 0f);
            titleRect.offsetMax = new Vector2(-10f, -5f);

            // Brightness slider
            CreateSliderRow(
                _panelRoot,
                "Brightness",
                0.48f, 0.78f,
                -1f, 1f, 0f,
                out _brightnessSlider,
                out _brightnessValueText,
                OnBrightnessChanged
            );

            // Contrast slider
            CreateSliderRow(
                _panelRoot,
                "Contrast",
                0.15f, 0.45f,
                -1f, 1f, 0f,
                out _contrastSlider,
                out _contrastValueText,
                OnContrastChanged
            );

            // Reset button
            var resetBtn = CreateChild(_panelRoot, "ResetButton");
            var btnImage = resetBtn.AddComponent<Image>();
            btnImage.color = new Color(0.3f, 0.3f, 0.8f, 1f);
            var btnRect = resetBtn.GetComponent<RectTransform>();
            btnRect.anchorMin = new Vector2(0.25f, 0.02f);
            btnRect.anchorMax = new Vector2(0.75f, 0.13f);
            btnRect.offsetMin = Vector2.zero;
            btnRect.offsetMax = Vector2.zero;

            var btn = resetBtn.AddComponent<Button>();
            btn.onClick.AddListener(OnResetPressed);

            var btnTextObj = CreateChild(resetBtn, "Text");
            var btnText = btnTextObj.AddComponent<TextMeshProUGUI>();
            btnText.text = "RESET";
            btnText.fontSize = 30f;
            btnText.color = Color.white;
            btnText.alignment = TextAlignmentOptions.Center;
            StretchFill(btnTextObj);
        }

        private void CreateSliderRow(
            GameObject parent, string label,
            float anchorYMin, float anchorYMax,
            float min, float max, float defaultValue,
            out Slider slider, out TextMeshProUGUI valueText,
            UnityEngine.Events.UnityAction<float> onChange)
        {
            // Label
            var labelObj = CreateChild(parent, label + "Label");
            var labelTmp = labelObj.AddComponent<TextMeshProUGUI>();
            labelTmp.text = label;
            labelTmp.fontSize = labelFontSize;
            labelTmp.color = Color.white;
            labelTmp.alignment = TextAlignmentOptions.Left;
            var labelRect = labelObj.GetComponent<RectTransform>();
            labelRect.anchorMin = new Vector2(0.05f, anchorYMax - 0.08f);
            labelRect.anchorMax = new Vector2(0.65f, anchorYMax);
            labelRect.offsetMin = Vector2.zero;
            labelRect.offsetMax = Vector2.zero;

            // Value display
            var valueObj = CreateChild(parent, label + "Value");
            valueText = valueObj.AddComponent<TextMeshProUGUI>();
            valueText.text = "0%";
            valueText.fontSize = valueFontSize;
            valueText.color = new Color(0.7f, 0.9f, 1f, 1f);
            valueText.alignment = TextAlignmentOptions.Right;
            var valueRect = valueObj.GetComponent<RectTransform>();
            valueRect.anchorMin = new Vector2(0.65f, anchorYMax - 0.08f);
            valueRect.anchorMax = new Vector2(0.95f, anchorYMax);
            valueRect.offsetMin = Vector2.zero;
            valueRect.offsetMax = Vector2.zero;

            // Slider
            var sliderObj = CreateChild(parent, label + "Slider");
            var sliderRect = sliderObj.GetComponent<RectTransform>();
            sliderRect.anchorMin = new Vector2(0.05f, anchorYMin);
            sliderRect.anchorMax = new Vector2(0.95f, anchorYMax - 0.1f);
            sliderRect.offsetMin = Vector2.zero;
            sliderRect.offsetMax = Vector2.zero;

            // Slider background
            var bgObj = CreateChild(sliderObj, "Background");
            var bgImg = bgObj.AddComponent<Image>();
            bgImg.color = new Color(0.3f, 0.3f, 0.3f, 1f);
            StretchFill(bgObj);

            // Fill area
            var fillArea = CreateChild(sliderObj, "Fill Area");
            StretchFill(fillArea);

            var fill = CreateChild(fillArea, "Fill");
            var fillImg = fill.AddComponent<Image>();
            fillImg.color = new Color(0.2f, 0.6f, 1f, 1f);
            StretchFill(fill);

            // Handle slide area
            var handleArea = CreateChild(sliderObj, "Handle Slide Area");
            StretchFill(handleArea);

            var handle = CreateChild(handleArea, "Handle");
            var handleImg = handle.AddComponent<Image>();
            handleImg.color = Color.white;
            var handleRect = handle.GetComponent<RectTransform>();
            handleRect.sizeDelta = new Vector2(30f, 0f);

            // Configure slider component
            slider = sliderObj.AddComponent<Slider>();
            slider.minValue = min;
            slider.maxValue = max;
            slider.value = defaultValue;
            slider.fillRect = fill.GetComponent<RectTransform>();
            slider.handleRect = handle.GetComponent<RectTransform>();
            slider.onValueChanged.AddListener(onChange);
        }

        private void OnBrightnessChanged(float value)
        {
            if (passthroughController != null)
                passthroughController.Brightness = value;
            if (magnificationController != null)
                magnificationController.SetShaderBrightness(value);

            if (_brightnessValueText != null)
                _brightnessValueText.text = $"{(int)(value * 100)}%";
        }

        private void OnContrastChanged(float value)
        {
            if (passthroughController != null)
                passthroughController.Contrast = value;
            if (magnificationController != null)
                magnificationController.SetShaderContrast(value);

            if (_contrastValueText != null)
                _contrastValueText.text = $"{(int)(value * 100)}%";
        }

        private void OnResetPressed()
        {
            if (_brightnessSlider != null) _brightnessSlider.value = 0f;
            if (_contrastSlider != null) _contrastSlider.value = 0f;

            if (passthroughController != null)
                passthroughController.ResetColorAdjustments();
        }

        private static GameObject CreateChild(GameObject parent, string name)
        {
            var obj = new GameObject(name);
            obj.transform.SetParent(parent.transform, false);
            obj.AddComponent<RectTransform>();
            return obj;
        }

        private static void StretchFill(GameObject obj)
        {
            var rect = obj.GetComponent<RectTransform>();
            rect.anchorMin = Vector2.zero;
            rect.anchorMax = Vector2.one;
            rect.offsetMin = Vector2.zero;
            rect.offsetMax = Vector2.zero;
        }
    }
}
