# Yuragi Haptic Generator API ドキュメント

## 概要

Yuragi Haptic GeneratorはREST APIとWebSocket接続の両方を提供し、触覚デバイスのリアルタイム制御と監視を可能にします。APIはFastAPIで構築され、`/docs`で対話的なドキュメントを自動生成します。

## ベースURL

```
http://localhost:8000
```

## 認証

現在、APIは認証を必要としません。本番環境では適切な認証を実装する必要があります。

## REST API エンドポイント

### システムエンドポイント

#### GET /
APIの基本情報を提供するルートエンドポイント

**レスポンス:**
```json
{
  "message": "Yuragi Haptic Generator API",
  "version": "0.1.0",
  "docs": "/docs"
}
```

#### GET /api/health
監視用のヘルスチェックエンドポイント

**レスポンス:**
```json
{
  "status": "healthy"
}
```

### デバイス情報

#### GET /api/device-info
接続された触覚デバイスに関する情報を取得

**レスポンス:**
```json
{
  "available": true,
  "channels": 4,
  "name": "Miraisense Haptics Device",
  "device_mode": "dual"  // "dual" | "single" | "none"
}
```

#### GET /api/debug/devices
利用可能なすべてのオーディオデバイスをリスト（デバッグ用）

**レスポンス:**
```json
[
  {
    "id": 0,
    "name": "Built-in Microphone",
    "channels": 2,
    "default_samplerate": 44100.0,
    "type": "input"
  },
  {
    "id": 1,
    "name": "Miraisense Haptics Device",
    "channels": 4,
    "default_samplerate": 44100.0,
    "type": "output"
  }
]
```

### パラメータ管理

#### GET /api/parameters
すべてのチャンネルの現在のパラメータを取得

**レスポンス:**
```json
{
  "channels": [
    {
      "channelId": 0,
      "frequency": 60.0,
      "amplitude": 0.5,
      "phase": 0.0,
      "polarity": true
    },
    // ... チャンネル 1-3
  ]
}
```

#### PUT /api/parameters
複数チャンネルのパラメータを更新

**リクエストボディ:**
```json
{
  "channels": [
    {
      "channel_id": 0,
      "frequency": 80.0,
      "amplitude": 0.7,
      "phase": 90.0,
      "polarity": false
    }
  ]
}
```

**レスポンス:**
```json
{
  "status": "updated",
  "channels": [/* 更新されたチャンネルデータ */]
}
```

#### PUT /api/channels/{channel_id}
単一チャンネルのパラメータを更新

**パスパラメータ:**
- `channel_id` (整数): チャンネルID (0-3)

**リクエストボディ:**
```json
{
  "frequency": 100.0,
  "amplitude": 0.8,
  "phase": 180.0,
  "polarity": true
}
```

**レスポンス:**
```json
{
  "channel_id": 0,
  "status": "updated"
}
```

### 波形データ

#### POST /api/waveform
可視化用の波形データを取得

**リクエストボディ:**
```json
{
  "duration": 0.1,
  "sample_rate": 44100
}
```

**レスポンス:**
```json
{
  "timestamp": "2025-08-04T12:00:00Z",
  "sample_rate": 44100,
  "channels": [
    {
      "channelId": 0,
      "data": [0.0, 0.1, 0.2, ...]  // サンプルの配列
    },
    // ... チャンネル 1-3
  ]
}
```

### ストリーミング制御

#### POST /api/streaming/start
触覚ストリーミングを開始

**レスポンス:**
```json
{
  "status": "streaming started",
  "is_streaming": true
}
```

#### POST /api/streaming/stop
触覚ストリーミングを停止

**レスポンス:**
```json
{
  "status": "streaming stopped",
  "is_streaming": false
}
```

#### GET /api/streaming/status
現在のストリーミングステータスを取得

**レスポンス:**
```json
{
  "is_streaming": true,
  "sample_rate": 44100,
  "block_size": 512,
  "latency_ms": 11.6
}
```

### ベクトル力覚制御

#### POST /api/vector-force
特定デバイスにベクトル力覚を設定

**リクエストボディ:**
```json
{
  "device_id": 1,      // 1 または 2
  "angle": 45.0,       // 0-360度
  "magnitude": 0.8,    // 0.0-1.0
  "frequency": 60.0    // Hz
}
```

**レスポンス:**
```json
{
  "status": "Vector force applied",
  "device_id": 1,
  "angle": 45.0,
  "magnitude": 0.8
}
```

## WebSocket API

### 接続

WebSocketエンドポイントへの接続:
```
ws://localhost:8000/ws
```

### メッセージタイプ

#### 受信メッセージ（サーバー → クライアント）

##### parameters_update
チャンネルパラメータが更新されたときに送信
```json
{
  "type": "parameters_update",
  "data": {
    "channels": [/* チャンネルデータ */]
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

##### waveform_data
リアルタイム波形データ（ストリーミング中は100ms毎に送信）
```json
{
  "type": "waveform_data",
  "data": {
    "timestamp": "2025-08-04T12:00:00Z",
    "sampleRate": 44100,
    "channels": [
      {
        "channelId": 0,
        "data": [/* 波形サンプル */]
      }
    ]
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

##### status_update
ストリーミングステータスの変更
```json
{
  "type": "status_update",
  "data": {
    "is_streaming": true,
    "sample_rate": 44100,
    "block_size": 512
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

##### error
エラーメッセージ
```json
{
  "type": "error",
  "data": {
    "message": "エラーの説明",
    "code": "ERROR_CODE"
  },
  "timestamp": "2025-08-04T12:00:00Z"
}
```

#### 送信メッセージ（クライアント → サーバー）

現在、WebSocket接続は主に更新の受信用です。制御コマンドはREST API経由で送信してください。

### 接続ライフサイクル

1. **接続**: クライアントが `/ws` に接続
2. **初期ステータス**: サーバーが接続時に現在のステータスを送信
3. **更新**: サーバーがすべての接続クライアントに更新をブロードキャスト
4. **再接続**: クライアントは指数バックオフで自動再接続を実装すべき

### WebSocketクライアント例

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

ws.onopen = () => {
  console.log('触覚システムに接続しました');
};

ws.onmessage = (event) => {
  const message = JSON.parse(event.data);
  
  switch (message.type) {
    case 'waveform_data':
      updateWaveformDisplay(message.data);
      break;
    case 'parameters_update':
      updateControlPanel(message.data);
      break;
    case 'status_update':
      updateStatusIndicator(message.data);
      break;
    case 'error':
      showError(message.data);
      break;
  }
};

ws.onerror = (error) => {
  console.error('WebSocketエラー:', error);
};

ws.onclose = (event) => {
  if (event.code !== 1000) {
    // 正常なクローズでない場合は再接続
    setTimeout(() => reconnect(), 3000);
  }
};
```

## エラーハンドリング

### HTTPステータスコード

- `200`: 成功
- `400`: 不正なリクエスト（無効なパラメータ）
- `404`: 見つかりません
- `500`: 内部サーバーエラー
- `503`: サービス利用不可（コントローラー未初期化）

### エラーレスポンス形式

```json
{
  "detail": "エラーメッセージの説明"
}
```

### 一般的なエラー

1. **無効なチャンネルID**
   - ステータス: 400
   - メッセージ: "Invalid channel ID"
   - 原因: チャンネルIDが0-3の範囲外

2. **サービス未初期化**
   - ステータス: 503
   - メッセージ: "Service not initialized"
   - 原因: 触覚コントローラーが利用不可

3. **無効なパラメータ**
   - ステータス: 422
   - メッセージ: バリデーションエラーの詳細
   - 原因: リクエストボディがスキーマと一致しない

## レート制限

現在、レート制限は実装されていません。本番環境では：
- WebSocketブロードキャスト: 10 Hz (100ms間隔)
- 推奨クライアントポーリング: 最大 20 Hz (50ms間隔)

## ベストプラクティス

1. **パラメータ更新**: 複数チャンネル変更時は `/api/parameters` でバッチ更新を使用
2. **ストリーミング**: 開始前に常にストリーミングステータスを確認
3. **WebSocket**: 指数バックオフで再接続ロジックを実装
4. **エラーハンドリング**: 常に503エラー（サービス利用不可）を処理
5. **リソースクリーンアップ**: アプリケーション終了時にストリーミングを停止

## APIバージョニング

現在のAPIバージョンは `0.1.0` です。将来のバージョンは後方互換性を維持するか、移行ガイドを提供します。

## 対話的ドキュメント

FastAPIは自動的に対話的なドキュメントを提供します：
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

これらのインターフェースを使用して、ブラウザから直接APIエンドポイントをテストできます。