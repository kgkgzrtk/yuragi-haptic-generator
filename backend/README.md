# 二軸振動触覚システム MVP Backend

## 概要

本プロジェクトは、サwtooth波による革新的な力覚提示を実現する二軸振動触覚システムのMVPバックエンド実装です。
TDD（Test-Driven Development）アプローチにより、高品質で信頼性の高いコードベースを構築しています。

## 主な機能

- 🌊 **サwtooth波生成**: 40-120Hz範囲での精密な波形生成
- 🎛️ **4チャンネル独立制御**: 2つの2軸アクチュエータを完全制御
- 🎯 **ベクトル力覚生成**: X/Y軸協調による任意方向の力覚提示
- 🔄 **リアルタイム更新**: スレッドセーフなパラメータ変更
- 📊 **レイテンシ測定**: 10ms以下の低遅延を実現

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

## ライセンス

[ライセンス情報を追加]

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずイシューを作成して変更内容を議論してください。

## 参考資料

- [TDD開発レポート](TDD_DEVELOPMENT_REPORT.md)
- [プロジェクトドキュメント](../../docs/)