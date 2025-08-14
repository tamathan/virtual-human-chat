# JWT認証実装 - SRS

## 背景/目的
- BFFサーバーでのセキュアなトークン管理機能の実装
- フロントエンドからGemini APIへの安全なアクセスを提供
- APIキー露出防止とアクセス制御の実現

## スコープ（非ゴール含む）
### 含むもの
- 短期間有効なJWTトークンの発行機能
- トークンベースのAPI認証
- レート制限とアクセス制御
- トークンの有効性検証
- セキュアなAPIキー管理

### 含まないもの
- ユーザー登録・ログイン機能
- 長期間セッション管理
- ソーシャル認証連携
- 権限管理システム

## ユーザーストーリー
- As a フロントエンドアプリ, I want 安全にAPIアクセスしたい, so that ユーザーデータを保護できる.
- As a 開発者, I want APIキーを隠蔽したい, so that セキュリティリスクを回避できる.
- As a システム管理者, I want アクセスを制限したい, so that 不正利用を防げる.
- As a ユーザー, I want 認証エラーを理解したい, so that 適切に対処できる.

## 機能要件（優先度/受入基準）
| ID | 要件 | 優先度 | 受入基準 |
|---|---|---|---|
| FR-1 | JWT トークン発行 | Must | 有効期限15分のトークン生成、秘密鍵での署名 |
| FR-2 | トークン検証機能 | Must | JWT署名検証、有効期限チェック |
| FR-3 | レート制限 | Must | IPごとに1分間5回までのトークン発行制限 |
| FR-4 | エラーハンドリング | Must | 認証失敗、期限切れの適切なエラーレスポンス |
| FR-5 | セキュアなシークレット | Must | 環境変数でのJWT_SECRET管理、強度検証 |
| FR-6 | ログ記録 | Should | トークン発行・検証のログ出力 |
| FR-7 | ヘルスチェック | Must | 認証システムの稼働状態確認 |

## 非機能要件
- 性能: トークン発行・検証10ms以内
- 可用性/信頼性: 99.9%の稼働率、サーバー再起動後の自動復旧
- セキュリティ/コンプライアンス: HTTPS必須、JWT_SECRET 32文字以上、トークン漏洩時の影響最小化
- 運用/監視: 認証ログの記録、不正アクセス検知

## UI概要
- 認証エラー時のエラーメッセージ表示
- 接続状態での認証ステータス表示
- 開発者向け認証デバッグ情報

## API/データモデル（案）
```ts
// JWT ペイロード
interface JWTPayload {
  iat: number // 発行時刻
  exp: number // 有効期限（15分後）
  purpose: 'gemini-api-access' // 用途限定
  clientId?: string // クライアント識別子（オプション）
}

// トークン発行レスポンス
interface TokenResponse {
  token: string
  expiresAt: string // ISO 8601
  expiresIn: number // 秒数
}

// エラーレスポンス
interface AuthError {
  error: string
  message: string
  code: 'TOKEN_EXPIRED' | 'INVALID_TOKEN' | 'RATE_LIMITED' | 'SERVER_ERROR'
  retryAfter?: number // レート制限時の待機時間（秒）
}

// 認証設定
interface AuthConfig {
  jwtSecret: string
  tokenExpiryMinutes: number
  rateLimitWindowMs: number
  rateLimitMaxRequests: number
}
```

## リスク/未確定事項（質問リスト）
- JWT_SECRETの生成・管理方法（Kubernetes Secret、環境変数等）
- トークン有効期限の最適な設定時間（15分 vs 1時間 vs 可変）
- レート制限の適切な設定値（頻度、時間窓）
- 本番環境でのHTTPS証明書取得・設定方法
- Cloud Runでの環境変数セキュア管理方法
- 複数インスタンス間でのレート制限状態共有の必要性
- トークン無効化（ブラックリスト）機能の要否
- CORS設定の本番環境最適化
- 認証ログの保存期間・形式の決定
- セキュリティスキャン・監査の実施方法