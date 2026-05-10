import * as THREE from 'three';
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js';
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js';
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js';

/**
 * XR MIRROR シーン制作テンプレート
 * 
 * 参加者はこのファイルをコピーして `scene_yourname.js` などと名前を変え、
 * 独自のビジュアルロジックを実装してください。
 */
export default class SceneTemplate {
    constructor({ scene, camera }) {
        this.scene = scene;
        this.camera = camera;
        this.group = new THREE.Group();
        this.scene.add(this.group);

        // --- [参加者が決める設定項目] ---
        this.options = {
            showBody: true,
            showHands: true,
            customEffect: true
        };

        // スムージング係数 (0.0 〜 1.0)
        // 0.1: 生データに近い（ブレるが速い）
        // 0.9: 非常に滑らか（ブレないが遅延する）
        this.SMOOTHING_FACTOR = 0.6; 
        
        // --- [データ保持用] ---
        this.history = [];
        this.smoothedPose = [];
        this.smoothedHands = [];

        this.init();
    }

    /**
     * 初期化: 3Dオブジェクト（メッシュやマテリアル）を生成します
     */
    init() {
        console.log("New Scene Initialized");
        
        // 例: 5pxの太いライン
        const resolution = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this.lineMaterial = new LineMaterial({
            color: 0x00f2ff,
            linewidth: 5,
            resolution: resolution,
            transparent: true,
            opacity: 0.8
        });

        // ここに独自のオブジェクトを追加
    }

    /**
     * UIからのオプション変更を受け取ります
     */
    setOptions(opts) {
        this.options = { ...this.options, ...opts };
    }

    /**
     * 座標補正: 2Dビデオ映像と3Dオブジェクトのズレを無くします
     */
    projectToScreen(x_norm, y_norm, z, scaleX, scaleY) {
        const dist = this.camera ? this.camera.position.z : 3;
        const targetX = x_norm * scaleX;
        const targetY = y_norm * scaleY;
        
        // 遠近法（パース）によるズレを逆算して補正
        const correction = (dist - z) / dist;
        return {
            x: targetX * correction, y: targetY * correction, z: z
        };
    }

    /**
     * 毎フレームの更新処理
     * @param {Object} rawData MediaPipeからの生データ
     * @param {number} scaleX X方向のスケール
     * @param {number} scaleY Y方向のスケール
     */
    update(rawData, scaleX, scaleY) {
        if (!rawData) return;
        const now = performance.now();

        // 解像度更新（太いライン用）
        const res = new THREE.Vector2(window.innerWidth, window.innerHeight);
        this.lineMaterial.resolution.copy(res);

        // スムージング処理
        const data = this.applySmoothing(rawData);

        // --- [ここにビジュアルロジックを記述] ---
        
        // 例: 手首に何かを表示する場合
        if (data.pose && data.pose[15]) {
            const wrist = this.projectToScreen(data.pose[15].x, data.pose[15].y, data.pose[15].z, scaleX, scaleY);
            // wrist.x, wrist.y, wrist.z を使ってオブジェクトを動かす
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
        // (手のスムージングは省略または同様に実装)
        return smoothed;
    }

    dispose() {
        this.scene.remove(this.group);
        // メモリ解放処理
    }
}
