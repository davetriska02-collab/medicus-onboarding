using UnityEngine;

namespace QuestMagnifier.Core
{
    /// <summary>
    /// Root controller. Boots straight into passthrough magnification with no menus.
    /// Attach to an empty GameObject in the scene root.
    /// </summary>
    public class AppManager : MonoBehaviour
    {
        public static AppManager Instance { get; private set; }

        [Header("References (auto-found if left empty)")]
        [SerializeField] private PassthroughController passthroughController;
        [SerializeField] private MagnificationController magnificationController;

        private void Awake()
        {
            if (Instance != null)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            // Prevent screen dimming
            Screen.sleepTimeout = SleepTimeout.NeverSleep;

            // Lock framerate to Quest 3 native (90 Hz or 120 Hz)
            Application.targetFrameRate = 90;
            QualitySettings.vSyncCount = 0;

            AutoFindReferences();
        }

        private void Start()
        {
            // Boot order: passthrough first, then magnification on top
            if (passthroughController != null)
                passthroughController.Initialize();

            if (magnificationController != null)
                magnificationController.Initialize();

            Debug.Log("[QuestMagnifier] App ready — passthrough + magnification active");
        }

        private void AutoFindReferences()
        {
            if (passthroughController == null)
                passthroughController = FindObjectOfType<PassthroughController>();
            if (magnificationController == null)
                magnificationController = FindObjectOfType<MagnificationController>();
        }
    }
}
