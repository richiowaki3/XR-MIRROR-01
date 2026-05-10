import { FilesetResolver, PoseLandmarker, HandLandmarker } from '@mediapipe/tasks-vision';

export class MediaPipeHandler {
    constructor() {
        this.poseLandmarker = null;
        this.handLandmarker = null;
        this.isReady = false;
    }

    async init() {
        try {
            console.log("[MediaPipe] Initializing Vision Tasks...");
            const vision = await FilesetResolver.forVisionTasks(
                "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.3/wasm"
            );

            // Pose Landmarker
            this.poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numPoses: 1
            });

            // Hand Landmarker
            this.handLandmarker = await HandLandmarker.createFromOptions(vision, {
                baseOptions: {
                    modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
                    delegate: "GPU"
                },
                runningMode: "VIDEO",
                numHands: 2
            });

            this.isReady = true;
            console.log("[MediaPipe] Successfully initialized.");
        } catch (error) {
            console.error("[MediaPipe] Initialization Error:", error);
            throw error;
        }
    }

    process(video) {
        if (!this.isReady) return null;

        // Ensure video has dimensions before processing
        if (video.videoWidth === 0 || video.videoHeight === 0) return null;

        const startTimeMs = performance.now();
        const poseResults = this.poseLandmarker.detectForVideo(video, startTimeMs);
        const handResults = this.handLandmarker.detectForVideo(video, startTimeMs);

        let poseMapped = null;
        if (poseResults && poseResults.landmarks && poseResults.landmarks.length > 0) {
            poseMapped = this.mapLandmarks(poseResults.landmarks[0]);
        }

        let handsMapped = [];
        if (handResults && handResults.landmarks && handResults.landmarks.length > 0) {
            handsMapped = handResults.landmarks.map(hand => this.mapLandmarks(hand));
        }

        return {
            pose: poseMapped,
            hands: handsMapped
        };
    }

    mapLandmarks(landmarks) {
        if (!landmarks) return null;
        
        // Map to -1 to 1 space, mirroring X as requested (x = -x)
        return landmarks.map(lm => ({
            x: -(lm.x - 0.5) * 2,
            y: -(lm.y - 0.5) * 2,
            z: -lm.z * 2,
            visibility: lm.visibility || 1
        }));
    }
}
