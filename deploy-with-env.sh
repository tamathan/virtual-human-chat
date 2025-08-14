#!/bin/bash

# Virtual Human Chat デプロイスクリプト（環境変数付き）
# GEMINI_API_KEYを永続化してデプロイ

set -e  # エラー時に停止

# 設定
PROJECT_ID="claudecode-468619"
SERVICE_NAME="vh-fullstack"
REGION="asia-northeast1"

echo "🚀 Virtual Human Chat デプロイ開始..."

# 1. フロントエンドビルド
echo "📦 フロントエンドをビルド中..."
npm run build

# 2. BFFにコピー
echo "📂 ビルド結果をBFFにコピー中..."
cp -r dist/* bff/

# 3. 現在の環境変数を取得
echo "🔍 現在の環境変数を取得中..."

# より単純な方法で環境変数を取得
ENV_OUTPUT=$(gcloud run services describe $SERVICE_NAME \
  --region=$REGION \
  --project=$PROJECT_ID \
  --format="export" 2>/dev/null || echo "")

CURRENT_GEMINI_KEY=""
CURRENT_JWT_SECRET=""

# 環境変数を解析
if echo "$ENV_OUTPUT" | grep -q "GEMINI_API_KEY"; then
  CURRENT_GEMINI_KEY=$(echo "$ENV_OUTPUT" | grep -A5 -B5 "GEMINI_API_KEY" | grep "value:" | head -1 | sed 's/.*value: //' | tr -d '"')
fi

if echo "$ENV_OUTPUT" | grep -q "JWT_SECRET"; then
  CURRENT_JWT_SECRET=$(echo "$ENV_OUTPUT" | grep -A5 -B5 "JWT_SECRET" | grep "value:" | head -1 | sed 's/.*value: //' | tr -d '"')
fi

# 4. 環境変数を設定（既存の値を保持）
ENV_VARS="NODE_ENV=production"

if [ ! -z "$CURRENT_GEMINI_KEY" ]; then
  ENV_VARS="$ENV_VARS,GEMINI_API_KEY=$CURRENT_GEMINI_KEY"
  echo "✅ GEMINI_API_KEY: 既存の値を使用"
else
  echo "⚠️  GEMINI_API_KEY: 設定されていません（手動設定が必要）"
fi

if [ ! -z "$CURRENT_JWT_SECRET" ]; then
  ENV_VARS="$ENV_VARS,JWT_SECRET=$CURRENT_JWT_SECRET"
  echo "✅ JWT_SECRET: 既存の値を使用"
else
  # JWT_SECRETを生成
  NEW_JWT_SECRET=$(openssl rand -base64 64 | tr -d '\n')
  ENV_VARS="$ENV_VARS,JWT_SECRET=$NEW_JWT_SECRET"
  echo "✅ JWT_SECRET: 新規生成"
fi

# 5. Cloud Runにデプロイ
echo "☁️  Cloud Runにデプロイ中..."
gcloud run deploy $SERVICE_NAME \
  --source ./bff \
  --region=$REGION \
  --project=$PROJECT_ID \
  --allow-unauthenticated \
  --port=8080 \
  --memory=512Mi \
  --cpu=1 \
  --max-instances=10 \
  --set-env-vars="$ENV_VARS" \
  --quiet

echo "✅ デプロイ完了！"
echo "🌐 URL: https://vh-fullstack-2lriuwtgxq-an.a.run.app"

# 6. ヘルスチェック
echo "🏥 ヘルスチェック実行中..."
sleep 5
if curl -f https://vh-fullstack-2lriuwtgxq-an.a.run.app/health > /dev/null 2>&1; then
  echo "✅ ヘルスチェック成功"
else
  echo "❌ ヘルスチェック失敗"
  exit 1
fi

echo "🎉 デプロイが完了しました！"