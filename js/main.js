import * as THREE from 'three';
import { CameraHandler } from './camera.js';
import { MediaPipeHandler } from './mediapipe.js';
import { SceneManager } from './scene_manager.js';

class App {
    constructor() {
        this.container = document.getElementById('container');
        this.canvas = document.getElementById('xr-canvas');
        this.videoElement = document.getElementById('webcam');
        this.startButton = document.getElementById('start-button');
        this.startScreen = document.getElementById('start-screen');
        this.infoPanel = document.getElementById('info-panel');
        this.fpsCounter = document.getElementById('fps-counter');
        this.trackingStatus = document.getElementById('tracking-status');

        this.toggleAfterimage = document.getElementById('toggle-afterimage');
        this.toggleTimemachine = document.getElementById('toggle-timemachine');
        this.toggleTimemachineHand = document.getElementById('toggle-timemachine-hand');
        this.toggleGravitybox = document.getElementById('toggle-gravitybox');

        this.scene = new THREE.Scene();
        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: true
        });

        this.cameraHandler = new CameraHandler('webcam');
        this.mpHandler = new MediaPipeHandler();
        this.sceneManager = new SceneManager({
            scene: this.scene,
            camera: this.camera,
            renderer: this.renderer
        });

        this.lastTime = 0;
        this.fps = 0;

        this.init();
    }

    async init() {
        this.renderer.setSize(window.innerWidth, window.innerHeight, true);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.camera.position.z = 3;

        window.addEventListener('resize', () => this.onResize());
        this.startButton.addEventListener('click', () => this.start());

        await this.mpHandler.init();
    }

    async start() {
        this.startScreen.classList.add('hidden');
        this.infoPanel.classList.remove('hidden');

        try {
            await this.cameraHandler.start();
            await this.sceneManager.loadScene('./scenes/scene_current.js');
            this.animate(0);
        } catch (err) {
            console.error("Initialization Failed:", err);
            alert("Camera access or MediaPipe initialization failed.");
        }
    }

    onResize() {
        const w = window.innerWidth;
        const h = window.innerHeight;
        this.renderer.setSize(w, h, true);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    animate(time) {
        requestAnimationFrame((t) => this.animate(t));

        const delta = time - this.lastTime;
        this.lastTime = time;
        if (delta > 0) {
            this.fps = Math.round(1000 / delta);
            this.fpsCounter.innerText = `${this.fps} FPS`;
        }

        const options = {
            afterimage: this.toggleAfterimage.checked,
            timemachine: this.toggleTimemachine.checked,
            timemachineHand: this.toggleTimemachineHand.checked,
            gravitybox: this.toggleGravitybox.checked
        };

        if (this.sceneManager.currentSceneInstance) {
            this.sceneManager.currentSceneInstance.setOptions(options);
        }

        const results = this.mpHandler.process(this.videoElement);
        
        if (results && (results.pose || results.hands.length > 0)) {
            this.trackingStatus.innerText = "(TRACKING ONLINE)";
            this.trackingStatus.className = "on";
        } else {
            this.trackingStatus.innerText = "(NO TRACKING)";
            this.trackingStatus.className = "off";
        }

        let scaleX = 1;
        let scaleY = 1;
        if (this.videoElement.videoWidth > 0 && this.videoElement.videoHeight > 0) {
            const W = window.innerWidth;
            const H = window.innerHeight;
            const wA = W / H;
            
            const vW = this.videoElement.videoWidth;
            const vH = this.videoElement.videoHeight;
            const vA = vW / vH;

            const dist = this.camera.position.z;
            const viewHeight = 2 * Math.tan((this.camera.fov / 2) * Math.PI / 180) * dist;
            const viewWidth = viewHeight * wA;

            let video3DWidth, video3DHeight;

            // Mathematical reverse-projection of CSS `object-fit: cover`
            if (wA < vA) {
                // Window is narrower than video
                video3DHeight = viewHeight;
                video3DWidth = viewHeight * vA;
            } else {
                // Window is wider than video
                video3DWidth = viewWidth;
                video3DHeight = viewWidth / vA;
            }

            scaleX = video3DWidth / 2;
            scaleY = video3DHeight / 2;
        }

        if (results) {
            if (this.sceneManager.currentSceneInstance && this.sceneManager.currentSceneInstance.update) {
                this.sceneManager.currentSceneInstance.update(results, scaleX, scaleY);
            }
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new App();
