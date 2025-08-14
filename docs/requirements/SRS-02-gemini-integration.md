# Gemini Live API統合 - SRS

## 背景/目的
- Gemini Live APIとの完全統合によるリアルタイム音声AI対話の実現
- WebSocket接続を用いた双方向リアルタイム通信
- 日本語音声に最適化されたAI応答の提供

## スコープ（非ゴール含む）
### 含むもの
- Gemini Live API WebSocket接続管理
- リアルタイム音声送受信プロトコル実装
- AI応答品質の最適化（日本語対応）
- 接続状態管理とエラーハンドリング
- API使用量の監視と制限

### 含まないもの
- Gemini Pro APIとの統合（テキストベース）
- カスタムAIモデルの学習・調整
- 他の音声AIサービスとの統合
- オフラインAI機能

## ユーザーストーリー
- As a ユーザー, I want AIと自然な日本語で会話したい, so that 親しみやすい対話体験ができる.
- As a ユーザー, I want AIからの応答が早く返ってきてほしい, so that スムーズな会話ができる.
- As a ユーザー, I want 接続状態を確認したい, so that システムの状況を把握できる.
- As a 開発者, I want API使用量を監視したい, so that コストを管理できる.
- As a ユーザー, I want 通信エラーから自動回復してほしい, so that中断なく会話を続けられる.

## 機能要件（優先度/受入基準）
| ID | 要件 | 優先度 | 受入基準 |
|---|---|---|---|
| FR-1 | WebSocket接続管理 | Must | 自動接続、再接続、適切な切断処理 |
| FR-2 | 音声データ送信 | Must | PCM16形式音声のリアルタイム送信 |
| FR-3 | 音声データ受信 | Must | PCM24形式音声の受信と変換 |
| FR-4 | セッション管理 | Must | モデル設定、システム指示の適用 |
| FR-5 | エラーハンドリング | Must | 接続失敗、タイムアウト、レート制限の処理 |
| FR-6 | 応答最適化 | Must | 日本語音声、短文回答、親しみやすいトーン |
| FR-7 | 使用量監視 | Should | API呼び出し回数、データ量の追跡 |
| FR-8 | 接続状態表示 | Must | 接続中/切断中/エラー状態のUI表示 |

## 非機能要件
- 性能: WebSocket接続確立3秒以内、応答遅延1秒以内
- 可用性/信頼性: 接続失敗時の自動再試行（最大3回）、フォールバック機能
- セキュリティ/コンプライアンス: APIキーの安全な管理、通信の暗号化
- 運用/監視: API使用量ログ、エラー率監視、パフォーマンス計測

## UI概要
- 接続ステータスインジケーター
- AI応答待機中のローディング表示
- エラー状態の通知
- API使用量表示（開発者向け）

## API/データモデル（案）
```ts
// Gemini Live API接続設定
interface GeminiConfig {
  model: 'models/gemini-2.0-flash-exp'
  apiKey: string
  voiceConfig: {
    voiceName: 'Charon' | 'Kore' | 'Fenrir' | 'Aoede'
    language: 'ja-JP'
  }
  generationConfig: {
    responseModalities: ['AUDIO']
    speechConfig: VoiceConfig
  }
  systemInstruction: string
}

// WebSocket メッセージ型
interface GeminiMessage {
  setup?: GeminiConfig
  client_content?: {
    turns: Array<{
      role: 'user'
      parts: Array<{
        inline_data: {
          mime_type: 'audio/pcm'
          data: string // base64
        }
      }>
    }>
    turn_complete: boolean
  }
  serverContent?: {
    modelTurn: {
      parts: Array<{
        inlineData?: {
          mimeType: 'audio/pcm'
          data: string
        }
        text?: string
      }>
    }
  }
}

// 接続状態管理
interface ConnectionState {
  status: 'disconnected' | 'connecting' | 'connected' | 'error'
  lastConnected?: Date
  errorMessage?: string
  retryCount: number
}

// 使用量監視
interface UsageMetrics {
  apiCalls: number
  audioDataSent: number // bytes
  audioDataReceived: number // bytes
  errors: number
  resetDate: Date
}
```

## リスク/未確定事項（質問リスト）
- Gemini Live APIの利用制限（レート制限、データ量制限）の詳細確認が必要
- 音声品質設定（ビットレート、サンプリングレート）の最適値検証が必要
- 日本語音声の認識精度・応答品質の検証が必要
- API料金体系とコスト管理方法の確認が必要
- WebSocket接続の安定性とタイムアウト設定の最適化が必要
- システム指示文の効果的な設定方法の検討が必要
- 複数セッション同時接続時の制限・影響の確認が必要
- 音声データのプライバシー・保持期間に関するGoogle側のポリシー確認が必要