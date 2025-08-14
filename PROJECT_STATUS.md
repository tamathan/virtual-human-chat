# プロジェクト現状整理

## プロジェクト概要
**名前**: Virtual Human Chat  
**目的**: Gemini Live APIを使用したリアルタイム音声チャットボット  
**アーキテクチャ**: React + BFF + Firebase Hosting + Cloud Run

## 現在の技術スタック

### フロントエンド
- **Framework**: React 18.2.0 + TypeScript
- **UI**: shadcn/ui (Radix UI + Tailwind CSS)
- **状態管理**: Zustand 4.4.7
- **ビルドツール**: Vite 5.0.8
- **デプロイ先**: Firebase Hosting

### バックエンド (BFF)
- **Runtime**: Node.js + TypeScript
- **Framework**: Express 4.18.2
- **セキュリティ**: JWT認証、CORS、Helmet、Rate Limiting
- **デプロイ先**: Cloud Run (asia-northeast1)

### 外部サービス
- **AI**: Gemini Live API
- **音声処理**: Web Audio API + Audio Worklet

## プロジェクト構造
```
chatbot/
├── src/                    # フロントエンド
│   ├── components/         # React コンポーネント
│   ├── hooks/             # カスタムフック
│   ├── lib/               # ユーティリティ
│   └── store/             # Zustand ストア
├── bff/                   # Backend for Frontend
│   └── src/               # Express サーバー
├── docs/                  # ドキュメント
└── public/                # 静的ファイル
```

## 現在の開発状況

### ✅ 完了済み
- プロジェクト基本構造の構築
- React + TypeScript環境構築
- shadcn/ui セットアップ
- BFF Express サーバー基本構造
- Firebase設定ファイル
- 環境変数テンプレート

### 🔄 進行中
- 環境変数の設定完了（`.env`ファイル作成済み）
- Gemini Live API統合の準備
- AudioWorklet 実装と連携の確認（追加済み）

### ❌ 未着手
- 音声機能の実装
- JWT認証の実装
- リアルタイム通信機能
- エラーハンドリング
- テスト実装
- デプロイ

## 環境変数設定状況
- ✅ `.env`ファイル作成済み
- ✅ GEMINI_API_KEY 設定済み
- ⚠️ JWT_SECRET 要変更（セキュリティ）
- ⚠️ VITE_BFF_URL デプロイ後に更新必要

## 次のアクション
1. JWT_SECRET のセキュア化（Secret Manager へ移行しローテーション）
2. 音声機能の微調整（VADしきい値の調整、遅延最適化）
3. Gemini Live API 統合の実地テスト（本番/ステージング）
4. デプロイパイプライン構築（Cloud Run ソースデプロイ + 環境変数/シークレット設定）
5. 不要ならフロントの `TokenService.verifyToken()` 呼び出しの整理（または活用）

## 変更履歴（抜粋）
- `src/lib/audio/audio-worklet.js` を新規追加、`audio-processor.ts` から相対パスで読み込み
- `bff/server.js` に `expiresAt` を返すよう変更、`/api/auth/verify` を追加
- `docs/CHANGES.md` と `docs/AUDIO_WORKLET.md` を追加

## 開発コマンド
```bash
# フロントエンド開発
npm run dev

# BFF開発
cd bff && npm run dev

# ビルド
npm run build

# リント
npm run lint
```
