import * as THREE from 'three';

export default class BaseScene {
    constructor({ scene }) {
        this.scene = scene;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.posePoints = [];
        this.handPoints = [];

        this.init();
    }

    init() {
        const geometry = new THREE.SphereGeometry(0.02, 8, 8);
        const material = new THREE.MeshBasicMaterial({ color: 0x00f2ff });

        // Pre-create some points for pose (33 landmarks)
        for (let i = 0; i < 33; i++) {
            const sphere = new THREE.Mesh(geometry, material);
            sphere.visible = false;
            this.group.add(sphere);
            this.posePoints.push(sphere);
        }

        // Pre-create points for 2 hands (21 landmarks each)
        for (let i = 0; i < 42; i++) {
            const sphere = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color: 0xffffff }));
            sphere.visible = false;
            this.group.add(sphere);
            this.handPoints.push(sphere);
        }
    }

    update(data) {
        if (!data) return;

        // Update Pose
        if (data.pose) {
            data.pose.forEach((lm, i) => {
                if (this.posePoints[i]) {
                    this.posePoints[i].position.set(lm.x * 2, lm.y * 2, lm.z);
                    this.posePoints[i].visible = lm.visibility > 0.5;
                }
            });
        }

        // Update Hands
        let handPtIdx = 0;
        data.hands.forEach(hand => {
            hand.forEach(lm => {
                if (this.handPoints[handPtIdx]) {
                    this.handPoints[handPtIdx].position.set(lm.x * 2, lm.y * 2, lm.z);
                    this.handPoints[handPtIdx].visible = true;
                    handPtIdx++;
                }
            });
        });

        // Hide unused hand points
        for (let i = handPtIdx; i < 42; i++) {
            this.handPoints[i].visible = false;
        }
    }

    dispose() {
        this.scene.remove(this.group);
        this.group.children.forEach(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) child.material.dispose();
        });
    }
}
