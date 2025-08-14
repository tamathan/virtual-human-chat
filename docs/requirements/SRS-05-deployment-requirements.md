# デプロイ要件 - SRS

## 背景/目的
- Virtual Human ChatプロジェクトのFirebase Hosting + Cloud Runへの自動デプロイ実現
- 開発・本番環境の分離と効率的なCI/CDパイプライン構築
- asia-northeast1リージョンでの低遅延サービス提供

## スコープ（非ゴール含む）
### 含むもの
- Firebase Hostingでのフロントエンドデプロイ
- Cloud Runでのバックエンドデプロイ
- 環境変数・シークレット管理
- 自動ビルド・デプロイパイプライン
- ヘルスチェック・モニタリング設定
- ドメイン設定・SSL証明書管理

### 含まないもの
- マルチリージョンデプロイ
- Blue-Greenデプロイメント
- Kubernetesクラスター管理
- 高度な監視・アラートシステム

## ユーザーストーリー
- As a 開発者, I want コードプッシュで自動デプロイしたい, so that 効率的に開発できる.
- As a ユーザー, I want 低遅延でアクセスしたい, so that 快適に利用できる.
- As a システム管理者, I want デプロイ状況を監視したい, so that 問題を早期発見できる.
- As a 開発チーム, I want 環境ごとに設定を分けたい, so that 安全にリリースできる.

## 機能要件（優先度/受入基準）
| ID | 要件 | 優先度 | 受入基準 |
|---|---|---|---|
| FR-1 | フロントエンドデプロイ | Must | Firebase Hostingへの自動ビルド・デプロイ |
| FR-2 | バックエンドデプロイ | Must | Cloud Run (asia-northeast1) への自動デプロイ |
| FR-3 | 環境分離 | Must | dev/staging/prodの環境変数・設定分離 |
| FR-4 | シークレット管理 | Must | Google Secret Managerでの機密情報管理 |
| FR-5 | ヘルスチェック | Must | /health エンドポイントでの死活監視 |
| FR-6 | ロールバック機能 | Should | 前バージョンへの迅速な戻し機能 |
| FR-7 | カスタムドメイン | Should | 独自ドメインでのアクセス提供 |
| FR-8 | ログ集約 | Should | Cloud Loggingでのアプリケーションログ統合 |

## 非機能要件
- 性能: デプロイ時間5分以内、コールドスタート時間3秒以内
- 可用性/信頼性: 99.9%のアップタイム、自動スケーリング
- セキュリティ/コンプライアンス: HTTPS必須、適切なIAM権限設定
- 運用/監視: デプロイ通知、エラー率監視、リソース使用量追跡

## UI概要
- デプロイ状況ダッシュボード（開発者向け）
- サービス状態表示
- バージョン情報表示

## API/データモデル（案）
```ts
// デプロイ設定
interface DeploymentConfig {
  frontend: {
    platform: 'firebase-hosting'
    project: string
    site: string
    buildCommand: 'npm run build'
    outputDir: 'dist'
  }
  backend: {
    platform: 'cloud-run'
    project: string
    region: 'asia-northeast1'
    service: string
    image: string
    cpu: string
    memory: string
    maxInstances: number
  }
  secrets: {
    provider: 'google-secret-manager'
    secrets: string[]
  }
}

// 環境設定
interface EnvironmentConfig {
  name: 'development' | 'staging' | 'production'
  variables: Record<string, string>
  secrets: Record<string, string>
  domains: string[]
  scaling: {
    minInstances: number
    maxInstances: number
    cpuThreshold: number
  }
}

// デプロイステータス
interface DeploymentStatus {
  version: string
  timestamp: Date
  status: 'deploying' | 'success' | 'failed' | 'rolled-back'
  frontend: {
    url: string
    version: string
    buildTime: Date
  }
  backend: {
    url: string
    revision: string
    instances: number
    traffic: number
  }
  healthCheck: {
    status: 'healthy' | 'unhealthy'
    lastCheck: Date
    responseTime: number
  }
}
```

## リスク/未確定事項（質問リスト）
- Google Cloud プロジェクトの作成・課金設定の手順確認が必要
- Firebase とGoogle Cloud プロジェクトの連携設定方法確認が必要
- Cloud Run の適切なリソース設定（CPU・メモリ・インスタンス数）の検討が必要
- カスタムドメインの取得・設定方法の決定が必要
- CI/CDパイプライン（GitHub Actions vs Cloud Build）の選択が必要
- 環境変数の本番・開発環境での管理方法確認が必要
- モニタリング・アラート設定の詳細仕様決定が必要
- バックアップ・災害復旧計画の策定が必要
- コスト監視・最適化戦略の検討が必要
- セキュリティスキャン・コンプライアンスチェックの自動化要否