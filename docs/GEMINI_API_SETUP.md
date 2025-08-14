# Gemini API Setup Guide

## 🎯 Overview

このガイドでは、Virtual Human ChatでGemini Live APIを使用するためのAPIキー設定方法を説明します。

## 📋 Prerequisites

- Google Cloudアカウント
- 課金設定が有効化されたGCPプロジェクト
- Cloud Run サービスへのデプロイ権限

## 🔑 Gemini API Key の取得

### 1. Google AI Studio でAPIキーを生成

1. **Google AI Studio** にアクセス: https://aistudio.google.com/
2. 右上の **「Get API key」** をクリック
3. **「Create API key」** を選択
4. 既存のGCPプロジェクトを選択、または新規プロジェクトを作成
5. 生成されたAPIキーをコピーして保存

### 2. API有効化の確認

以下のAPIが有効化されていることを確認してください：

```bash
# Google AI Platform API を有効化
gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID

# 必要に応じて Generative AI API も有効化
gcloud services enable generativelanguage.googleapis.com --project=YOUR_PROJECT_ID
```

## 🚀 Cloud Run での環境変数設定

### 方法1: gcloud CLI を使用

```bash
# APIキーを環境変数として設定
gcloud run services update vh-fullstack \
  --region=asia-northeast1 \
  --project=YOUR_PROJECT_ID \
  --set-env-vars="GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE"
```

### 方法2: Google Cloud Console を使用

1. **Cloud Run** サービス一覧で `vh-fullstack` を選択
2. **「編集してから新しいリビジョンをデプロイ」** をクリック
3. **「変数とシークレット」** タブを選択
4. **「環境変数を追加」** をクリック
5. 以下を入力：
   - **名前**: `GEMINI_API_KEY`
   - **値**: 取得したAPIキー
6. **「デプロイ」** をクリック

### 方法3: デプロイスクリプト を使用（推奨）

環境変数を保持してデプロイする場合：

```bash
# 環境変数を保持してデプロイ
npm run deploy:cloud-run-env

# または直接スクリプト実行
./deploy-with-env.sh
```

このスクリプトは既存の環境変数を自動で保持し、デプロイ時に再設定します。

### ⚠️ 重要な注意事項

**MCPツールでのデプロイ**: `mcp__cloud-run__deploy_local_folder` は環境変数を保持しません。
必ず上記のスクリプトを使用するか、デプロイ後に手動で環境変数を再設定してください。

## 🔒 セキュリティベストプラクティス

### 1. Secret Manager の使用（推奨）

本番環境では、環境変数の代わりにSecret Managerを使用することを推奨します：

```bash
# Secret Manager でシークレットを作成
gcloud secrets create gemini-api-key \
  --data-file=- \
  --project=YOUR_PROJECT_ID <<< "YOUR_GEMINI_API_KEY_HERE"

# Cloud Run サービスにSecret Manager アクセス権限を付与
gcloud run services update vh-fullstack \
  --region=asia-northeast1 \
  --project=YOUR_PROJECT_ID \
  --update-secrets="GEMINI_API_KEY=gemini-api-key:latest"
```

### 2. アクセス制限

APIキーの使用を制限することを推奨します：

1. **Google AI Studio** でAPIキーを選択
2. **「Restrict key」** をクリック
3. **Application restrictions** で以下を設定：
   - **HTTP referrers**: あなたのドメインのみ許可
   - **IP addresses**: Cloud Runサービスの送信IPのみ許可（可能な場合）

### 3. 使用量制限

予期しない課金を防ぐため：

1. **Quotas & Limits** で使用量制限を設定
2. **Billing alerts** で予算アラートを設定
3. 定期的にAPIキーのローテーションを実施

## ✅ 設定確認

### 1. デプロイメントログの確認

```bash
# Cloud Run サービスのログを確認
gcloud logs tail --service=vh-fullstack \
  --project=YOUR_PROJECT_ID \
  --format="value(textPayload)"
```

期待する出力：
```
Environment variables status:
GEMINI_API_KEY: Set (AIzaSyDRmB...)
JWT_SECRET: Set
NODE_ENV: production
```

### 2. ヘルスチェック

```bash
# サービスの健全性を確認
curl -f https://vh-fullstack-YOUR_HASH-an.a.run.app/health
```

期待する出力：
```json
{
  "status": "healthy",
  "timestamp": "2025-08-13T23:20:31.579Z",
  "uptime": 80.284951862
}
```

### 3. API接続テスト

ブラウザでアプリケーションにアクセスし：

1. **「🔗 Gemini Liveに接続」** ボタンをクリック
2. ステータスが **「Connecting」** → **「Connected」** に変化することを確認
3. エラーメッセージが表示されないことを確認

## 🐛 トラブルシューティング

### よくある問題と解決方法

#### 1. "GEMINI_API_KEY: NOT SET" エラー

**症状**: ログに `GEMINI_API_KEY: NOT SET` と表示される

**解決方法**:
- 環境変数の設定を再確認
- Cloud Runサービスの再デプロイを実行
- APIキーの形式を確認（`AIzaSy...` で始まる必要があります）

#### 2. "Failed to get Gemini config: 500" エラー

**症状**: フロントエンドで接続エラーが発生

**解決方法**:
- APIキーの有効性を確認
- Gemini Live APIの利用可能地域を確認
- 課金設定が有効化されているか確認

#### 3. "Token verification failed" エラー

**症状**: JWT検証が失敗する

**解決方法**:
- `JWT_SECRET` 環境変数も合わせて設定
- 32文字以上の安全な秘密鍵を使用

```bash
# 安全なJWT秘密鍵を生成
openssl rand -base64 64

# 環境変数として設定
gcloud run services update vh-fullstack \
  --region=asia-northeast1 \
  --project=YOUR_PROJECT_ID \
  --set-env-vars="JWT_SECRET=YOUR_GENERATED_SECRET"
```

#### 4. レート制限エラー

**症状**: "Rate limit exceeded" エラー

**解決方法**:
- APIキーの使用量制限を確認・調整
- リクエスト頻度を調整
- 必要に応じて有料プランにアップグレード

## 💰 料金に関する注意事項

### Gemini Live API 料金体系

- **音声入力**: リクエストサイズに基づく課金
- **音声出力**: 生成された音声の長さに基づく課金
- **テキスト処理**: トークン数に基づく課金

### コスト最適化のヒント

1. **開発中は短いセッションを心がける**
2. **不要な長時間接続を避ける**
3. **Billing alerts を設定する**
4. **定期的に使用量をモニタリング**

### 無料利用枠

Gemini APIには月次無料利用枠があります：
- 詳細は Google AI Studio で確認
- 利用状況は Google Cloud Console の Billing で確認

## 📞 サポート

### 追加のヘルプが必要な場合

1. **Google AI Studio ドキュメント**: https://ai.google.dev/docs
2. **Cloud Run ドキュメント**: https://cloud.google.com/run/docs
3. **このプロジェクトのIssue**: プロジェクトリポジトリで質問・報告

### デバッグ情報の収集

問題報告時には以下の情報を含めてください：

1. Cloud Runサービスのログ
2. ブラウザのConsoleエラー
3. 使用しているAPIキーの最初の4文字（セキュリティ上）
4. エラーが発生する具体的な手順

---

**注意**: APIキーは機密情報です。決してコードやログに平文で記録せず、適切なシークレット管理を行ってください。