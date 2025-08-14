# セキュリティ要件 - SRS

## 背景/目的
- Virtual Human Chatプロジェクトの包括的なセキュリティ対策実装
- 音声データ、APIキー、ユーザー情報の適切な保護
- 本番環境でのセキュリティベストプラクティス適用

## スコープ（非ゴール含む）
### 含むもの
- データ暗号化（通信・保存）
- APIキー・シークレット管理
- 音声データのプライバシー保護
- HTTPS/TLS設定
- セキュリティヘッダー設定
- アクセス制御とレート制限

### 含まないもの
- 個人情報の長期保存
- 高度な脅威検知システム
- SOC2/ISO27001準拠
- エンタープライズ認証連携

## ユーザーストーリー
- As a ユーザー, I want 音声データが安全に送信されることを知りたい, so that 安心して利用できる.
- As a 開発者, I want APIキーが漏洩しないようにしたい, so that セキュリティインシデントを防げる.
- As a システム管理者, I want 不正アクセスを検知したい, so that 迅速に対応できる.
- As a ユーザー, I want プライベートな会話が記録されないことを知りたい, so that プライバシーが保護される.

## 機能要件（優先度/受入基準）
| ID | 要件 | 優先度 | 受入基準 |
|---|---|---|---|
| FR-1 | HTTPS通信強制 | Must | 全ての通信でTLS 1.2以上、HTTP→HTTPSリダイレクト |
| FR-2 | APIキー保護 | Must | フロントエンドにAPIキー露出なし、BFFでの代理アクセス |
| FR-3 | セキュリティヘッダー | Must | CSP、HSTS、X-Frame-Options等の適切な設定 |
| FR-4 | 音声データ保護 | Must | 送信時暗号化、サーバー側一時保存なし |
| FR-5 | レート制限 | Must | DDoS攻撃対策、適切なレート制限設定 |
| FR-6 | エラー情報制限 | Must | エラーメッセージでのシステム情報漏洩防止 |
| FR-7 | セキュリティログ | Should | 不正アクセス試行、異常なリクエストパターンの記録 |
| FR-8 | 環境変数保護 | Must | シークレット情報の環境変数管理、ソースコード除外 |

## 非機能要件
- 性能: セキュリティ処理によるレスポンス遅延20ms以下
- 可用性/信頼性: セキュリティ機能故障時のフェイルセーフ動作
- セキュリティ/コンプライアンス: OWASP Top 10対策、定期的な脆弱性スキャン
- 運用/監視: セキュリティイベントの即時アラート、ログ分析

## UI概要
- セキュリティステータス表示
- プライバシー設定ダイアログ
- セキュリティエラーの分かりやすい表示
- データ使用に関する透明性の提供

## API/データモデル（案）
```ts
// セキュリティ設定
interface SecurityConfig {
  https: {
    enforced: true
    tlsVersion: '1.2' | '1.3'
    hstsMaxAge: number
  }
  cors: {
    allowedOrigins: string[]
    allowedMethods: string[]
    allowedHeaders: string[]
    credentials: boolean
  }
  rateLimiting: {
    windowMs: number
    maxRequests: number
    skipSuccessfulRequests: boolean
  }
  contentSecurityPolicy: {
    directives: Record<string, string[]>
  }
}

// セキュリティログエントリ
interface SecurityLogEntry {
  timestamp: Date
  level: 'info' | 'warn' | 'error' | 'critical'
  event: 'auth_failure' | 'rate_limit_exceeded' | 'invalid_request' | 'suspicious_activity'
  ip: string
  userAgent?: string
  details: Record<string, any>
  action: 'blocked' | 'allowed' | 'monitored'
}

// プライバシー設定
interface PrivacySettings {
  audioDataRetention: 'none' | 'session-only'
  loggingLevel: 'minimal' | 'standard' | 'detailed'
  thirdPartySharing: false
  dataExportAvailable: boolean
}
```

## リスク/未確定事項（質問リスト）
- 音声データのGemini API側での保存・処理ポリシーの確認が必要
- Content Security Policy設定での音声機能への影響確認が必要
- Cloud Runでの証明書管理方法（Let's Encrypt vs マネージド証明書）
- Firebase HostingとCloud Run間のセキュリティ境界設定
- ペネトレーションテストの実施頻度・範囲の決定が必要
- セキュリティインシデント対応手順の策定が必要
- 音声データの地域間転送規制（GDPR等）の確認が必要
- Webアプリでのマイク権限管理のベストプラクティス適用
- セキュリティヘッダーの各ブラウザ対応状況確認が必要
- 開発環境と本番環境のセキュリティ設定差分管理方法