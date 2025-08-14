# SRS-06: フロントエンド・BFF接続問題の分析と解決要件

**作成日**: 2025-08-13  
**バージョン**: 1.0  
**ステータス**: Draft  

## 1. 問題の概要

### 1.1 現在の状況
- **デプロイ済み環境**:
  - Frontend: Firebase Hosting
  - BFF: Cloud Run (asia-northeast1)
  - BFF URL: `https://vh-bff-233325584518.asia-northeast1.run.app`

### 1.2 発生している問題
**メイン問題**: フロントエンドがBFFのAPIエンドポイントへのリクエストで HTMLレスポンスを受信
- エラーメッセージ: `'<!doctype "... is not valid JSON'`
- 原因: API リクエストがFirebase HostingのSPAフォールバック（index.html）にルーティングされている

### 1.3 影響範囲
- JWT認証トークン取得API (`/api/auth/token`) が使用不可
- Gemini Live API WebSocket URL取得API (`/api/gemini/ws-url`) が使用不可
- 音声チャット機能が完全に動作不能

## 2. 根本原因分析

### 2.1 環境変数の問題
**VITE_BFF_URL がproductionビルドで適用されない理由:**

1. **ビルド時の環境変数読み込み問題**:
   ```javascript
   // src/lib/api/token-service.ts (Line 20)
   private static readonly API_BASE = import.meta.env.VITE_BFF_URL ? `${import.meta.env.VITE_BFF_URL}/api` : '/api'
   ```
   - Viteは**ビルド時**に環境変数を埋め込む
   - `.env.production`ファイルの存在確認が必要

2. **デプロイスクリプトの環境変数設定**:
   ```bash
   # deploy-hosting.sh (Line 79-82)
   cat > .env.production.local << EOF
   VITE_BFF_URL=${VITE_BFF_URL}
   NODE_ENV=production
   EOF
   ```
   - `.env.production.local`は作成されるが、Viteが正しく読み込んでいない可能性

### 2.2 Firebase Hosting設定の問題
**firebase.json の設定競合:**

```json
{
  "rewrites": [
    {
      "source": "**",
      "destination": "/index.html"
    }
  ]
}
```

**問題点:**
- 全てのリクエスト（`/api/**`を含む）がindex.htmlにリダイレクト
- APIプロキシ設定が存在しない
- SPAフォールバックが API リクエストを誤ってキャッチ

### 2.3 CORS設定の分析
**BFF側CORS設定:**
```javascript
// bff/server.js (Line 41-44)
app.use(cors({
  origin: true,
  credentials: true
}));
```

**Firebase Hosting CSP設定:**
```json
{
  "key": "Content-Security-Policy",
  "value": "connect-src 'self' wss://generativelanguage.googleapis.com https://*.web.app https://*.cloudfunctions.net https://*.run.app;"
}
```

**評価**: CORS設定は適切だが、リクエスト自体がBFFに到達していない

## 3. 解決要件

### 3.1 機能要件 (FR)

#### FR-06-01: 環境変数の確実な適用
**要件**: Production ビルド時にVITE_BFF_URLが確実に埋め込まれること
- **受け入れ基準**:
  - ビルド後の`dist/assets/*.js`ファイルにBFF URLが埋め込まれている
  - `import.meta.env.VITE_BFF_URL`が正しい値を返す
  - 開発者ツールのNetworkタブでBFF URLへのリクエストが確認できる

#### FR-06-02: Firebase Hosting API プロキシ設定
**要件**: Firebase HostingがAPI リクエストをBFFに正しく転送すること
- **受け入れ基準**:
  - `/api/**` パスがBFFにプロキシされる
  - SPAフォールバックがAPI リクエストに干渉しない
  - CORS設定が維持される

#### FR-06-03: API接続の確認機能
**要件**: デプロイ後にBFF接続を自動確認できること
- **受け入れ基準**:
  - デプロイスクリプトがヘルスチェックを実行
  - 接続失敗時に明確なエラーメッセージを表示
  - BFF URLの到達可能性を検証

### 3.2 非機能要件 (NFR)

#### NFR-06-01: デプロイの信頼性
- **可用性**: デプロイ後即座にAPI接続が機能すること
- **監視**: 接続失敗を早期発見できること

#### NFR-06-02: 開発効率
- **デバッガビリティ**: 環境変数の値を簡単に確認できること
- **再現性**: 問題を開発環境で再現できること

## 4. 推奨ソリューション

### 4.1 即効性のある解決策

#### 解決策A: Firebase Hosting rewrites 設定修正
```json
{
  "rewrites": [
    {
      "source": "/api/**",
      "destination": "https://vh-bff-233325584518.asia-northeast1.run.app/api/**"
    },
    {
      "source": "**",
      "destination": "/index.html"
    }
  ]
}
```

**メリット**: API プロキシをFirebase Hostingレベルで実現
**デメリット**: BFF URLのハードコーディングが必要

#### 解決策B: 環境変数読み込み方式の変更
```bash
# deploy-hosting.sh の修正
echo "VITE_BFF_URL=${VITE_BFF_URL}" > .env.production
NODE_ENV=production VITE_BFF_URL=${VITE_BFF_URL} npm run build
```

**メリット**: 既存のコードを最小限の変更で修正
**デメリット**: ビルドプロセスの複雑化

### 4.2 長期的な改善策

#### 改善策A: 設定管理の統合
- Firebase Remote Config を使用した動的設定
- ランタイム設定読み込みの実装

#### 改善策B: モニタリング強化
- Firebase Performance Monitoring の導入
- API接続状況の可視化

## 5. 実装計画

### 5.1 Phase 1: 緊急修正 (優先度: High)
1. **firebase.json の rewrites 設定修正** (30分)
2. **デプロイスクリプトの環境変数処理修正** (30分)
3. **動作確認とテスト** (30分)

### 5.2 Phase 2: 検証強化 (優先度: Medium)
1. **ヘルスチェック機能の改善** (1時間)
2. **環境変数確認コマンドの追加** (30分)
3. **エラーハンドリングの改善** (1時間)

### 5.3 Phase 3: 長期改善 (優先度: Low)
1. **設定管理システムの導入** (4時間)
2. **モニタリング機能の追加** (2時間)

## 6. テスト計画

### 6.1 修正確認テスト
```bash
# 1. 環境変数の確認
npm run build
grep -r "vh-bff-233325584518" dist/

# 2. API接続テスト  
curl -X POST https://virtual-human-chat-app.web.app/api/auth/token

# 3. ヘルスチェック
curl https://virtual-human-chat-app.web.app/api/../health
```

### 6.2 回帰テスト
- SPAルーティングの動作確認
- 静的ファイルの配信確認
- セキュリティヘッダーの確認

## 7. 未解決課題

### 7.1 技術的課題
- **Q1**: Firebase Hosting の rewrites でワイルドカード転送は正常に動作するか？
- **Q2**: BFF URL の動的設定は将来的に必要か？

### 7.2 運用課題  
- **Q3**: API接続失敗時の自動復旧機能は必要か？
- **Q4**: 複数環境（staging/production）の設定管理方針は？

## 8. 受け入れ基準

### 8.1 必須条件
- [ ] `/api/auth/token` エンドポイントが正常にJSONレスポンスを返す
- [ ] `/api/gemini/ws-url` エンドポイントが認証済みリクエストで動作する  
- [ ] SPAフォールバック（非API パス）が正常に動作する
- [ ] デプロイスクリプトがAPI接続を自動確認する

### 8.2 品質基準
- [ ] APIレスポンス時間 < 500ms
- [ ] エラー発生時に適切なHTTPステータスコードを返す
- [ ] CORS設定が維持される
- [ ] セキュリティヘッダーが適用される

---

**次のアクション**: Phase 1の緊急修正実装を推奨
**責任者**: team-orchestrator エージェント
**期限**: 即日対応必要