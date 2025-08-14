# 音声機能実装 - SRS

## 背景/目的
- Virtual Human Chatプロジェクトにおけるリアルタイム音声入出力機能の実装
- Gemini Live APIとの音声通信を可能にし、自然な対話体験を提供する
- Web Audio APIとAudio Workletを使用した高品質な音声処理

## スコープ（非ゴール含む）
### 含むもの
- マイク音声の録音・処理・送信機能
- Gemini Live APIからの音声受信・再生機能
- リアルタイム音声処理（ノイズ除去、エコーキャンセリング）
- 音声入力中の状態管理とUI表示
- 音声再生中の割り込み（barge-in）機能

### 含まないもの
- 多言語音声認識（日本語のみ）
- 音声ファイルのアップロード/ダウンロード機能
- 音声エフェクト・フィルタ機能
- オフライン音声処理

## ユーザーストーリー
- As a ユーザー, I want マイクボタンを押して音声入力したい, so that 手軽に会話できる.
- As a ユーザー, I want AIの音声回答を聞きたい, so that 自然な対話を体験できる.
- As a ユーザー, I want 音声入力中にステータスを確認したい, so that システムが正しく動作していることを知れる.
- As a ユーザー, I want AIの回答中に新しい質問をしたい, so that スムーズに会話を続けられる.
- As a ユーザー, I want 音声の音量を調整したい, so that 快適に利用できる.

## 機能要件（優先度/受入基準）
| ID | 要件 | 優先度 | 受入基準 |
|---|---|---|---|
| FR-1 | マイク音声録音機能 | Must | 16kHz/モノラル/PCM形式で録音、ノイズ除去・エコーキャンセリング有効 |
| FR-2 | 音声データリアルタイム送信 | Must | 録音中の音声をリアルタイムでGemini Live APIに送信 |
| FR-3 | 音声再生機能 | Must | Gemini APIからの24kHz音声をブラウザで再生 |
| FR-4 | 音声入力状態表示 | Must | 録音中/送信中/待機中の状態をUI表示 |
| FR-5 | 割り込み機能（barge-in） | Must | ユーザー発話開始時にAI音声を停止 |
| FR-6 | 音量制御 | Should | 音声出力の音量調整機能 |
| FR-7 | 音声品質最適化 | Should | 遅延100ms以下、音質劣化最小化 |
| FR-8 | エラーハンドリング | Must | マイクアクセス拒否、ネットワークエラーの適切な処理 |

## 非機能要件
- 性能: 音声遅延100ms以下、CPU使用率50%以下
- 可用性/信頼性: マイクアクセス失敗時の代替手段提供、音声途切れ時の自動回復
- セキュリティ/コンプライアンス: 音声データの暗号化送信、録音データの端末外保存禁止
- 運用/監視: 音声処理エラーのログ記録、レスポンス時間計測

## UI概要
- マイクボタン（押下で録音開始/終了）
- 音声入力レベルメーター
- 接続ステータス表示
- 音量調整スライダー
- 音声機能ON/OFF切り替え

## API/データモデル（案）
```ts
// 音声データ送受信フォーマット
interface AudioMessage {
  type: 'audio_input' | 'audio_output'
  format: 'pcm16' // 16-bit PCM
  sampleRate: 16000 | 24000
  data: ArrayBuffer
  timestamp: number
}

// 音声処理状態
interface AudioState {
  isRecording: boolean
  isPlaying: boolean
  volume: number // 0-100
  inputLevel: number // 0-100
  error?: string
}

// 音声設定
interface AudioSettings {
  echoCancellation: boolean
  noiseSuppression: boolean
  autoGainControl: boolean
  inputVolume: number
  outputVolume: number
}
```

## リスク/未確定事項（質問リスト）
- ブラウザ間の音声API互換性（Safari、Firefox）の確認が必要
- モバイルデバイスでの音声品質・バッテリー消費の検証が必要
- ネットワーク不安定時の音声品質劣化対策の詳細設計が必要
- 音声データのプライバシー・セキュリティポリシーの確認が必要
- Audio Workletの代替手段（ScriptProcessorNode）の必要性
- WebRTC使用の検討（より高品質な音声処理のため）
- 音声認識精度向上のためのプリプロセッシング処理の要否