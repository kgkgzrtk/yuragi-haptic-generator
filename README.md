# Yuragi Haptic Generator

革新的なサwtooth波による力覚提示を実現する二軸振動触覚システム

## 概要

Yuragi Haptic Generatorは、サwtooth波を用いた非対称振動により、従来の振動触覚デバイスでは実現困難だった方向性のある力覚を提示するシステムです。40-120Hzの周波数範囲で精密な制御を行い、X/Y軸の協調動作により任意方向の力覚を生成します。

### 主な特徴

- 🌊 **サwtooth波生成**: 時間比1:8の非対称振動による効果的な力覚提示
- 🎯 **ベクトル力覚**: X/Y軸協調による360度任意方向の力生成
- 🎛️ **4チャンネル独立制御**: 2つの2軸アクチュエータを完全制御
- ⚡ **低レイテンシ**: 10ms以下の応答性を実現
- 🔧 **REST API**: FastAPIによる簡単な統合
- 📊 **リアルタイム可視化**: React + Chart.jsによる波形表示

## システム構成

```
yuragi-haptic-generator/
├── backend/              # FastAPI バックエンド
│   ├── src/             # ソースコード
│   │   ├── api/         # REST APIエンドポイント
│   │   └── haptic_system/  # コア触覚システム
│   └── tests/           # テストスイート
├── frontend/            # React フロントエンド
│   ├── public/         
│   └── src/            
└── docs/               # プロジェクトドキュメント
```

## クイックスタート

### 必要条件

- Python 3.9以上
- Node.js 16以上
- Miraisense Hapticsデバイス（または互換4チャンネルオーディオデバイス）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-org/yuragi-haptic-generator.git
cd yuragi-haptic-generator

# Python依存関係のインストール
pip install -e .

# 開発用依存関係を含める場合
pip install -e ".[dev,test]"
```

### バックエンドの起動

```bash
cd backend
uvicorn src.main:app --reload
```

APIドキュメント: http://localhost:8000/docs

### フロントエンドの起動

```bash
cd frontend
npm install
npm start
```

UI: http://localhost:3000

## 使用例

### Python API

```python
from haptic_system.controller import HapticController

# コントローラーの初期化
controller = HapticController(sample_rate=44100, block_size=512)

# ベクトル力覚の生成
with controller:
    controller.device.set_vector_force(
        device_id=1,     # デバイス1を使用
        angle=45,        # 45度方向
        magnitude=0.8,   # 強度80%
        frequency=60     # 60Hz
    )
    time.sleep(5)    # 5秒間実行
```

### REST API

```bash
# パラメータ設定
curl -X PUT "http://localhost:8000/api/parameters" \
  -H "Content-Type: application/json" \
  -d '{
    "channels": [
      {"channel_id": 0, "frequency": 60, "amplitude": 0.5},
      {"channel_id": 1, "frequency": 60, "amplitude": 0.5}
    ]
  }'

# ストリーミング開始
curl -X POST "http://localhost:8000/api/streaming/start"
```

## 開発

### テストの実行

```bash
# ユニットテスト
pytest backend/tests/unit -v

# カバレッジレポート
pytest backend/tests --cov=haptic_system --cov-report=html

# 統合テスト
pytest backend/tests/integration -v
```

### コード品質

```bash
# フォーマット
black backend/src backend/tests

# リント
flake8 backend/src
mypy backend/src
```

## アーキテクチャ

### コアコンポーネント

1. **SawtoothWaveform**: サwtooth波形生成エンジン
2. **HapticChannel**: 単一チャンネル管理
3. **HapticDevice**: 4チャンネル統合制御
4. **HapticController**: ストリーミング管理

### 技術仕様

- **周波数範囲**: 40-120Hz（推奨: 60-120Hz）
- **サンプリングレート**: 44100Hz
- **ブロックサイズ**: 512サンプル
- **レイテンシ目標**: <10ms
- **チャンネル数**: 4（2デバイス × 2軸）

## ドキュメント

詳細なドキュメントは[docs/](docs/)ディレクトリを参照してください：

- [プロジェクト概要](docs/01_project/project_summary.md)
- [システム要件定義](docs/02_requirements/system_requirements.md)
- [ソフトウェア設計](docs/03_design/software_design_mvp.md)
- [TDD開発レポート](backend/TDD_DEVELOPMENT_REPORT.md)

## 貢献

プルリクエストを歓迎します。大きな変更の場合は、まずイシューを作成して変更内容を議論してください。

1. フォークする
2. フィーチャーブランチを作成 (`git checkout -b feature/amazing-feature`)
3. 変更をコミット (`git commit -m 'Add amazing feature'`)
4. ブランチにプッシュ (`git push origin feature/amazing-feature`)
5. プルリクエストを作成

## ライセンス

MIT License - 詳細は[LICENSE](LICENSE)を参照してください。

## 謝辞

- 振動触覚研究の先駆者の皆様
- TDD実践コミュニティ
- オープンソースコントリビューター

## お問い合わせ

- Issue: [GitHub Issues](https://github.com/your-org/yuragi-haptic-generator/issues)
- Email: team@example.com