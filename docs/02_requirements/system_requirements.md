# 二軸振動触覚システム要件定義書

## 1. エグゼクティブサマリー

### 1.1 プロジェクト概要
本要件定義書は、4チャンネル独立制御可能なノコギリ波出力デバイスのMVP（Minimum Viable Product）開発における技術要件を定義するものです。本デバイスは、2つの2軸振動アクチュエータを用いて、基本的な触覚フィードバックを実現することを目的としています。

### 1.2 MVP機能範囲
- 4チャンネル独立周波数制御（40-120Hz）
- 基本的なノコギリ波形の生成と極性反転
- 振幅の独立制御
- REST APIによるパラメータ制御
- Web UIでの波形可視化

### 1.3 対象アプリケーション（MVP）
- 基本的な振動触覚フィードバック
- ノコギリ波による方向性力覚の検証

### 1.4 技術スタック
- バックエンド: Python (uv管理), FastAPI, NumPy
- フロントエンド: React, react-chartjs-2
- 通信: REST API (HTTP)

## 2. システム概要

### 2.1 システムアーキテクチャ
```
┌─────────────────────────────────────────────────┐
│           React UI (localhost:3000)              │
│  ├── ControlPanel: パラメータ制御                  │
│  ├── WaveformChart: 4ch波形表示                  │
│  └── XYTrajectory: XY軌跡表示（将来）             │
├─────────────────────────────────────────────────┤
│           REST API (HTTP/JSON)                   │
├─────────────────────────────────────────────────┤
│         FastAPI Server (localhost:8000)          │
│  ├── 波形生成エンジン（サンプルコードベース）        │
│  ├── 共振シミュレーション                         │
│  └── パラメータ管理                              │
├──────────┬──────────┬──────────┬──────────────┤
│  Ch1(X1) │  Ch2(Y1) │  Ch3(X2) │   Ch4(Y2)   │
├──────────┴──────────┼──────────┴──────────────┤
│    デバイス1         │      デバイス2           │
│  (2軸アクチュエータ)  │   (2軸アクチュエータ)    │
└─────────────────────┴─────────────────────────┘
```

### 2.2 デバイス構成
- **デバイス1**: チャンネル1,2（X軸、Y軸）
- **デバイス2**: チャンネル3,4（X軸、Y軸）
- **インターフェース**: 4chオーディオデバイス（Miraisense Haptics互換）

## 3. 機能要件

### 3.1 チャンネル管理要件

#### FR-001: 4チャンネル独立制御
システムは4つの独立した出力チャンネルを提供し、各チャンネルは他のチャンネルに影響を与えることなく制御可能でなければならない。

#### FR-002: デバイス割り当て
- チャンネル1,2はデバイス1のX軸、Y軸を制御する
- チャンネル3,4はデバイス2のX軸、Y軸を制御する

#### FR-003: パラメータ制御
各チャンネルのパラメータは、REST APIを通じて更新可能でなければならない。MVP段階では1-5Hz程度の更新頻度で十分とする。

### 3.2 周波数制御要件

#### FR-004: 周波数範囲
各チャンネルは40Hz〜120Hzの範囲で独立して周波数を設定できなければならない。

#### FR-005: 周波数分解能
周波数の設定分解能は1Hz以下でなければならない（MVP段階）。

#### FR-006: 周波数変更の連続性
周波数変更時にクリックノイズや不連続な変化が発生してはならない。

### 3.3 波形生成要件

#### FR-007: ノコギリ波生成
システムは各チャンネルで高品質なノコギリ波を生成できなければならない。

#### FR-008: 波形極性反転
各チャンネルのノコギリ波は独立して極性を反転できなければならない。
- 正極性: 上昇ランプ波形
- 負極性: 下降ランプ波形

#### FR-009: 波形パラメータ（MVP簡素化）
MVP段階では固定のノコギリ波形（デューティ比50%）のみサポートする。

### 3.4 振幅制御要件

#### FR-010: 振幅範囲
各チャンネルの振幅は0〜100%の範囲で独立して設定可能でなければならない。

#### FR-011: 振幅分解能
振幅の設定分解能は最低8ビット（256段階）以上でなければならない。

#### FR-012: エンベロープ制御（将来機能）
MVP段階では実装しない。将来的に振幅の急激な変化を防ぐフェードイン/フェードアウト機能を検討する。

### 3.5 位相・ベクトル制御要件

#### FR-013: 位相制御
各チャンネルの位相は0°〜360°の範囲で設定可能でなければならない。

#### FR-014: 位相分解能
位相の設定分解能は1°以下でなければならない。

#### FR-015: ベクトル力覚生成
デバイスごとに2軸の位相差を制御することで、任意方向への力覚ベクトルを生成できなければならない。

#### FR-016: 同期更新
同一デバイス内の2チャンネル（X,Y軸）の位相は同期して更新されなければならない。

## 4. 技術仕様

### 4.1 ノコギリ波生成仕様（MVP）

#### 4.1.1 波形特性
```
振幅
 ↑
A├─────╱│
 │   ╱  │
 │ ╱    │
0├─────┴─→ 時間
 0     T

パラメータ:
- 周期 T = 1/f (f: 周波数)
- 振幅 A: 0.0〜1.0（正規化値）
- 立ち上がり時間: Tr
- 立ち下がり時間: Tf
- デューティ比: Tr/T
```

#### 4.1.2 波形品質
- 直線性: 理想的なランプからの偏差±2%以内
- 高調波制御: 触覚品質のための適切なフィルタリング
- アンチエイリアシング: ナイキスト周波数以上の成分を除去

### 4.2 ベクトル力覚生成仕様

#### 4.2.1 力ベクトル計算
```python
# デバイス1の力ベクトル
Fx1 = A1 * sawtooth(f1, φ1, polarity1)  # チャンネル1
Fy1 = A2 * sawtooth(f2, φ2, polarity2)  # チャンネル2
F1 = [Fx1, Fy1]

# ベクトル方向と大きさ
θ1 = atan2(Fy1, Fx1)
|F1| = sqrt(Fx1² + Fy1²)
```

#### 4.2.2 位相同期
- 共通タイムベースの使用
- 位相ロック生成
- バッファリングによる同時更新

### 4.3 信号処理パイプライン
```
入力パラメータ
    ↓
ノコギリ波生成器
    ↓
位相シフター
    ↓
振幅スケーラー
    ↓
アンチエイリアスフィルタ
    ↓
出力バッファ（ダブルバッファリング）
    ↓
4chオーディオ出力
```

## 5. 性能要件

### 5.1 レイテンシ
- **最大遅延**: コマンド入力から出力まで10ms以下
- **ジッタ**: タイミング変動1ms以下

### 5.2 更新レート
- **パラメータ更新**: 1000Hz以上
- **波形サンプリングレート**: 44.1kHz以上

### 5.3 精度
- **周波数精度**: 設定値の±0.1%以内
- **位相精度**: 同期チャンネル間で±0.5°以内
- **THD（全高調波歪み）**: 5%以下

## 6. 実装要件

### 6.1 ソフトウェアアーキテクチャ
既存のDualVibrationActuatorクラスアーキテクチャを拡張し、以下のモジュール構成とする：

```
sawtooth_actuator/
├── sawtooth_config.py         # ノコギリ波用設定・定数
├── sawtooth_generator.py      # ノコギリ波生成エンジン
├── vector_controller.py       # ベクトル制御ロジック
├── phase_synchronizer.py      # 位相同期管理
└── sawtooth_actuator.py      # メインクラス
```

### 6.2 主要クラス設計（MVP）

#### 波形生成関数（core/waveform.py）
```python
def sawtooth_wave(t: np.ndarray, freq: float, amp: float = 1.0, phase: float = 0.0) -> np.ndarray:
    """サンプルコードと同じ上昇ノコギリ波生成"""
    return amp * (2 * ((freq * t + phase) % 1.0) - 1)
```

#### パラメータモデル（models/parameters.py）
```python
from pydantic import BaseModel, Field

class ChannelParameters(BaseModel):
    channel_id: int = Field(..., ge=0, le=3)
    frequency: float = Field(60.0, ge=40, le=120)
    amplitude: float = Field(0.5, ge=0, le=1)
    phase: float = Field(0.0, ge=0, lt=360)
    polarity: bool = Field(True)  # True: 上昇, False: 下降
```

### 6.3 互換性要件（MVP）
- Python 3.8以上（uv管理）
- NumPy 1.19以上
- FastAPI 0.100以上
- Pydantic 2.0以上
- React 18以上
- react-chartjs-2

## 7. 安全性・制限事項

### 7.1 出力制限
- **最大出力電圧/電流**: アクチュエータ仕様に準拠
- **過熱保護**: 連続動作時の温度監視
- **ソフトスタート/ストップ**: 機械的ショック防止

### 7.2 エラー処理
- パラメータ範囲外入力の検証
- デバイス接続エラーの適切な処理
- リソース不足時のグレースフルデグラデーション

## 8. テスト要件

### 8.1 単体テスト
- 各チャンネルの周波数精度検証
- 位相関係の正確性テスト
- 振幅制御の線形性確認

### 8.2 統合テスト
- 4チャンネル同時動作テスト
- ベクトル角度精度測定
- リアルタイム性能評価

### 8.3 アクチュエータテスト
- 実機での振動特性評価
- 高調波歪みの測定
- 長時間動作安定性確認

## 9. 拡張性考慮事項

### 9.1 将来の機能拡張
- 他の波形（三角波、矩形波）のサポート
- 8チャンネル以上への拡張
- 複数デバイスの同期制御

### 9.2 API設計
- RESTful APIによる外部制御
- HTTP APIによるリアルタイム制御
- プリセット管理機能

## 10. ドキュメント要件

### 10.1 技術文書
- APIリファレンス
- 実装ガイド
- パフォーマンスチューニングガイド

### 10.2 ユーザー文書
- クイックスタートガイド
- パラメータ設定ガイド
- トラブルシューティング

## 付録A: 用語集

- **ノコギリ波（Sawtooth Wave）**: 直線的に上昇または下降する波形
- **デューティ比（Duty Cycle）**: 波形の立ち上がり時間の周期に対する比率
- **位相（Phase）**: 波形の時間的なずれを角度で表したもの
- **ベクトル力覚（Vector Force）**: 2軸の合成により生成される方向性のある力覚

## 付録B: REST API設計（OpenAPI Specification）

```yaml
openapi: 3.0.0
info:
  title: Sawtooth Haptic Device API
  version: 1.0.0
  description: ノコギリ波触覚デバイス制御API

paths:
  /api/parameters:
    get:
      summary: 現在のパラメータ取得
      responses:
        200:
          description: 成功
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/SystemParameters'
    
    put:
      summary: パラメータ更新
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/SystemParameters'
      responses:
        200:
          description: 更新成功
  
  /api/waveform:
    get:
      summary: 波形データ取得
      parameters:
        - name: duration
          in: query
          schema:
            type: number
            default: 0.1
          description: 取得する波形の長さ（秒）
      responses:
        200:
          description: 波形データ
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/WaveformData'
  
  /api/channels/{channel_id}:
    put:
      summary: 個別チャンネル更新
      parameters:
        - name: channel_id
          in: path
          required: true
          schema:
            type: integer
            minimum: 0
            maximum: 3
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ChannelParameters'
      responses:
        200:
          description: 更新成功

components:
  schemas:
    ChannelParameters:
      type: object
      required: [channel_id]
      properties:
        channel_id:
          type: integer
          minimum: 0
          maximum: 3
        frequency:
          type: number
          minimum: 40
          maximum: 120
          default: 60
        amplitude:
          type: number
          minimum: 0
          maximum: 1
          default: 0.5
        phase:
          type: number
          minimum: 0
          maximum: 360
          default: 0
        polarity:
          type: boolean
          default: true
          description: true=上昇波形, false=下降波形
    
    SystemParameters:
      type: object
      properties:
        channels:
          type: array
          items:
            $ref: '#/components/schemas/ChannelParameters'
          minItems: 4
          maxItems: 4
    
    WaveformData:
      type: object
      properties:
        timestamp:
          type: number
          description: Unix timestamp
        sample_rate:
          type: integer
          default: 44100
        channels:
          type: array
          items:
            type: object
            properties:
              channel_id:
                type: integer
              data:
                type: array
                items:
                  type: number
                description: 波形データ（間引き済み）
```

## 付録C: 参考実装例

```python
"""
16 方向（22.5° 刻み）のノコギリ波入力 → 2 軸 VCA 共振応答を描画
────────────────────────────────────────
  • sawtooth_wave()         : 上りノコギリ波生成
  • resonator()             : 2 次共振系 (双一次変換で離散化)
  • メイン部                : 30 Hz 入力 / 180 Hz 共振 / ζ=0.08
                              電圧・電流・加速度（ノイズ 3 %）
                              └─ Figure-A  時系列 (Voltage=実線, Current=破線, Accel.=点線)
                              └─ Figure-B  XY 加速度軌跡（線グラフ）
"""

import numpy as np
import matplotlib.pyplot as plt

# ---------------------------------------------------------------
# 1. 基本波形：上りノコギリ波
# ---------------------------------------------------------------
def sawtooth_wave(t: np.ndarray, freq: float, amp: float = 1.0, phase: float = 0.0) -> np.ndarray:
    """ascending sawtooth in [-amp, amp]"""
    return amp * (2 * ((freq * t + phase) % 1.0) - 1)

# ---------------------------------------------------------------
# 2. 2 次共振系 (ωn, ζ) → IIR フィルタ
# ---------------------------------------------------------------
def resonator(u: np.ndarray, fs: float, f_n: float, zeta: float) -> np.ndarray:
    """
    G(s)=ωn²/(s²+2ζωn s+ωn²) を Tustin 変換
    """
    w_n, dt = 2 * np.pi * f_n, 1 / fs
    a0 = 4 + 4 * zeta * w_n * dt + (w_n * dt) ** 2
    b0 = (w_n * dt) ** 2
    b1 = 2 * b0
    b2 = b0
    a1 = 2 * ((w_n * dt) ** 2 - 4)
    a2 = 4 - 4 * zeta * w_n * dt + (w_n * dt) ** 2

    y = np.zeros_like(u)
    for n in range(2, len(u)):
        y[n] = (b0 * u[n] + b1 * u[n - 1] + b2 * u[n - 2]
                - a1 * y[n - 1] - a2 * y[n - 2]) / a0
    return y

# ---------------------------------------------------------------
# 3. シミュレーション設定
# ---------------------------------------------------------------
fs       = 20_000        # サンプリング [Hz]
f_saw    = 30            # 入力ノコギリ波 [Hz]
f_res    = 180           # 共振 [Hz]（基音の 6 倍）
zeta     = 0.08          # 減衰比
cycles   = 3             # ノコギリ 3 周期
t        = np.arange(0, cycles / f_saw, 1 / fs)
saw      = sawtooth_wave(t, f_saw)
V0       = 1.0           # 正規化振幅
noise    = 0.03          # 3 % センサノイズ
np.random.seed(42)

# ---------------------------------------------------------------
# 4. Figure-A: Voltage / Current / Acceleration (16 panels)
# ---------------------------------------------------------------
fig_sig, axes_sig = plt.subplots(4, 4, figsize=(14, 12), sharex=True, sharey=True)
fig_sig.suptitle("Voltage (solid)  |  Current (dashed)  |  Acceleration (dotted)\n16 directions (22.5° step)", y=0.92)

for idx in range(16):
    θ_deg  = 22.5 * idx
    θ_rad  = np.deg2rad(θ_deg)
    Vx     =  V0 * np.cos(θ_rad) * saw
    Vy     = -V0 * np.sin(θ_rad) * saw          # Y 側は逆位相
    Ix, Iy = Vx, Vy                             # R = 1 Ω
    Ax     = resonator(Ix, fs, f_res, zeta) + noise * np.random.randn(len(t))
    Ay     = resonator(Iy, fs, f_res, zeta) + noise * np.random.randn(len(t))

    ax = axes_sig[idx // 4, idx % 4]
    ax.plot(t, Vx,           color='tab:blue')           # Vx
    ax.plot(t, Vy,           color='tab:orange')         # Vy
    ax.plot(t, Ix,  ls='--', color='tab:blue')           # Ix
    ax.plot(t, Iy,  ls='--', color='tab:orange')         # Iy
    ax.plot(t, Ax,  ls=':',  color='tab:blue')           # Ax
    ax.plot(t, Ay,  ls=':',  color='tab:orange')         # Ay
    ax.set_title(f"{θ_deg:.1f}°", fontsize=8)
    ax.grid(alpha=0.3)
    if idx % 4 == 0:
        ax.set_ylabel("Amplitude [norm.]")
    if idx // 4 == 3:
        ax.set_xlabel("Time [s]")

plt.tight_layout(rect=[0, 0.04, 1, 0.9])

# ---------------------------------------------------------------
# 5. Figure-B: Acceleration Trajectories (16 panels)
# ---------------------------------------------------------------
fig_traj, axes_traj = plt.subplots(4, 4, figsize=(10, 10), sharex=True, sharey=True)
fig_traj.suptitle("Acceleration Trajectories – 16 directions", y=0.92)

for idx in range(16):
    θ_deg  = 22.5 * idx
    θ_rad  = np.deg2rad(θ_deg)
    Ax = resonator(V0 * np.cos(θ_rad) * saw, fs, f_res, zeta) + noise * np.random.randn(len(t))
    Ay = resonator(-V0 * np.sin(θ_rad) * saw, fs, f_res, zeta) + noise * np.random.randn(len(t))

    ax = axes_traj[idx // 4, idx % 4]
    ax.plot(Ax, Ay, linewidth=0.7)
    ax.set_title(f"{θ_deg:.1f}°", fontsize=8)
    ax.set_aspect('equal', adjustable='box')
    ax.set_xlim(-2, 2); ax.set_ylim(-2, 2)
    ax.grid(alpha=0.3)
    if idx % 4 == 0:
        ax.set_ylabel("Ay [norm.]")
    if idx // 4 == 3:
        ax.set_xlabel("Ax [norm.]")

plt.tight_layout(rect=[0, 0.04, 1, 0.9])
plt.show()

```

## 付録C: 技術的制約と考慮事項

### C.1 アクチュエータの共振特性
使用するアクチュエータの共振特性を事前に測定し、以下の対策を実施：
- 各アクチュエータ固有の共振周波数の特定
- 40-120Hz駆動範囲での振幅特性の測定
- 周波数依存の振幅補償（必要に応じた電圧調整）
- 各周波数での振幅特性の事前測定とキャリブレーション

### C.2 偏加速度による力覚提示
効果的な力覚提示のための推奨パラメータ：
- **時間比**: 急峻な変化（10-20%）と緩やかな変化（80-90%）の組み合わせ
- **基準周波数**: 10Hz前後が人間の知覚に最適
- **初期過渡応答の活用**: 最初の1-2周期で強い方向性を提示

### C.3 フィードバック制御の必要性
研究結果より、以下の理由でフィードバック制御が不可欠：
- アクチュエータが固有振動数で振動する傾向の抑制
- 入力波形への追従性向上
- 仮想的な減衰増加による偏加速度の生成

推奨制御方式：
- 速度フィードバックによる仮想減衰
- 位置フィードバックによる波形追従
- 適応制御による個体差補償

## 11. 力覚提示のための追加要件

### 11.1 偏加速度生成要件

#### FR-017: 非対称加速度プロファイル
ノコギリ波は以下の非対称性を実現できなければならない：
- 急峻な立ち上がり/立ち下がり: 最大加速度の生成
- 緩やかな戻り: 知覚されにくい逆方向加速度

#### FR-018: 過渡応答の活用
システムは初期の1-2周期の過渡応答を積極的に活用し、瞬間的な強い方向性力覚を生成できなければならない。

### 11.2 制御システム要件

#### FR-019: フィードバック制御
以下のフィードバック機能を実装しなければならない：
- サンプリングレート: 最低2kHz以上
- 制御遅延: 1ms以下
- 速度/位置フィードバックの選択可能

#### FR-020: 適応的振幅補償
駆動周波数に応じた振幅補償機能：
- 周波数-振幅特性のルックアップテーブル
- リアルタイム振幅調整
- 個体差の自動キャリブレーション

### 11.3 安全性要件

#### FR-021: 共振回避機能
システムは以下の共振保護機能を持たなければならない：
- 共振周波数近傍（±10Hz）での出力制限
- 異常振動の検出と自動停止
- 共振周波数の自動検出機能

## 12. 実装ガイドライン

### 12.1 波形設計の最適化
1. **40-60Hz範囲**: 低周波数での大振幅補償
2. **60-100Hz範囲**: 標準的な力覚提示に最適
3. **100-120Hz範囲**: 高精細なテクスチャ表現

### 12.2 二軸協調制御
- 位相差0°: 直線的な力覚（0°、90°、180°、270°）
- 位相差45°: 斜め方向の力覚
- 位相差90°: 円運動や回転感覚の生成

### 12.3 推奨開発手順
1. 単軸でのノコギリ波追従性の確立
2. フィードバック制御の実装と調整
3. 二軸協調動作の実装
4. 力覚提示効果の主観評価と最適化
