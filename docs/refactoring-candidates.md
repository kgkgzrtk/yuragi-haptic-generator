# リファクタリング候補リスト

## 概要
yuragi-haptic-generatorプロダクションシステムのコード品質調査により特定されたリファクタリング候補の一覧です。

## 1. ログ出力の統一化

### 対象箇所
- **Backend**: `controller.py` - print文が7箇所
  - [line 79](yuragi-haptic-generator/backend/src/haptic_system/controller.py:79): デバイス接続エラー
  - [line 100](yuragi-haptic-generator/backend/src/haptic_system/controller.py:100): 利用可能デバイス数
  - [line 106](yuragi-haptic-generator/backend/src/haptic_system/controller.py:106): デフォルトデバイス情報
  - [line 131](yuragi-haptic-generator/backend/src/haptic_system/controller.py:131): 4chデバイス検出
  - [line 143](yuragi-haptic-generator/backend/src/haptic_system/controller.py:143): 2chデバイス検出
  - [line 180](yuragi-haptic-generator/backend/src/haptic_system/controller.py:180): オーディオコールバックステータス
  - [line 202](yuragi-haptic-generator/backend/src/haptic_system/controller.py:202): オーディオコールバックエラー

- **Frontend**: console.log/error/warn使用箇所
  - `App.tsx`: console.error
  - `AccelerationTrajectory.tsx`: console.warn, console.error
  - `queryClient.ts`: console.error
  - `zustandQuerySync.ts`: console.error

### 推奨アクション
- Backend: Python loggingモジュールへの移行
- Frontend: 既存の`logger.ts`ユーティリティの活用

## 2. TypeScript型定義の改善

### 対象箇所
- **ESLint無効化**
  - [.eslintrc.cjs:54](yuragi-haptic-generator/frontend/.eslintrc.cjs:54): `'@typescript-eslint/no-unused-vars': 'off'` // TODO: Enable after refactoring
  - [.eslintrc.cjs:72](yuragi-haptic-generator/frontend/.eslintrc.cjs:72): `'@typescript-eslint/no-explicit-any': 'off'` // TODO: Remove after proper typing

- **any型の使用**
  - `queryClient.ts:95`: onError: (error: any)
  - `zustandQuerySync.ts:237`: handleStreamingError: (error: any) ※Streaming廃止で削除対象
  - `zustandQuerySync.ts:252`: handleConnectionError: (error: any)
  - `useStreamingQuery.ts`: 複数箇所でerror: any ※Streaming廃止で削除対象

### 推奨アクション
- 具体的なエラー型の定義（APIError, WebSocketError等）
- ESLintルールの段階的な有効化

## 3. TODOコメントの解決

### 対象箇所
- `queryClient.ts:96`: // TODO: Integrate with toast notification system

### 推奨アクション
- 既存のnotificationManagerとの統合実装

## 4. HTMLクラス名の重複

### 対象箇所
- `DeviceWarningDialog.tsx:49`: 重複したclassName属性

### 推奨アクション
- classnames/clsxライブラリを使用した条件付きクラス名の管理

## 5. 長大なメソッドの分割

### 対象箇所
- **Backend**
  - `controller.py:_detect_audio_device()` - 63行の長大なメソッド
  - `main.py:background_waveform_streamer()` - 複雑なWebSocketストリーミングロジック ※Streaming廃止で削除対象

### 推奨アクション
- 責任ごとにメソッドを分割
- デバイス検出ロジックの抽象化

## 6. インポート文の統一

### 対象箇所
- Frontend全体で`@/`絶対パスと`./`相対パスの混在

### 推奨アクション
- プロジェクト全体で一貫したインポートスタイルの採用
- ESLintルールによる自動修正

## 7. エラーハンドリングの改善

### 対象箇所
- **Backend**
  - `controller.py`: 汎用的なException使用
  - `main.py`: 裸のException raise

- **Frontend**
  - 複数箇所でcatch(error)のanyキャッチ

### 推奨アクション
- カスタム例外クラスの定義
- エラー境界の実装
- 構造化されたエラーレスポンス

## 8. テストコードの深いネスト

### 対象箇所
- `error-handling.spec.ts`: 深くネストされた条件分岐

### 推奨アクション
- ヘルパー関数の抽出
- テストユーティリティの強化

## 9. 廃止されたStreaming機能の削除

### 対象箇所
- **Backend**
  - `controller.py`: 
    - is_streaming プロパティ
    - start_streaming() / stop_streaming() メソッド
    - _start_mock_streaming() メソッド
  - `main.py`:
    - /api/streaming/* エンドポイント群
    - background_waveform_streamer() 関数
    - waveform_streaming_task 管理

- **Frontend**
  - `useStreamingQuery.ts`: 全体のファイル
  - `zustandQuerySync.ts`: handleStreamingError メソッド
  - その他streaming関連のコンポーネント・フック
  - `streaming-controls.spec.ts`: E2Eテスト

### 推奨アクション
- Streaming関連のコード・ファイルの完全削除
- 関連するインポート文の削除
- WebSocket通信のリファクタリング（必要な部分のみ残す）

## 優先度評価

### 最高優先度
1. **廃止されたStreaming機能の削除** - 不要なコードの除去とメンテナンス性向上

### 高優先度
2. **ログ出力の統一化** - デバッグとモニタリングに直接影響
3. **TypeScript型定義の改善** - 型安全性とメンテナンス性向上
4. **エラーハンドリングの改善** - システムの堅牢性向上

### 中優先度
5. **長大なメソッドの分割** - コードの可読性向上
6. **インポート文の統一** - 開発体験の向上

### 低優先度
7. **HTMLクラス名の重複** - 機能への影響なし
8. **TODOコメントの解決** - 既存機能は動作中
9. **テストコードの深いネスト** - テスト自体は機能している

## 実装順序の推奨

1. **Phase 0**: Streaming機能の削除（3日）
   - Backend/Frontend全体からStreaming関連コードの削除
   - 関連するテストとドキュメントの更新
   - WebSocket通信の必要部分のみ残す

2. **Phase 1**: ログ出力の統一化（1週間）
   - Backend/Frontendの統一ロギング実装
   - 既存のprint/console文の置き換え

3. **Phase 2**: 型安全性の向上（2週間）
   - エラー型の定義
   - any型の段階的な除去
   - ESLintルールの有効化

4. **Phase 3**: コード構造の改善（2週間）
   - 長大メソッドのリファクタリング
   - エラーハンドリングの統一
   - インポート文の整理

## メトリクス

- 現在のコード品質指標:
  - TypeScript strict mode: 部分的に無効
  - ESLintルール違反: 2つのルールが無効化
  - console文使用: 8箇所
  - print文使用: 7箇所
  - any型使用: 5箇所以上

- 目標指標:
  - TypeScript strict mode: 完全有効
  - ESLintルール違反: 0
  - console/print文: 0（適切なロガー使用）
  - any型使用: 0