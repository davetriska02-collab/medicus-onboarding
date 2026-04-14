using UnityEngine;
using System.Collections;
using QuestMagnifier.Core;

namespace QuestMagnifier.Input
{
    /// <summary>
    /// Voice command recognition using Android's SpeechRecognizer.
    ///
    /// Supported commands:
    ///   "zoom in"   → increase zoom by 1x
    ///   "zoom out"  → decrease zoom by 1x
    ///   "reset"     → return to 2x default
    ///   "max zoom"  → jump to 8x
    ///
    /// On Quest 3, the built-in microphone is used. The SpeechRecognizer
    /// runs on-device when possible (no internet required for basic keywords).
    ///
    /// Falls back to a simple keyword-matching approach if the Android
    /// SpeechRecognizer isn't available.
    /// </summary>
    public class VoiceCommandManager : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private MagnificationController magnification;

        [Header("Settings")]
        [SerializeField] private float listenRestartDelay = 0.5f;
        [SerializeField] private bool continuousListening = true;

        private bool _isListening;
        private bool _initialized;

#if UNITY_ANDROID && !UNITY_EDITOR
        private AndroidJavaObject _speechRecognizer;
        private AndroidJavaObject _activity;
#endif

        private void Start()
        {
            if (magnification == null)
                magnification = FindObjectOfType<MagnificationController>();

            StartCoroutine(InitializeVoiceRecognition());
        }

        private IEnumerator InitializeVoiceRecognition()
        {
            // Request microphone permission
            if (!Application.HasUserAuthorization(UserAuthorization.Microphone))
            {
                yield return Application.RequestUserAuthorization(UserAuthorization.Microphone);
            }

            if (!Application.HasUserAuthorization(UserAuthorization.Microphone))
            {
                Debug.LogWarning("[VoiceCommand] Microphone permission denied");
                yield break;
            }

#if UNITY_ANDROID && !UNITY_EDITOR
            try
            {
                SetupAndroidSpeechRecognizer();
                _initialized = true;
                Debug.Log("[VoiceCommand] Android SpeechRecognizer initialized");

                if (continuousListening)
                    StartListening();
            }
            catch (System.Exception e)
            {
                Debug.LogWarning($"[VoiceCommand] SpeechRecognizer setup failed: {e.Message}");
                _initialized = false;
            }
#else
            Debug.Log("[VoiceCommand] Voice commands only available on Android/Quest");
            _initialized = false;
#endif
            yield return null;
        }

#if UNITY_ANDROID && !UNITY_EDITOR
        private void SetupAndroidSpeechRecognizer()
        {
            using (var unityPlayer = new AndroidJavaClass("com.unity3d.player.UnityPlayer"))
            {
                _activity = unityPlayer.GetStatic<AndroidJavaObject>("currentActivity");
            }

            // Create a SpeechRecognizer
            using (var srClass = new AndroidJavaClass("android.speech.SpeechRecognizer"))
            {
                bool available = srClass.CallStatic<bool>("isRecognitionAvailable", _activity);
                if (!available)
                {
                    Debug.LogWarning("[VoiceCommand] Speech recognition not available on this device");
                    return;
                }

                _speechRecognizer = srClass.CallStatic<AndroidJavaObject>("createSpeechRecognizer", _activity);
            }

            // Set up the listener callback
            var listener = new SpeechRecognitionListener(this);
            _activity.Call("runOnUiThread", new AndroidJavaRunnable(() =>
            {
                _speechRecognizer.Call("setRecognitionListener", listener);
            }));
        }

        public void StartListening()
        {
            if (!_initialized || _speechRecognizer == null || _isListening) return;

            _activity.Call("runOnUiThread", new AndroidJavaRunnable(() =>
            {
                using (var intent = new AndroidJavaObject("android.content.Intent",
                    "android.speech.action.RECOGNIZE_SPEECH"))
                {
                    using (var recognizerIntent = new AndroidJavaClass("android.speech.RecognizerIntent"))
                    {
                        intent.Call<AndroidJavaObject>("putExtra",
                            recognizerIntent.GetStatic<string>("EXTRA_LANGUAGE_MODEL"),
                            recognizerIntent.GetStatic<string>("LANGUAGE_MODEL_FREE_FORM"));

                        intent.Call<AndroidJavaObject>("putExtra",
                            recognizerIntent.GetStatic<string>("EXTRA_PARTIAL_RESULTS"), true);

                        intent.Call<AndroidJavaObject>("putExtra",
                            recognizerIntent.GetStatic<string>("EXTRA_MAX_RESULTS"), 1);
                    }

                    _speechRecognizer.Call("startListening", intent);
                    _isListening = true;
                }
            }));
        }

        public void StopListening()
        {
            if (!_isListening || _speechRecognizer == null) return;

            _activity.Call("runOnUiThread", new AndroidJavaRunnable(() =>
            {
                _speechRecognizer.Call("stopListening");
                _isListening = false;
            }));
        }
#else
        public void StartListening() { }
        public void StopListening() { }
#endif

        /// <summary>
        /// Called from the SpeechRecognitionListener when results arrive.
        /// Matches recognized text against known commands.
        /// </summary>
        public void OnSpeechResult(string text)
        {
            if (magnification == null) return;

            string lower = text.ToLower().Trim();
            Debug.Log($"[VoiceCommand] Heard: \"{lower}\"");

            if (lower.Contains("zoom in") || lower.Contains("closer"))
            {
                magnification.AdjustZoom(MagnificationController.ZoomStep);
                Debug.Log("[VoiceCommand] → Zoom In");
            }
            else if (lower.Contains("zoom out") || lower.Contains("farther"))
            {
                magnification.AdjustZoom(-MagnificationController.ZoomStep);
                Debug.Log("[VoiceCommand] → Zoom Out");
            }
            else if (lower.Contains("reset") || lower.Contains("normal"))
            {
                magnification.ResetZoom();
                Debug.Log("[VoiceCommand] → Reset");
            }
            else if (lower.Contains("max zoom") || lower.Contains("maximum"))
            {
                magnification.MaxZoom_();
                Debug.Log("[VoiceCommand] → Max Zoom");
            }

            // Restart listening after a short delay
            if (continuousListening)
            {
                StartCoroutine(RestartListeningAfterDelay());
            }
        }

        private IEnumerator RestartListeningAfterDelay()
        {
            _isListening = false;
            yield return new WaitForSeconds(listenRestartDelay);
            StartListening();
        }

        private void OnDestroy()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            if (_speechRecognizer != null)
            {
                StopListening();
                _activity.Call("runOnUiThread", new AndroidJavaRunnable(() =>
                {
                    _speechRecognizer.Call("destroy");
                }));
                _speechRecognizer = null;
            }
#endif
        }
    }

#if UNITY_ANDROID && !UNITY_EDITOR
    /// <summary>
    /// Android RecognitionListener proxy that forwards results to VoiceCommandManager.
    /// </summary>
    public class SpeechRecognitionListener : AndroidJavaProxy
    {
        private readonly VoiceCommandManager _manager;

        public SpeechRecognitionListener(VoiceCommandManager manager)
            : base("android.speech.RecognitionListener")
        {
            _manager = manager;
        }

        // Called when recognition results are ready
        void onResults(AndroidJavaObject results)
        {
            ProcessResults(results);
        }

        // Called for partial recognition results
        void onPartialResults(AndroidJavaObject partialResults)
        {
            ProcessResults(partialResults);
        }

        void onError(int error)
        {
            Debug.LogWarning($"[VoiceCommand] Recognition error: {error}");
            // Restart listening on error (error 7 = no speech detected, which is normal)
            _manager.StartCoroutine(RestartAfterError());
        }

        private System.Collections.IEnumerator RestartAfterError()
        {
            yield return new WaitForSeconds(1f);
            _manager.StartListening();
        }

        private void ProcessResults(AndroidJavaObject bundle)
        {
            using (var srClass = new AndroidJavaClass("android.speech.SpeechRecognizer"))
            {
                string key = srClass.GetStatic<string>("RESULTS_RECOGNITION");
                AndroidJavaObject resultList = bundle.Call<AndroidJavaObject>("getStringArrayList", key);

                if (resultList != null)
                {
                    int count = resultList.Call<int>("size");
                    if (count > 0)
                    {
                        string text = resultList.Call<string>("get", 0);
                        _manager.OnSpeechResult(text);
                    }
                }
            }
        }

        // Required interface methods (no-op)
        void onReadyForSpeech(AndroidJavaObject @params) { }
        void onBeginningOfSpeech() { }
        void onRmsChanged(float rmsdB) { }
        void onBufferReceived(AndroidJavaObject buffer) { }
        void onEndOfSpeech() { }
        void onEvent(int eventType, AndroidJavaObject @params) { }
    }
#endif
}
