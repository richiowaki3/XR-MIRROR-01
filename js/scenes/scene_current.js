import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

class SpeedTrail {
    constructor(sceneGroup, maxPoints = 30) {
        this.maxPoints = maxPoints;
        this.points = [];
        this.group = sceneGroup;
        this.currentSpeed = 0;
        
        this.geometry = new THREE.BufferGeometry();
        this.vertices = new Float32Array(this.maxPoints * 2 * 3);
        this.colors = new Float32Array(this.maxPoints * 2 * 4);
        
        this.geometry.setAttribute('position', new THREE.BufferAttribute(this.vertices, 3));
        this.geometry.setAttribute('color', new THREE.BufferAttribute(this.colors, 4));
        
        const indices = [];
        for (let i = 0; i < this.maxPoints - 1; i++) {
            const n = i * 2;
            indices.push(n, n+1, n+2);
            indices.push(n+1, n+3, n+2);
        }
        this.geometry.setIndex(indices);
        
        this.material = new THREE.MeshBasicMaterial({
            color: 0x00f2ff,
            transparent: true,
            vertexColors: true,
            side: THREE.DoubleSide,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        
        this.mesh = new THREE.Mesh(this.geometry, this.material);
        this.group.add(this.mesh);
    }

    update(newPos, now) {
        this.points.unshift({ pos: newPos.clone(), time: now });
        if (this.points.length > this.maxPoints) {
            this.points.pop();
        }

        const cameraDir = new THREE.Vector3(0, 0, 1);
        let latestSpeed = 0;

        for (let i = 0; i < this.maxPoints; i++) {
            const vIndex = i * 2 * 3;
            const cIndex = i * 2 * 4;

            if (i < this.points.length) {
                const pt = this.points[i];
                const age = now - pt.time;
                const alpha = Math.max(0, 1.0 - (age / 1000));

                let speed = 0;
                let dir = new THREE.Vector3(0, 1, 0);
                
                if (i > 0) {
                    const prevPt = this.points[i - 1];
                    dir.subVectors(prevPt.pos, pt.pos);
                    speed = dir.length() / ((prevPt.time - pt.time) || 16);
                    if (i === 1) latestSpeed = speed; // Record speed of the leading edge
                    if (dir.lengthSq() > 0.000001) dir.normalize();
                    else dir.set(0, 1, 0);
                }

                const width = 0.02 + Math.min(speed * 2.5, 0.3); 
                const cross = new THREE.Vector3().crossVectors(dir, cameraDir);
                if (cross.lengthSq() > 0.000001) cross.normalize().multiplyScalar(width);
                else cross.set(width, 0, 0);

                const left = pt.pos.clone().add(cross);
                const right = pt.pos.clone().sub(cross);

                this.vertices[vIndex] = left.x; this.vertices[vIndex+1] = left.y; this.vertices[vIndex+2] = left.z;
                this.vertices[vIndex+3] = right.x; this.vertices[vIndex+4] = right.y; this.vertices[vIndex+5] = right.z;

                for(let j=0; j<2; j++) {
                    this.colors[cIndex + j*4 + 0] = 1.0;
                    this.colors[cIndex + j*4 + 1] = 1.0;
                    this.colors[cIndex + j*4 + 2] = 1.0;
                    this.colors[cIndex + j*4 + 3] = alpha;
                }
            } else {
                for(let j=0; j<6; j++) this.vertices[vIndex + j] = 0;
                for(let j=0; j<8; j++) this.colors[cIndex + j] = 0;
            }
        }

        this.currentSpeed = latestSpeed;
        this.geometry.attributes.position.needsUpdate = true;
        this.geometry.attributes.color.needsUpdate = true;
    }

    clear() {
        this.points = [];
        this.currentSpeed = 0;
        this.update(new THREE.Vector3(0,0,0), performance.now());
    }

    dispose() {
        this.group.remove(this.mesh);
        this.geometry.dispose();
        this.material.dispose();
    }
}

export default class SceneCurrent {
    constructor({ scene, camera }) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        this.options = { afterimage: true, timemachine: true, timemachineHand: true, gravitybox: false };

        this.HAND_CONNECTIONS = [
            [0,1,2,3,4], [0,5,6,7,8], [9,10,11,12], [13,14,15,16], [17,18,19,20], [0,17], [5,9], [9,13], [13,17]
        ];
        
        this.POSE_CONNECTIONS = [
            [0,1], [1,2], [2,3], [3,7], // Right eye
            [0,4], [4,5], [5,6], [6,8], // Left eye
            [9,10], // Mouth
            [11,12], [11,23], [12,24], [23,24], // Torso
            [12,14], [14,16], [16,18], [16,20], [16,22], [18,20], // Right Arm
            [11,13], [13,15], [15,17], [15,19], [15,21], [17,19], // Left Arm
            [24,26], [26,28], [28,30], [28,32], [30,32], // Right Leg
            [23,25], [25,27], [27,29], [27,31], [29,31]  // Left Leg
        ];

        this.history = [];
        this.delayFrames = 30;

        this.smoothedPose = [];
        this.smoothedHands = [];
        this.SMOOTHING_FACTOR = 0.6; 

        this.leftTrail = new SpeedTrail(this.group, 40);
        this.rightTrail = new SpeedTrail(this.group, 40);

        // Gravitybox variables
        this.cubes = [];
        this.gravity = -0.015;
        this.floorY = -2.5;
        this.rightTriggered = false;
        this.leftTriggered = false;

        this.init();
        this.initAudio();
    }

    setOptions(opts) {
        this.options = { ...this.options, ...opts };
    }

    initAudio() {
        // Web Audio API Context (Started on user interaction)
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.audioCtx = new AudioContext();

        // 1. White Noise Generator for Afterimage
        const bufferSize = this.audioCtx.sampleRate * 2; // 2 seconds of noise
        const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }

        // Left Speaker Node
        this.leftNoiseSource = this.audioCtx.createBufferSource();
        this.leftNoiseSource.buffer = noiseBuffer;
        this.leftNoiseSource.loop = true;
        this.leftNoisePanner = this.audioCtx.createStereoPanner();
        this.leftNoisePanner.pan.value = -1; // Left
        this.leftNoiseGain = this.audioCtx.createGain();
        this.leftNoiseGain.gain.value = 0;
        this.leftNoiseSource.connect(this.leftNoiseGain).connect(this.leftNoisePanner).connect(this.audioCtx.destination);
        this.leftNoiseSource.start();

        // Right Speaker Node
        this.rightNoiseSource = this.audioCtx.createBufferSource();
        this.rightNoiseSource.buffer = noiseBuffer;
        this.rightNoiseSource.loop = true;
        this.rightNoisePanner = this.audioCtx.createStereoPanner();
        this.rightNoisePanner.pan.value = 1; // Right
        this.rightNoiseGain = this.audioCtx.createGain();
        this.rightNoiseGain.gain.value = 0;
        this.rightNoiseSource.connect(this.rightNoiseGain).connect(this.rightNoisePanner).connect(this.audioCtx.destination);
        this.rightNoiseSource.start();
        
        // Master Gain for Gravity Box
        this.gbMasterGain = this.audioCtx.createGain();
        this.gbMasterGain.gain.value = 0.3;
        this.gbMasterGain.connect(this.audioCtx.destination);
    }

    playGravityBoxSound(type) {
        if (!this.audioCtx) return;
        if (this.audioCtx.state === 'suspended') this.audioCtx.resume();

        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        
        osc.connect(gain);
        gain.connect(this.gbMasterGain);

        const now = this.audioCtx.currentTime;

        if (type === 'spawn') {
            // High pitch sound for falling (800Hz)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(800, now);
            osc.frequency.exponentialRampToValueAtTime(1200, now + 0.1);
            gain.gain.setValueAtTime(1, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2);
            osc.start(now);
            osc.stop(now + 0.2);
        } else if (type === 'pop') {
            // Low pitch sound for expanding (150Hz over 1 second)
            osc.type = 'sine';
            osc.frequency.setValueAtTime(150, now);
            osc.frequency.exponentialRampToValueAtTime(50, now + 1.0);
            gain.gain.setValueAtTime(0.8, now);
            gain.gain.exponentialRampToValueAtTime(0.01, now + 1.0);
            osc.start(now);
            osc.stop(now + 1.0);
        }
    }

    init() {
        const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);

        // --- Timemachine Bones ---
        this.ghostHandBones = [];
        const handBoneMat = new LineMaterial({
            color: 0xffff00, linewidth: 5, resolution: resolution, transparent: true, opacity: 0.8
        });
        
        for (let i = 0; i < 2; i++) {
            const dummyVerts = new Float32Array(48 * 2 * 3);
            const hbGeo = new LineSegmentsGeometry();
            hbGeo.setPositions(dummyVerts);
            
            const hb = new LineSegments2(hbGeo, handBoneMat);
            hb.computeLineDistances();
            hb.visible = false;
            this.group.add(hb);
            this.ghostHandBones.push({ mesh: hb, geo: hbGeo });
        }

        const bodyBoneMat = new LineMaterial({
            color: 0xffff00, linewidth: 5, resolution: resolution, transparent: true, opacity: 0.8
        });
        const bbGeo = new LineSegmentsGeometry();
        bbGeo.setPositions(new Float32Array(this.POSE_CONNECTIONS.length * 2 * 3));
        this.ghostBodyBones = new LineSegments2(bbGeo, bodyBoneMat);
        this.ghostBodyBones.computeLineDistances();
        this.ghostBodyBones.visible = false;
        this.group.add(this.ghostBodyBones);

        const futureBoneMat = new LineMaterial({
            color: 0x00f2ff, linewidth: 5, resolution: resolution, transparent: true, opacity: 0.8
        });
        const fbGeo = new LineSegmentsGeometry();
        fbGeo.setPositions(new Float32Array(this.POSE_CONNECTIONS.length * 2 * 3));
        this.futureBodyBones = new LineSegments2(fbGeo, futureBoneMat);
        this.futureBodyBones.computeLineDistances();
        this.futureBodyBones.visible = false;
        this.group.add(this.futureBodyBones);

        // --- Gravitybox Elements ---
        this.cubeGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
        const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
        const pointLight = new THREE.PointLight(0xffffff, 1);
        pointLight.position.set(5, 5, 5);
        this.group.add(ambientLight, pointLight);
        
        // Tracking nodes for gravitybox interaction
        const nodeGeo = new THREE.SphereGeometry(0.06, 16, 16);
        const nodeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        this.trackingNodes = [];
        for (let i = 0; i < 4; i++) {
            const m = new THREE.Mesh(nodeGeo, nodeMat);
            m.visible = false;
            this.group.add(m);
            this.trackingNodes.push(m);
        }
    }

    spawnCube(scaleX, scaleY) {
        const material = new THREE.MeshStandardMaterial({ 
            color: 0xff69b4, 
            metalness: 0.3, 
            roughness: 0.4,
            transparent: true,
            opacity: 1.0
        });
        const mesh = new THREE.Mesh(this.cubeGeometry, material);
        
        const randomX = (Math.random() - 0.5) * scaleX * 1.5;
        mesh.position.set(randomX, scaleY + 1, 0);
        
        this.group.add(mesh);
        this.cubes.push({
            mesh: mesh,
            velocity: 0,
            isExpanding: false,
            expandStart: 0,
            baseScale: 1
        });
        
        this.playGravityBoxSound('spawn');
    }

    popCube() {
        if (this.cubes.length === 0) return;
        
        const target = this.cubes.find(c => !c.isExpanding);
        if (target) {
            target.isExpanding = true;
            target.expandStart = performance.now();
            this.playGravityBoxSound('pop');
        }
    }

    applySmoothing(data) {
        const smoothed = { pose: [], hands: [] };
        const sf = this.SMOOTHING_FACTOR;

        if (data.pose) {
            data.pose.forEach((lm, i) => {
                if (!this.smoothedPose[i]) this.smoothedPose[i] = { ...lm };
                else {
                    this.smoothedPose[i].x = this.smoothedPose[i].x * sf + lm.x * (1 - sf);
                    this.smoothedPose[i].y = this.smoothedPose[i].y * sf + lm.y * (1 - sf);
                    this.smoothedPose[i].z = this.smoothedPose[i].z * sf + lm.z * (1 - sf);
                    this.smoothedPose[i].visibility = lm.visibility;
                }
                smoothed.pose.push({ ...this.smoothedPose[i] });
            });
        }

        if (data.hands) {
            data.hands.forEach((hand, hIdx) => {
                if (!this.smoothedHands[hIdx]) this.smoothedHands[hIdx] = [];
                const smoothHand = [];
                hand.forEach((lm, i) => {
                    if (!this.smoothedHands[hIdx][i]) this.smoothedHands[hIdx][i] = { ...lm };
                    else {
                        this.smoothedHands[hIdx][i].x = this.smoothedHands[hIdx][i].x * sf + lm.x * (1 - sf);
                        this.smoothedHands[hIdx][i].y = this.smoothedHands[hIdx][i].y * sf + lm.y * (1 - sf);
                        this.smoothedHands[hIdx][i].z = this.smoothedHands[hIdx][i].z * sf + lm.z * (1 - sf);
                    }
                    smoothHand.push({ ...this.smoothedHands[hIdx][i] });
                });
                smoothed.hands.push(smoothHand);
            });
        }

        return smoothed;
    }

    projectToScreen(x_norm, y_norm, z, scaleX, scaleY) {
        const dist = this.camera ? this.camera.position.z : 3;
        const targetX = x_norm * scaleX;
        const targetY = y_norm * scaleY;
        const correction = (dist - z) / dist;
        return { x: targetX * correction, y: targetY * correction, z: z };
    }

    update(rawData, scaleX = 2.0, scaleY = 2.8) {
        if (!rawData) return;
        const now = performance.now();
        this.floorY = -scaleY;

        // Ensure AudioContext is running if suspended
        if (this.audioCtx && this.audioCtx.state === 'suspended') {
            this.audioCtx.resume();
        }

        const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this.ghostHandBones.forEach(hb => hb.mesh.material.resolution.copy(res));
        this.ghostBodyBones.material.resolution.copy(res);
        this.futureBodyBones.material.resolution.copy(res);

        const data = this.applySmoothing(rawData);

        this.history.push(JSON.parse(JSON.stringify(data)));
        if (this.history.length > 90) this.history.shift();

        // --- 1. Update Afterimage Trails & Audio (Wrists 15, 16) ---
        if (this.options.afterimage && data.pose) {
            // Left Wrist (15) - Mapped to Left Speaker
            if (data.pose[15] && data.pose[15].visibility > 0.5) {
                const p = this.projectToScreen(data.pose[15].x, data.pose[15].y, data.pose[15].z, scaleX, scaleY);
                this.leftTrail.update(new THREE.Vector3(p.x, p.y, p.z), now);
            } else {
                this.leftTrail.clear();
            }
            
            // Right Wrist (16) - Mapped to Right Speaker
            if (data.pose[16] && data.pose[16].visibility > 0.5) {
                const p = this.projectToScreen(data.pose[16].x, data.pose[16].y, data.pose[16].z, scaleX, scaleY);
                this.rightTrail.update(new THREE.Vector3(p.x, p.y, p.z), now);
            } else {
                this.rightTrail.clear();
            }

            // Update Audio Volumes based on Speed
            if (this.audioCtx) {
                // Adjust multiplier to fine-tune sensitivity
                const sensitivity = 8.0; 
                let leftVol = Math.min(this.leftTrail.currentSpeed * sensitivity, 1.0);
                let rightVol = Math.min(this.rightTrail.currentSpeed * sensitivity, 1.0);
                
                // Noise gate (silence when moving very slowly)
                if (leftVol < 0.05) leftVol = 0;
                if (rightVol < 0.05) rightVol = 0;

                this.leftNoiseGain.gain.setTargetAtTime(leftVol * 0.3, this.audioCtx.currentTime, 0.1);
                this.rightNoiseGain.gain.setTargetAtTime(rightVol * 0.3, this.audioCtx.currentTime, 0.1);
            }
        } else {
            this.leftTrail.clear();
            this.rightTrail.clear();
            if (this.audioCtx) {
                this.leftNoiseGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
                this.rightNoiseGain.gain.setTargetAtTime(0, this.audioCtx.currentTime, 0.1);
            }
        }

        // --- 2. Timemachine Logic ---
        if (this.options.timemachine && this.history.length > this.delayFrames) {
            const pastData = this.history[this.history.length - 1 - this.delayFrames];
            
            if (pastData.pose && data.pose) {
                const bodyVerts = [];
                const futureVerts = [];

                this.POSE_CONNECTIONS.forEach(conn => {
                    const p1_past_raw = pastData.pose[conn[0]];
                    const p2_past_raw = pastData.pose[conn[1]];
                    const p1_cur_raw = data.pose[conn[0]];
                    const p2_cur_raw = data.pose[conn[1]];

                    if (p1_past_raw && p2_past_raw && p1_past_raw.visibility > 0.5 && p2_past_raw.visibility > 0.5) {
                        const p1_past = this.projectToScreen(p1_past_raw.x, p1_past_raw.y, p1_past_raw.z, scaleX, scaleY);
                        const p2_past = this.projectToScreen(p2_past_raw.x, p2_past_raw.y, p2_past_raw.z, scaleX, scaleY);
                        
                        bodyVerts.push(p1_past.x, p1_past.y, p1_past.z);
                        bodyVerts.push(p2_past.x, p2_past.y, p2_past.z);

                        if (p1_cur_raw && p2_cur_raw && p1_cur_raw.visibility > 0.5 && p2_cur_raw.visibility > 0.5) {
                            const p1_cur = this.projectToScreen(p1_cur_raw.x, p1_cur_raw.y, p1_cur_raw.z, scaleX, scaleY);
                            const p2_cur = this.projectToScreen(p2_cur_raw.x, p2_cur_raw.y, p2_cur_raw.z, scaleX, scaleY);

                            const p1_fut = {
                                x: p1_cur.x + (p1_cur.x - p1_past.x), y: p1_cur.y + (p1_cur.y - p1_past.y), z: p1_cur.z + (p1_cur.z - p1_past.z)
                            };
                            const p2_fut = {
                                x: p2_cur.x + (p2_cur.x - p2_past.x), y: p2_cur.y + (p2_cur.y - p2_past.y), z: p2_cur.z + (p2_cur.z - p2_past.z)
                            };

                            futureVerts.push(p1_fut.x, p1_fut.y, p1_fut.z);
                            futureVerts.push(p2_fut.x, p2_fut.y, p2_fut.z);
                        }
                    }
                });
                
                if (bodyVerts.length > 0) {
                    this.ghostBodyBones.geometry.setPositions(bodyVerts);
                    this.ghostBodyBones.computeLineDistances();
                    this.ghostBodyBones.visible = true;
                } else { this.ghostBodyBones.visible = false; }

                if (futureVerts.length > 0) {
                    this.futureBodyBones.geometry.setPositions(futureVerts);
                    this.futureBodyBones.computeLineDistances();
                    this.futureBodyBones.visible = true;
                } else { this.futureBodyBones.visible = false; }
            } else {
                this.ghostBodyBones.visible = false;
                this.futureBodyBones.visible = false;
            }
        } else {
            this.ghostBodyBones.visible = false;
            this.futureBodyBones.visible = false;
        }

        // --- 3. Timemachine-Hand Logic ---
        if (this.options.timemachineHand && this.history.length > this.delayFrames) {
            const pastData = this.history[this.history.length - 1 - this.delayFrames];
            if (pastData.hands && pastData.hands.length > 0) {
                pastData.hands.forEach((hand, idx) => {
                    if (idx < 2) {
                        const boneVerts = [];
                        this.HAND_CONNECTIONS.forEach(conn => {
                            for(let i=0; i<conn.length-1; i++) {
                                const p1_raw = hand[conn[i]];
                                const p2_raw = hand[conn[i+1]];
                                const p1 = this.projectToScreen(p1_raw.x, p1_raw.y, p1_raw.z, scaleX, scaleY);
                                const p2 = this.projectToScreen(p2_raw.x, p2_raw.y, p2_raw.z, scaleX, scaleY);
                                boneVerts.push(p1.x, p1.y, p1.z);
                                boneVerts.push(p2.x, p2.y, p2.z);
                            }
                        });
                        if (boneVerts.length > 0) {
                            this.ghostHandBones[idx].geo.setPositions(boneVerts);
                            this.ghostHandBones[idx].mesh.computeLineDistances();
                            this.ghostHandBones[idx].mesh.visible = true;
                        } else { this.ghostHandBones[idx].mesh.visible = false; }
                    }
                });
                for(let i = pastData.hands.length; i < 2; i++) { this.ghostHandBones[i].mesh.visible = false; }
            } else { this.ghostHandBones.forEach(hb => hb.mesh.visible = false); }
        } else { this.ghostHandBones.forEach(hb => hb.mesh.visible = false); }

        // --- 4. Gravitybox Logic ---
        if (this.options.gravitybox && data.pose) {
            const pose = data.pose;
            const leftShoulder = pose[11];
            const rightShoulder = pose[12];
            const leftWrist = pose[15];
            const rightWrist = pose[16];

            const trackPts = [leftShoulder, rightShoulder, leftWrist, rightWrist];
            trackPts.forEach((lm, i) => {
                if (lm && lm.visibility > 0.5) {
                    const p = this.projectToScreen(lm.x, lm.y, lm.z, scaleX, scaleY);
                    this.trackingNodes[i].position.set(p.x, p.y, p.z);
                    this.trackingNodes[i].visible = true;
                } else {
                    this.trackingNodes[i].visible = false;
                }
            });

            // Right hand gesture (Spawn)
            if (rightWrist && rightShoulder && rightWrist.visibility > 0.5) {
                const isUp = rightWrist.y > rightShoulder.y + 0.15;
                if (isUp && !this.rightTriggered) {
                    this.spawnCube(scaleX, scaleY);
                    this.rightTriggered = true;
                } else if (!isUp) {
                    this.rightTriggered = false;
                }
            }

            // Left hand gesture (Pop)
            if (leftWrist && leftShoulder && leftWrist.visibility > 0.5) {
                const isUp = leftWrist.y > leftShoulder.y + 0.15;
                if (isUp && !this.leftTriggered) {
                    this.popCube();
                    this.leftTriggered = true;
                } else if (!isUp) {
                    this.leftTriggered = false;
                }
            }

            for (let i = this.cubes.length - 1; i >= 0; i--) {
                const c = this.cubes[i];
                if (c.isExpanding) {
                    const elapsed = now - c.expandStart;
                    const progress = Math.min(elapsed / 1000, 1);
                    const scale = 1 + progress * 9;
                    c.mesh.scale.set(scale, scale, scale);
                    c.mesh.material.opacity = 1 - progress;
                    if (progress >= 1) {
                        this.group.remove(c.mesh);
                        c.mesh.material.dispose();
                        this.cubes.splice(i, 1);
                    }
                } else {
                    c.velocity += this.gravity;
                    c.mesh.position.y += c.velocity;
                    if (c.mesh.position.y < this.floorY + 0.15) {
                        c.mesh.position.y = this.floorY + 0.15;
                        c.velocity *= -0.4;
                    }
                }
            }
        } else {
            // Hide tracking nodes if gravitybox is off
            this.trackingNodes.forEach(n => n.visible = false);
        }
    }

    dispose() {
        if (this.audioCtx) {
            this.audioCtx.close();
        }
        this.leftTrail.dispose();
        this.rightTrail.dispose();
        this.scene.remove(this.group);
        this.group.traverse(child => {
            if (child.geometry) child.geometry.dispose();
            if (child.material) {
                if (Array.isArray(child.material)) child.material.forEach(m => m.dispose());
                else child.material.dispose();
            }
        });
        this.cubes.forEach(c => {
            if (c.mesh.material) c.mesh.material.dispose();
        });
    }
}
