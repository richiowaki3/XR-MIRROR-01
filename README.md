# XR MIRROR 01 - Workshop System

このプロジェクトは、MediaPipeとThree.jsを使用した、スタンドアロン型のXR鏡面システムです。
ワークショップの参加者は、このベースアプリを使用して、自分だけの「魔法の鏡」を拡張・実装していきます。

---

## 🎨 ワークショップ参加者への指示書 (Project Brief)

開発を始める前に、以下の**「5つのコンセプト」**を決定してください。

### 1. プロジェクトタイトル (Project Title)
あなたの鏡にはどんな名前を付けますか？（例: "Ghost Mirror", "Future Scanner", "Speed Ribbon"）
- `index.html` の `<h1 id="app-title">` を書き換えてください。

### 2. ビジュアルテーマとカラー (Visual Vibe)
どのような色使いにしますか？
- **基調色 (Accent Color)**: `css/style.css` の `--accent-color` を変更してください。
- **ボーンの色**: あなたのシーン内の `LineMaterial` の `color` を決めてください。

### 3. 身体の「何」を可視化するか (Focus Points)
全てのノードを表示する必要はありません。
- 指の動きだけ？ (Timemachine-Hand)
- 全身の加速度？ (Afterimage)
- 過去や未来の予測？ (Timemachine)
- 特定の部位（鼻や肩）だけ？

### 4. 動きの質感 (Motion Quality)
スムージング（滑らかさ）と遅延のバランスを決めてください。
- `SMOOTHING_FACTOR` を調整します。
  - **0.3**: キビキビ動くが、少し震える。
  - **0.6**: 標準的。
  - **0.9**: 水の中にいるようなヌルヌルした動き。

### 5. 時間の操作 (Time Manipulation)
「過去」や「未来」をどのように表現しますか？
- 何フレーム分遅らせるか (`delayFrames`)。
- 現在と過去をどう結ぶか（ライン？ 粒子？ 軌跡？）。

---

## 🛠 新しいシーンの作り方 (Technical Guide)

1. **テンプレートをコピーする**
   `js/scenes/scene_template.js` をコピーし、`js/scenes/yourname.js` を作成します。

2. **シーンを読み込む**
   `js/main.js` 内の `this.sceneManager.loadScene('./scenes/scene_current.js')` を、作成した自分のファイルパスに書き換えます。

3. **ビジュアルを実装する**
   `init()` 内で3Dオブジェクトを作り、`update()` 内で `data.pose` や `data.hands` を使ってそれらを動かします。

### 💡 重要なロジック
- **`projectToScreen()`**: 実写映像と3Dオブジェクトの位置をピッタリ合わせるための魔法の関数です。必ずこれを通して座標を設定してください。
- **`LineSegments2`**: 太い線（5ptなど）を描画するための特殊なクラスです。

---

## 🚀 起動方法
1. `npm install`
2. `npm run dev`
3. ブラウザで `http://localhost:5173` を開く
