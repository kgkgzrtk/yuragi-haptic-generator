# ドキュメント総合インデックス

## 📁 ドキュメント構成

本ドキュメントは以下の6つのカテゴリに分類されています：

### 01_project - プロジェクト概要
プロジェクトの全体像と分析結果をまとめています。

- **project_summary.md**: プロジェクトの要約と主要な発見
- **project_analysis.md**: 技術的な詳細分析
- **project_overview_latest.md**: 最新の実装状況とアーキテクチャ

### 02_requirements - 要件定義
システムの要件定義書を管理しています。

- **system_requirements.md**: 正式なシステム要件定義書
- **draft_requirements.md**: ドラフト版要件定義書

### 03_design - 設計書
ソフトウェアの設計ドキュメントです。

- **software_design.md**: 完全版ソフトウェア設計書
- **software_design_mvp.md**: MVP版に特化した設計書

### 04_research - 技術調査
関連技術の調査結果をまとめています。

- **haptic_research.md**: 力覚提示技術の調査結果
- **vca_model_explained.md**: VCAモデルの技術説明
- **pdf_notes.md**: 研究論文からの重要な知見

### 05_testing - テスト関連
テスト戦略と設計を定義しています。

- **tdd_test_design.md**: TDDアプローチによるテスト設計

### 06_implementation - 実装ガイド
実装に関する計画とガイドラインです。

- **mvp_implementation_plan.md**: MVP実装の詳細計画

### 07_implementation - 実装詳細
システムの技術的な実装詳細をまとめています。

- **api_documentation.md**: REST APIとWebSocket APIの詳細仕様
- **waveform_rendering_websocket.md**: 波形レンダリングとWebSocket同期の実装詳細

## 📖 推奨される読み順

1. **初めての方**: project_summary.md → system_requirements.md → software_design_mvp.md
2. **開発者**: tdd_test_design.md → mvp_implementation_plan.md → software_design_mvp.md
3. **研究者**: haptic_research.md → vca_model_explained.md → pdf_notes.md

## 🔄 ドキュメント間の関係

```
project_summary.md → project_overview_latest.md
    ↓
system_requirements.md ← haptic_research.md
    ↓
software_design_mvp.md
    ↓
tdd_test_design.md → mvp_implementation_plan.md
    ↓
api_documentation.md + waveform_rendering_websocket.md
```