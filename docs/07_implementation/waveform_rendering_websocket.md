# 波形レンダリングとWebSocket同期

## 概要

本ドキュメントでは、Yuragi Haptic Generatorにおけるリアルタイム波形レンダリングシステムとWebSocket同期メカニズムについて説明します。システムは、バックエンドでの波形生成とフロントエンドでの表示の同期を維持しながら、低レイテンシーの可視化を実現しています。

## アーキテクチャ

### データフローパイプライン

```
[触覚デバイス] → [オーディオコールバック] → [波形バッファ] → [WebSocketブロードキャスト]
                                            ↓
                                     [HTTP エンドポイント]
                                            ↓
[フロントエンド] ← [WebSocket更新] + [HTTPポーリング] → [Chart.js可視化]
```

## 更新頻度

### バックエンド
- **WebSocketストリーミング**: 100ms間隔
  ```python
  streaming_interval = 0.1  # 100ms interval for waveform updates
  ```
- **バックグラウンドタスク**: 全4チャンネルの波形データを同時配信

### フロントエンド
- **リアルタイムモード**: 50ms更新間隔
- **標準モード**: 100ms更新間隔
- **React Query設定**:
  ```typescript
  refetchInterval: realTime ? 50 : 100  // ミリ秒
  ```

## 同期戦略

### ハイブリッドアプローチ

システムはWebSocketとHTTPポーリングの両方を使用：

1. **WebSocket**: パラメータ更新とステータス変更のリアルタイム通知
2. **HTTPポーリング**: 定期的な波形データ取得

このハイブリッドアプローチの利点：
- 制御変更に対する即座のフィードバック
- 一貫した波形可視化
- WebSocket障害時の優雅な機能低下

### タイミング調整

```
Backend:  |--100ms--|--100ms--|--100ms--|  (WebSocketブロードキャスト)
Frontend: |-50ms-|-50ms-|-50ms-|-50ms-|    (リアルタイムモードでのHTTPポーリング)
Chart:    |--更新--|--更新--|--更新--|      (データ到着時)
```

## バックエンド実装

### 波形生成

```python
# backend/src/haptic_system/controller.py
def audio_callback(self, outdata: np.ndarray, frames: int, time_info, status):
    """リアルタイムオーディオコールバック - 波形データを生成"""
    for channel_id in range(self.device.num_channels):
        channel = self.device.channels[channel_id]
        waveform_data = channel.get_next_chunk(frames)
        outdata[:, channel_id] = waveform_data
```

### WebSocketストリーミング

```python
# backend/src/main.py
async def background_waveform_streamer():
    while True:
        if controller and controller.is_streaming:
            # 波形スナップショットを生成
            waveform_data = {
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "sampleRate": sample_rate,
                "channels": channels_data
            }
            await broadcast_waveform_data(waveform_data)
        await asyncio.sleep(streaming_interval)
```

## フロントエンド実装

### WebSocketフック

```typescript
// frontend/src/hooks/useWebSocket.ts
export const useWebSocket = ({ url, reconnectInterval = 3000 }) => {
  // 自動再接続ロジック
  const handleMessage = useCallback((event: MessageEvent) => {
    const message = JSON.parse(event.data)
    
    switch (message.type) {
      case WSMessageType.WAVEFORM_DATA:
        // 波形データはReact Queryフックで処理
        break
      case WSMessageType.PARAMETERS_UPDATE:
        setChannels(message.data)
        break
    }
  }, [])
}
```

### 波形クエリフック

```typescript
// frontend/src/hooks/queries/useWaveformQuery.ts
export const useWaveformQuery = ({ realTime = false }) => {
  return useQuery({
    queryKey: queryKeys.waveformData(duration, sampleRate),
    queryFn: async () => HapticService.getWaveformData(duration, sampleRate),
    
    // モードに基づく更新頻度
    refetchInterval: realTime ? 50 : 100,
    refetchIntervalInBackground: true,
    
    // パフォーマンス最適化
    structuralSharing: false,  // 高頻度更新のため無効化
  })
}
```

### チャートレンダリング

```typescript
// frontend/src/components/Visualization/WaveformChart.tsx
// 効率的な更新
useEffect(() => {
  if (chartRef.current && channelData) {
    chartRef.current.data = chartData
    chartRef.current.update('none')  // アニメーションをスキップ
  }
}, [chartData])
```

## パフォーマンス最適化

### バックエンド最適化
- ゼロコピー操作による直接的なnumpy配列操作
- 事前計算された波形テーブル
- 非ブロッキングWebSocket送信

### フロントエンド最適化
- アニメーション無効化: `chart.update('none')`
- 構造共有オフ: 深い比較を防止
- メモ化されたコンポーネント: チャートコンポーネントのReact.memo
- 可視性認識更新: タブ非表示時に一時停止

## レイテンシー分析

### コンポーネントレイテンシー
- **オーディオ生成**: 11.6ms (512サンプル @ 44.1kHz)
- **WebSocketブロードキャスト**: 1-5ms
- **ネットワーク転送**: 1-10ms (ローカル/リモート)
- **フロントエンド処理**: 5-10ms
- **チャートレンダリング**: 10-20ms

### 総システムレイテンシー
- **ベストケース**: ~30ms (ローカルネットワーク)
- **標準**: 40-60ms
- **ワーストケース**: 100ms (ネットワーク問題時)

## エラーハンドリング

### 接続回復

```typescript
// 指数バックオフによる自動再接続
if (reconnectAttemptsRef.current < maxReconnectAttempts) {
  reconnectAttemptsRef.current++
  reconnectTimeoutRef.current = setTimeout(() => {
    connect()
  }, reconnectInterval)
}
```

## ベストプラクティス

### バックエンド開発
1. オーディオコールバック内で波形生成を維持
2. すべてのI/O操作に非同期を使用
3. シャットダウン時の適切なクリーンアップを実装
4. バッファアンダーランを監視

### フロントエンド開発
1. データ取得にReact Queryを使用
2. useEffectで適切なクリーンアップを実装
3. メモ化で再レンダリングを最適化
4. WebSocketライフサイクルを適切に処理

## 今後の改善

1. **WebRTCデータチャンネル**: P2P接続での低レイテンシー
2. **バイナリプロトコル**: メッセージサイズの削減
3. **適応サンプリング**: ネットワークに基づく更新レートの調整
4. **GPU加速**: 波形レンダリング用のWebGL
5. **Service Worker**: オフラインサポートとキャッシング