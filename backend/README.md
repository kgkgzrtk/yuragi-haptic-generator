# 二軸振動触覚システム MVP Backend

## 概要

本プロジェクトは、サwtooth波による革新的な力覚提示を実現する二軸振動触覚システムのMVPバックエンド実装です。
TDD（Test-Driven Development）アプローチにより、高品質で信頼性の高いコードベースを構築しています。

## 主な機能

- 🌊 **サwtooth波生成**: 40-120Hz範囲での精密な波形生成
- 🎛️ **4チャンネル独立制御**: 2つの2軸アクチュエータを完全制御
- 🎯 **ベクトル力覚生成**: X/Y軸協調による任意方向の力覚提示
- 🔄 **リアルタイム更新**: WebSocketによる即座のパラメータ反映
- 📊 **レイテンシ測定**: 10ms以下の低遅延を実現
- 🌐 **WebSocket通信**: 100ms間隔での波形データストリーミング
- 📡 **マルチクライアント**: 複数接続の同時ブロードキャスト対応

## アーキテクチャ

```
haptic_system/
├── waveform.py      # サwtooth波形生成
├── channel.py       # 単一チャンネル管理
├── device.py        # 4チャンネル統合管理
└── controller.py    # ストリーミング制御
```

## インストール

### 依存関係

```bash
# 仮想環境の作成（推奨）
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# 依存関係のインストール
pip install -r requirements.txt
```

### 必要なパッケージ

- numpy >= 1.24.0
- sounddevice >= 0.4.6
- pytest >= 7.4.0 (開発用)
- pytest-cov >= 4.1.0 (開発用)

## 使用方法

### 基本的な使用例

```python
from haptic_system.controller import HapticController

# コントローラーの初期化
controller = HapticController(sample_rate=44100, block_size=512)

# パラメータ設定
params = {
    "channels": [
        {"channel_id": 0, "frequency": 60, "amplitude": 0.5},
        {"channel_id": 1, "frequency": 60, "amplitude": 0.5},
        {"channel_id": 2, "frequency": 80, "amplitude": 0.3},
        {"channel_id": 3, "frequency": 80, "amplitude": 0.3},
    ]
}

# ストリーミング実行
with controller:
    controller.update_parameters(params)
    time.sleep(10)  # 10秒間実行
```

### ベクトル力覚生成

```python
# 45度方向の力を生成
controller.device.set_vector_force(
    device_id=1,    # デバイス1を使用
    angle=45,       # 45度方向
    magnitude=0.8,  # 強度80%
    frequency=60    # 60Hz
)
```

## テスト

### ユニットテストの実行

```bash
# すべてのテストを実行
python -m pytest tests/unit -v

# カバレッジレポート付き
python -m pytest tests/unit --cov=haptic_system --cov-report=html

# 特定のテストのみ
python -m pytest tests/unit/test_waveform.py -v
```

### 現在のテスト統計

- テストケース数: 35個
- テストカバレッジ: 95.53%
- すべてのテスト: ✅ PASSED

## API仕様

### HapticController

```python
# 初期化
controller = HapticController(sample_rate=44100, block_size=512)

# メソッド
controller.start_streaming()           # ストリーミング開始
controller.stop_streaming()            # ストリーミング停止
controller.update_parameters(params)   # パラメータ更新
controller.get_current_parameters()    # 現在のパラメータ取得
controller.get_status()               # システム状態取得
controller.get_latency_ms()           # レイテンシ取得
```

### WebSocket API

#### WebSocket接続
```python
# WebSocketクライアント例（websocket-clientライブラリ使用）
import asyncio
import websockets
import json

async def websocket_client():
    uri = "ws://localhost:8000/ws"
    async with websockets.connect(uri) as websocket:
        while True:
            message = await websocket.recv()
            data = json.loads(message)
            
            if data["type"] == "waveform_data":
                print(f"受信波形データ: {len(data['data']['channels'])}チャンネル")
            elif data["type"] == "parameters_update":
                print(f"パラメータ更新: {data['data']}")
            elif data["type"] == "status_update":
                print(f"ステータス更新: {data['data']}")

# 実行
asyncio.run(websocket_client())
```

#### メッセージタイプ
- `parameters_update`: パラメータ変更時にブロードキャスト
- `waveform_data`: リアルタイム波形データ（100ms間隔）
- `status_update`: ストリーミング状態変更時
- `error`: エラー発生時

### パラメータ形式

```python
{
    "channels": [
        {
            "channel_id": 0,      # チャンネルID (0-3)
            "frequency": 60.0,    # 周波数 (40-120Hz)
            "amplitude": 0.5,     # 振幅 (0.0-1.0)
            "phase": 0.0,        # 位相 (0-360度)
            "polarity": True     # 極性 (True=上昇, False=下降)
        },
        # ... 他のチャンネル
    ]
}
```

## 開発

### TDDアプローチ

本プロジェクトはt_wadaスタイルのTDDで開発されています：

1. **Red**: 失敗するテストを書く
2. **Green**: テストを通す最小限の実装
3. **Refactor**: コードの改善

### プロジェクト構造

```
mvp/backend/
├── src/
│   └── haptic_system/    # メインパッケージ
├── tests/
│   └── unit/            # ユニットテスト
├── example_usage.py     # 使用例
├── requirements.txt     # 依存関係
└── pyproject.toml      # プロジェクト設定
```

## トラブルシューティング

### sounddeviceエラー
```
ModuleNotFoundError: No module named 'sounddevice'
```
→ `pip install sounddevice`を実行

### オーディオデバイスが見つからない
```python
import sounddevice as sd
print(sd.query_devices())  # 利用可能なデバイスを確認
```

### device1/device2から出力がない場合のデバッグ方法

#### 1. デバッグモードで起動
```bash
# 環境変数を設定してデバッグモードで起動
DEBUG=true LOG_LEVEL=DEBUG uvicorn src.main:app --reload --host 0.0.0.0 --port 8000

# または
export DEBUG=true
export LOG_LEVEL=DEBUG
uvicorn src.main:app --reload
```

#### 2. デバイス情報の確認
```bash
# 接続されているオーディオデバイスの詳細を確認
curl http://localhost:8000/api/debug/devices

# 現在選択されているデバイス情報を確認
curl http://localhost:8000/api/device-info
```

#### 3. デバッグログの確認ポイント

**起動時のログを確認:**
```
INFO: Initializing with haptic device: Miraisense Haptics (channels: 4)
INFO: Available audio devices:
INFO:   [0] Built-in Microphone (input, 2ch)
INFO:   [1] Built-in Output (output, 2ch)
INFO:   [2] Miraisense Haptics (output, 4ch) <- 選択されたデバイス
```

**device2 (チャンネル3-4) が動作しない場合:**
- 2チャンネルデバイスが選択されている可能性があります
- `Available channels: 2` と表示される場合、device2は使用できません
- 4チャンネルデバイスを接続し、再起動してください

#### 4. ストリーミング状態の確認
```bash
# ストリーミング状態を確認
curl http://localhost:8000/api/streaming/status

# ストリーミングを開始（必須）
curl -X POST http://localhost:8000/api/streaming/start

# device1をテスト
curl -X POST http://localhost:8000/api/vector-force \
  -H "Content-Type: application/json" \
  -d '{"device_id": 1, "angle": 0, "magnitude": 0.8, "frequency": 60}'

# device2をテスト（4チャンネルデバイスのみ）
curl -X POST http://localhost:8000/api/vector-force \
  -H "Content-Type: application/json" \
  -d '{"device_id": 2, "angle": 90, "magnitude": 0.8, "frequency": 80}'
```

#### 5. よくある問題と解決方法

**問題: "Streaming is not started" エラー**
```bash
# 解決: ストリーミングを開始する
curl -X POST http://localhost:8000/api/streaming/start
```

**問題: "Device2 (channels 3-4) is not available" エラー**
- 原因: 2チャンネルデバイスが選択されている
- 解決: 
  1. 4チャンネル対応デバイス（Miraisense Haptics等）を接続
  2. システムのデフォルトオーディオ出力を変更
  3. アプリケーションを再起動

**問題: device1/device2両方から出力がない**
1. パラメータを確認:
   ```bash
   curl http://localhost:8000/api/parameters
   ```
2. 振幅が0になっていないか確認
3. 周波数が適切な範囲（40-120Hz）か確認
4. デバイスの電源・接続を確認

#### 6. 詳細なデバッグ情報の取得
```python
# Pythonスクリプトでデバイス情報を詳細に確認
import sounddevice as sd

# すべてのデバイスを表示
devices = sd.query_devices()
for i, device in enumerate(devices):
    print(f"[{i}] {device['name']}")
    print(f"    Channels: in={device['max_input_channels']}, out={device['max_output_channels']}")
    print(f"    Default: {device['default_samplerate']}Hz")
    
# デフォルトデバイスを確認
print(f"\nDefault output device: {sd.default.device[1]}")
```

## ライセンス

[ライセンス情報を追加]

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずイシューを作成して変更内容を議論してください。

## 参考資料

- [TDD開発レポート](TDD_DEVELOPMENT_REPORT.md)
- [プロジェクトドキュメント](../../docs/)