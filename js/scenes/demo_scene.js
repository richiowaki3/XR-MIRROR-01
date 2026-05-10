import * as THREE from 'three';

export default class DemoScene {
    constructor({ scene }) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.trails = []; // Array of { mesh, time }
        this.trailLifetime = 3000; // 3 seconds

        this.history = [];
        this.historyLimit = 120; // ~2 seconds at 60fps
        this.delayFrames = 30; // ~0.5 seconds delay

        this.ghostPoints = [];
        this.init();
    }

    init() {
        // Ghost points for Timemachine
        const geometry = new THREE.SphereGeometry(0.015, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.3 });

        for (let i = 0; i < 42; i++) {
            const sphere = new THREE.Mesh(geometry, material);
            sphere.visible = false;
            this.group.add(sphere);
            this.ghostPoints.push(sphere);
        }

        // Ambient light for general scene visibility if needed
        const ambient = new THREE.AmbientLight(0xffffff, 0.5);
        this.group.add(ambient);
    }

    update(data) {
        if (!data) return;

        const now = performance.now();

        // 1. Hand Trails Logic
        data.hands.forEach(hand => {
            const wrist = hand[0]; // Wrist landmark
            this.createTrailPoint(wrist.x * 2, wrist.y * 2, wrist.z, now);
        });

        // Update existing trails
        this.trails = this.trails.filter(t => {
            const age = now - t.time;
            const alpha = 1.0 - (age / this.trailLifetime);
            
            if (alpha <= 0) {
                this.group.remove(t.mesh);
                t.mesh.geometry.dispose();
                t.mesh.material.dispose();
                return false;
            }

            t.mesh.material.opacity = alpha;
            return true;
        });

        // 2. Timemachine Logic
        this.history.push(JSON.parse(JSON.stringify(data)));
        if (this.history.length > this.historyLimit) {
            this.history.shift();
        }

        if (this.history.length > this.delayFrames) {
            const delayedData = this.history[this.history.length - 1 - this.delayFrames];
            this.updateGhosts(delayedData);
        }
    }

    createTrailPoint(x, y, z, time) {
        const geo = new THREE.SphereGeometry(0.01, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ 
            color: 0x00f2ff, 
            transparent: true, 
            opacity: 1.0,
            blending: THREE.AdditiveBlending 
        });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, y, z);
        this.group.add(mesh);
        this.trails.push({ mesh, time });
    }

    updateGhosts(data) {
        let ptIdx = 0;
        data.hands.forEach(hand => {
            hand.forEach(lm => {
                if (this.ghostPoints[ptIdx]) {
                    this.ghostPoints[ptIdx].position.set(lm.x * 2, lm.y * 2, lm.z);
                    this.ghostPoints[ptIdx].visible = true;
                    ptIdx++;
                }
            });
        });

        for (let i = ptIdx; i < 42; i++) {
            this.ghostPoints[i].visible = false;
        }
    }

    dispose() {
        console.log("DemoScene disposing...");
        this.scene.remove(this.group);
        
        // Clean up all meshes
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) {
                    child.material.forEach(m => m.dispose());
                } else {
                    child.material.dispose();
                }
            }
        });

        this.trails.forEach(t => {
            this.group.remove(t.mesh);
            t.mesh.geometry.dispose();
            t.mesh.material.dispose();
        });
        this.trails = [];
    }
}
