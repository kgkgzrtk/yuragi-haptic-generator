# Yuragi Haptic Generator

革新的なのこぎり波による力覚提示を実現する二軸振動触覚システム

## 概要

Yuragi Haptic Generatorは、のこぎり波を用いた非対称振動により、従来の振動触覚デバイスでは実現困難だった方向性のある力覚を提示するシステムです。40-120Hzの周波数範囲で精密な制御を行い、X/Y軸の協調動作により任意方向の力覚を生成します。

### 主な特徴

- 🌊 **のこぎり波生成**: 時間比1:8の非対称振動による効果的な力覚提示
- 🎯 **ベクトル力覚**: X/Y軸協調による360度任意方向の力生成
- 💆 **YURAGIマッサージ機能**: 円運動と振幅変調によるリラクゼーション効果
- 🎛️ **4チャンネル独立制御**: 2つの2軸アクチュエータを完全制御
- ⚡ **低レイテンシ**: 10ms以下の応答性を実現
- 🔧 **REST API**: FastAPIによる高性能API
- 📊 **リアルタイム可視化**: React + Chart.jsによる波形表示
- 🔬 **物理モデル**: 360Hz共振周波数の2次共振器フィルタ実装

## システム構成

```
yuragi-haptic-generator/
├── backend/              # FastAPI バックエンド
│   ├── src/             # ソースコード
│   │   ├── api/         # REST APIエンドポイント
│   │   └── haptic_system/  # コア触覚システム
│   └── tests/           # テストスイート
├── frontend/            # React フロントエンド
│   ├── public/          # 静的ファイル
│   └── src/            # ソースコード
└── docs/               # プロジェクトドキュメント
```

## クイックスタート

### 必要条件

- Python 3.12以上
- Node.js 16以上
- pnpm 9.0以上（フロントエンド用）
- Miraisense Hapticsデバイス（または互換4チャンネルオーディオデバイス）

### インストール

```bash
# リポジトリのクローン
git clone https://github.com/your-org/yuragi-haptic-generator.git
cd yuragi-haptic-generator

# uvのインストール（未インストールの場合）
curl -LsSf https://astral.sh/uv/install.sh | sh

# Python仮想環境と依存関係のインストール
uv venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
uv pip install -e .

# 開発用依存関係を含める場合
uv pip install -e ".[dev,test]"
```

### バックエンドの起動

```bash
cd backend

# 依存関係のインストール
uv pip install -e ".[dev,api]"

# サーバーの起動
uv run uvicorn src.main:app --reload
```

**APIドキュメント**: http://localhost:8000/docs

### フロントエンドの起動

```bash
# pnpmのインストール（未インストールの場合）
curl -fsSL https://get.pnpm.io/install.sh | sh -

cd frontend
pnpm install
pnpm dev
```

**UI**: http://localhost:3000 （ポートが使用中の場合は3001, 3002...が使用されます）

> **注意**: フロントエンドが3000以外のポートで起動した場合、バックエンドのCORS設定を更新する必要があります：
> ```bash
> # バックエンドを停止してから再起動
> CORS_ORIGINS='["http://localhost:3000","http://localhost:3001","http://localhost:3002","http://localhost:3003","http://localhost:3004","http://localhost:3005"]' uv run uvicorn src.main:app --reload
> ```

## テスト

### ユニットテスト

```bash
# バックエンドテスト
cd backend
uv run pytest

# フロントエンドテスト
cd frontend
pnpm test
```

### E2Eテスト

E2Eテストを実行するには、バックエンドとフロントエンドの両方が必要です：

```bash
# 方法1: テストスクリプトを使用（推奨）
./scripts/run-e2e-tests.sh

# 方法2: Docker Composeを使用
docker compose -f docker-compose.dev.yml up -d
cd frontend && npm run test:e2e
docker compose -f docker-compose.dev.yml down

# 方法3: 手動セットアップ
# ターミナル1でバックエンドを起動
cd backend
PYTHONPATH=src uv run uvicorn src.main:app --host 0.0.0.0 --port 8000

# ターミナル2でE2Eテストを実行
cd frontend
npm run test:e2e
```

詳細は[E2Eテストガイド](frontend/tests/e2e/README.md)を参照してください。

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

# ベクトル力覚設定
curl -X POST "http://localhost:8000/api/vector-force" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": 1,
    "angle": 45,
    "magnitude": 0.8,
    "frequency": 60
  }'

# YURAGIマッサージプリセット
curl -X POST "http://localhost:8000/api/yuragi/preset" \
  -H "Content-Type: application/json" \
  -d '{
    "device_id": 1,
    "preset": "gentle",
    "duration": 60,
    "enabled": true
  }'
```

## 開発

### テストの実行

```bash
# ユニットテスト
uv run pytest backend/tests/unit -v

# カバレッジレポート
uv run pytest backend/tests --cov=haptic_system --cov-report=html

# 統合テスト
uv run pytest backend/tests/integration -v
```

### コード品質

```bash
# フォーマット
uv run black backend/src backend/tests

# リント
uv run flake8 backend/src
uv run mypy backend/src
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

## トラブルシューティング

### device1/device2から出力がない場合

#### デバッグモードで起動
```bash
# 環境変数を設定してデバッグモードで起動
cd backend
DEBUG=true LOG_LEVEL=DEBUG uv run uvicorn src.main:app --reload
```

#### デバイス情報の確認
```bash
# 利用可能なデバイスを確認
curl http://localhost:8000/api/debug/devices

# 現在のデバイス情報を確認
curl http://localhost:8000/api/device-info
```

#### ストリーミングの開始（必須）
```bash
# ストリーミングを開始
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

詳細なデバッグ手順は[backend/README.md](backend/README.md#device1device2から出力がない場合のデバッグ方法)を参照してください。

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