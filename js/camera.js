export class CameraHandler {
    constructor(videoElementId) {
        this.video = document.getElementById(videoElementId);
        this.stream = null;
    }

    async start() {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            throw new Error("Browser does not support getUserMedia");
        }

        const constraints = {
            video: {
                width: { ideal: 1080 },
                height: { ideal: 1920 },
                facingMode: "user"
            },
            audio: false
        };

        try {
            this.stream = await navigator.mediaDevices.getUserMedia(constraints);
            this.video.srcObject = this.stream;
            
            return new Promise((resolve) => {
                this.video.onloadedmetadata = () => {
                    this.video.play();
                    resolve(this.video);
                };
            });
        } catch (error) {
            console.error("Camera Error:", error);
            throw error;
        }
    }

    getVideo() {
        return this.video;
    }
}
