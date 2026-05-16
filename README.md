
# XR MIRROR 01 - Workshop System

このプロジェクトは、MediaPipeとThree.jsを使用した、スタンドアロン型のXR鏡面システムです。
そのままでも使用できますが、ワークショップでは、参加者がこのベースアプリをエージェントAIの読み込ませることで、新たな自分だけの「魔法の鏡」を拡張・実装していきます。
以下は見本で入っている４つのシーンを紹介します。

--

デモのsceneの解説

<img width="1080" height="1920" alt="vlcsnap-2026-05-16-09h39m30s347" src="https://github.com/user-attachments/assets/039102e5-dce9-4cc8-ba23-eea31a9b99bc" />

これは手の動きの軌跡を描写し、動きに合わせてホワイトノイズがなるシーンです。
<img width="1080" height="1920" alt="vlcsnap-2026-05-16-09h40m00s353" src="https://github.com/user-attachments/assets/db2e35c9-9f41-48db-9dfe-858cba0245d6" />
timemachine
これは３秒前の自分を黄色の線で、３秒後の自分を予測して青色で表示するシーンです。
<img width="1080" height="1920" alt="vlcsnap-2026-05-16-09h40m38s793" src="https://github.com/user-attachments/assets/74fe2f8b-a8b9-4da5-ad77-df45a5caf09f" />
timemachine hand
これは、３秒前の手の形を表示するシーンです
<img width="1080" height="1920" alt="vlcsnap-2026-05-16-09h41m31s253" src="https://github.com/user-attachments/assets/79286456-03cf-4dfb-ba99-014c1b7be097" />
gravity box
これは、右手を上げると赤いキューブが降ってきて、左手を上げるときゅぶが膨らんで消えるシーンです。
このように、アイデアをすぐに実現できます。

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

## 🚀 アプリのインストールと起動方法

1. 準備：Node.js のインストール
そのPCにまだ入っていない場合は、Node.js公式サイト から LTS版 をインストールしておく必要があります。 https://nodejs.org/ja/download （これがないと npm コマンドが使えません）

2. コードのダウンロード
GitHubのリポジトリ画面から、以下のいずれかを行います。
Gitが使える場合:
ターミナルで `git clone https://github.com/richiowaki3/XR-MIRROR-01.git`を実行。
Gitがない場合:
緑色の「<> Code」ボタンをクリックして「Download ZIP」を選び、右クリックして「すべて展開（解凍）」解凍します。
<img width="1086" height="934" alt="スクリーンショット 2026-05-14 060815" src="https://github.com/user-attachments/assets/e7ac6e3e-9c47-46fb-bae1-64367fd03924" />

4. ライブラリの復元（超重要）
解凍したフォルダの中でターミナル（WindowsならPowerShellやコマンドプロンプト）を開き、まず以下のフォルダーの場所に移動`cd C:\自分のコンピュータの保存した場所\XR-MIRROR-01-main`以下の後、以下のコマンドを打ちます。

`npm install`

※ GitHubには重たいライブラリ群（node_modules）はアップロードしていないため、このコマンドで**「設計図（package.json）」を元に、そのPCにライブラリを再構築**します。

4. 起動
最後に、いつものコマンドで開発サーバーを立ち上げます。

`npm run dev`

ターミナルに表示された`http://localhost:5173`をブラウザで開けば起動完了です！
<img width="1080" height="1920" alt="vlcsnap-2026-05-16-09h39m47s384" src="https://github.com/user-attachments/assets/ec9ffb4c-5ee7-4dfc-b803-d495f3720bc5" />
はじめ以上のような画面になり、４つのでもシーンが選べます。シーンのスイッチをオンにしてスタートボタンを押すとエフェクトがかかったシーンが始まります。別のシーンにしたいときは、アドレス横の丸矢印を押してさいよみこみします。
もしもシーンが表示されないときのトラブルとして、インターネットにつながっていないことがあります。これは、人型をコンピュータが認識するために一度インターネットを読みに行くからです。
