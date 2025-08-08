# MVP実装計画

## 目次
- [1. 概要](#1-概要)
- [2. プロジェクト概要](#2-プロジェクト概要)
- [3. アーキテクチャ設計](#3-アーキテクチャ設計)
- [4. 実装フェーズ](#4-実装フェーズ)
- [5. 技術的決定事項](#5-技術的決定事項)
- [6. リスクと緩和策](#6-リスクと緩和策)
- [7. 成功基準](#7-成功基準)
- [8. スケジュール](#8-スケジュール)

## 更新履歴
| 日付 | バージョン | 更新者 | 更新内容 |
|------|----------|--------|----------|
| 2024-08-04 | 1.0 | - | 初版作成 |

---

## 1. 概要

本計画書は、二軸振動触覚システムのMVP（Minimum Viable Product）実装計画を定義します。
TDDアプローチによる高品質な実装を目指し、5週間での完成を目標とします。

## 2. プロジェクト概要

### 2.1 目的
既存のDualVibrationActuatorシステムを拡張し、のこぎり波による力覚提示機能を実装するMVPを開発する。

### 2.2 スコープ
- **コア機能**: のこぎり波生成（40-120Hz）
- **制御インターフェース**: REST API
- **可視化**: React + react-chartjs-2によるWeb UI
- **性能目標**: レイテンシ10ms以下

## 3. アーキテクチャ設計

### 3.1 プロジェクト構造
```
dual-haptic-generator/
├── mvp/                              # MVP専用ブランチ/フォルダ
│   ├── backend/
│   │   ├── main.py                  # FastAPIエントリポイント
│   │   ├── api/
│   │   │   └── routes.py            # REST APIルート
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── sawtooth_generator.py # のこぎり波生成
│   │   │   └── waveform_manager.py   # 波形管理統合
│   │   ├── models/
│   │   │   └── parameters.py        # Pydanticモデル
│   │   └── actuator/
│   │       └── mvp_actuator.py      # 拡張アクチュエータ
│   ├── frontend/
│   │   ├── src/
│   │   │   ├── App.tsx
│   │   │   ├── components/
│   │   │   │   ├── ControlPanel.tsx
│   │   │   │   └── WaveformChart.tsx
│   │   │   └── hooks/
│   │   │       └── useApi.ts
│   │   └── package.json
│   └── docs/
│       └── mvp_implementation_plan.md
```

### 3.2 システムアーキテクチャ
```
Web UI (React)
    ↓ REST API
FastAPI Server
    ↓ 
Audio Engine (拡張DualVibrationActuator)
    ├── SineWaveGenerator (既存)
    └── SawtoothWaveGenerator (新規)
    ↓
4ch Audio Output
```

## 4. 実装フェーズ

### Phase 1: 基盤整備（1週間）

#### タスクリスト
1. **MVP環境構築**
   - MVPブランチ作成
   - uvとnpmによる依存関係セットアップ
   - 開発環境の構築

2. **既存コードの統合**
   - DualVibrationActuatorクラスをMVPフォルダにコピー
   - 必要なモジュールの選別と移植
   - インターフェース設計

### Phase 2: のこぎり波生成実装（1週間）

#### タスクリスト
1. **SawtoothWaveGeneratorクラス実装**
   ```python
   class SawtoothWaveGenerator(WaveformGenerator):
       def generate_sawtooth(self, t, freq, amp, phase, polarity):
           """上昇/下降のこぎり波生成"""
           wave = amp * (2 * ((freq * t + phase) % 1.0) - 1)
           return wave if polarity else -wave
   ```

2. **WaveformManagerクラス実装**
   - 波形タイプ切り替え機能
   - パラメータ管理
   - 既存FrequencyGeneratorとの統合

3. **MVPActuatorクラス実装**
   - DualVibrationActuatorを継承
   - のこぎり波サポート追加
   - 波形タイプパラメータ対応

### Phase 3: FastAPI Backend実装（1週間）

#### タスクリスト
1. **APIエンドポイント実装**
   ```python
   # パラメータ更新
   PUT /api/parameters
   GET /api/parameters
   
   # 波形データ取得
   POST /api/waveform
   
   # チャンネル個別制御
   PUT /api/channels/{channel_id}
   ```

2. **オーディオエンジン統合**
   - バックグラウンドタスクでのオーディオストリーミング
   - スレッドセーフなパラメータ更新
   - 状態管理の実装

3. **エラーハンドリング**
   - パラメータ検証
   - 例外処理
   - ロギング機能

### Phase 4: React Frontend実装（1週間）

#### タスクリスト
1. **UIコンポーネント開発**
   - ControlPanel（周波数、振幅、位相、極性制御）
   - WaveformChart（4ch波形表示）
   - StatusDisplay（システム状態表示）

2. **API統合**
   - REST APIクライアント実装
   - リアルタイム更新（ポーリング）
   - エラーハンドリング

3. **スタイリング**
   - レスポンシブデザイン
   - ダークモード対応（オプション）

### Phase 5: 統合テストと最適化（1週間）

#### タスクリスト
1. **性能テスト**
   - レイテンシ測定（目標: <10ms）
   - CPU使用率最適化
   - メモリ使用量確認

2. **波形品質検証**
   - THD（全高調波歪み）測定
   - 周波数精度確認
   - 位相同期精度テスト

3. **ドキュメント作成**
   - APIドキュメント
   - セットアップガイド
   - 使用方法説明

## 5. 技術的決定事項

### 5.1 波形生成戦略
- **アプローチ**: 既存アーキテクチャを拡張し、多態性を活用
- **実装**: WaveformGeneratorインターフェースを定義し、Sine/Sawtoothクラスで実装

### 5.2 フィードバック制御
- **MVP段階**: 簡略化したオープンループ制御
- **ドキュメント化**: 完全なフィードバック制御は将来実装として明記
- **基本実装**: 振幅の周波数依存補償のみ実装

### 5.3 FastAPI統合
- **方式**: バックグラウンドタスクでオーディオエンジン実行
- **状態管理**: 依存性注入によるスレッドセーフな共有
- **更新頻度**: REST APIは1-5Hzの更新に対応

### 5.4 プロジェクト構造
- **方針**: MVP専用フォルダで開発
- **統合**: 安定後にメインコードベースへマージ
- **バージョン管理**: 機能ブランチでの開発

## 6. リスクと緩和策

### 6.1 技術的リスク
- **レイテンシ要件（<10ms）**
  - 緩和策: ダブルバッファリング、最適化されたコールバック
  
- **共振問題**
  - 緩和策: 周波数範囲制限、振幅補償テーブル

### 6.2 開発リスク
- **統合の複雑性**
  - 緩和策: 段階的な統合、各フェーズでのテスト

## 7. 成功基準

### 7.1 機能要件
- [ ] 40-120Hzののこぎり波生成
- [ ] 4チャンネル独立制御
- [ ] REST APIによる制御
- [ ] Web UIでの波形可視化

### 7.2 性能要件
- [ ] レイテンシ10ms以下
- [ ] THD 5%以下
- [ ] 安定した長時間動作

## 8. スケジュール

### ガントチャート
```
Week 1: ■■■■■■■■■■ Phase 1: 基盤整備
Week 2: ■■■■■■■■■■ Phase 2: のこぎり波生成
Week 3: ■■■■■■■■■■ Phase 3: FastAPI Backend
Week 4: ■■■■■■■■■■ Phase 4: React Frontend
Week 5: ■■■■■■■■■■ Phase 5: 統合テスト
```

### マイルストーン
1. **Week 1終了**: 開発環境構築完了
2. **Week 2終了**: のこぎり波生成機能完成
3. **Week 3終了**: APIエンドポイント稼働
4. **Week 4終了**: UI完成
5. **Week 5終了**: MVP完成

## 9. 次のステップ

1. **環境構築**: MVPブランチ作成とセットアップ
2. **基本実装**: SawtoothWaveGeneratorクラスの実装開始
3. **プロトタイプ**: 最小限の動作確認用コード作成

この計画に従って、5週間でMVPの完成を目指します。