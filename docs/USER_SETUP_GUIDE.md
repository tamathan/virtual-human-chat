# 🚀 Virtual Human Chat - ユーザーセットアップガイド

このガイドでは、Virtual Human Chatを本番環境で動作させるために必要な設定手順を説明します。

## 📋 前提条件

- Google Cloudアカウント
- 課金設定が有効化されたGCPプロジェクト
- ブラウザ（Chrome または Edge を推奨）

## 🎯 セットアップ手順

### ステップ1: Gemini API キーの取得

1. **Google AI Studio にアクセス**
   - URL: https://aistudio.google.com/
   - Googleアカウントでログイン

2. **APIキーを生成**
   - 右上の **「Get API key」** をクリック
   - **「Create API key」** を選択
   - 既存のGCPプロジェクトを選択、または新規作成
   - 生成されたAPIキー（`AIzaSy...` で始まる文字列）をコピー

3. **APIの有効化確認**
   ```bash
   # 以下のコマンドを実行（Google Cloud CLIが必要）
   gcloud services enable aiplatform.googleapis.com --project=YOUR_PROJECT_ID
   gcloud services enable generativelanguage.googleapis.com --project=YOUR_PROJECT_ID
   ```

### ステップ2: Cloud Run での環境変数設定

#### 方法A: Google Cloud Console を使用（推奨）

1. **Cloud Console にアクセス**
   - URL: https://console.cloud.google.com/run
   - プロジェクトを選択

2. **サービスを編集**
   - `vh-fullstack` サービスを選択
   - **「編集してから新しいリビジョンをデプロイ」** をクリック

3. **環境変数を設定**
   - **「変数とシークレット」** タブを選択
   - **「環境変数を追加」** をクリック
   - 以下を入力：
     - **名前**: `GEMINI_API_KEY`
     - **値**: ステップ1で取得したAPIキー
   - **「デプロイ」** をクリック

#### 方法B: gcloud CLI を使用

```bash
# APIキーを環境変数として設定
gcloud run services update vh-fullstack \
  --region=asia-northeast1 \
  --project=YOUR_PROJECT_ID \
  --set-env-vars="GEMINI_API_KEY=YOUR_GEMINI_API_KEY_HERE"
```

### ステップ3: 設定確認

1. **デプロイ完了を確認**
   - Google Cloud Console で新しいリビジョンがデプロイされるまで待機（通常1-2分）

2. **ヘルスチェック**
   ```bash
   curl https://vh-fullstack-2lriuwtgxq-an.a.run.app/health
   ```
   期待する結果：
   ```json
   {
     "status": "healthy",
     "timestamp": "2025-08-13T23:20:31.579Z",
     "uptime": 80.284951862
   }
   ```

3. **サービスログ確認**
   - Cloud Console → Cloud Run → vh-fullstack → ログ
   - 以下のようなメッセージを確認：
   ```
   Environment variables status:
   GEMINI_API_KEY: Set (AIzaSyDRmB...)
   JWT_SECRET: Set
   NODE_ENV: production
   ```

## 🎮 アプリケーションの使用方法

### 初回利用

1. **アプリケーションにアクセス**
   - URL: https://vh-fullstack-2lriuwtgxq-an.a.run.app
   - ブラウザでページが正常に読み込まれることを確認

2. **接続テスト**
   - **「🔗 Gemini Liveに接続」** ボタンをクリック
   - ステータスが **「Connecting」** → **「Connected」** に変化することを確認

3. **マイク権限の設定**
   - 初回利用時、ブラウザがマイク権限を求めます
   - **「許可」** をクリックしてマイクアクセスを有効化

### 音声会話の開始

1. **会話開始**
   - **「🎤 Mic」** ボタンをクリック
   - ボタンが赤色に変わり、録音が開始されます

2. **音声入力**
   - マイクに向かって話しかけてください
   - 「こんにちは」「今日の天気はどうですか？」など

3. **AI応答**
   - 話し終わったら再度 **「🎤 Mic」** ボタンをクリック
   - AIが音声で応答します（約1-3秒で開始）

4. **会話の継続**
   - 必要に応じて上記を繰り返し、自然な会話を楽しんでください

## 🔧 トラブルシューティング

### よくある問題

#### 1. "GEMINI_API_KEY: NOT SET" エラー

**症状**: 接続ボタンを押しても接続できない

**解決方法**:
- ステップ2の環境変数設定を再確認
- APIキーが正しい形式（`AIzaSy...`で始まる）か確認
- Cloud Runサービスの新しいリビジョンがデプロイされているか確認

#### 2. 音声が録音されない

**症状**: マイクボタンを押しても録音が開始されない

**解決方法**:
- ブラウザのマイク権限を確認
- HTTPS接続であることを確認（http:// ではなく https://）
- Chrome または Edge ブラウザを使用

#### 3. 音声が再生されない

**症状**: AIからの応答が聞こえない

**解決方法**:
- ブラウザの音量設定を確認
- スピーカー/ヘッドホンの接続を確認
- ブラウザの自動再生設定を確認

#### 4. 接続が頻繁に切れる

**症状**: 会話中に接続が切れる

**解決方法**:
- インターネット接続の安定性を確認
- ブラウザのタブを他のページに切り替えないようにする
- ページを更新して再接続

## 💰 コストに関する注意事項

### Gemini Live API の料金

- **音声入力**: 送信されたオーディオデータ量に基づく課金
- **音声出力**: 生成された音声の長さに基づく課金
- **テキスト処理**: 使用されたトークン数に基づく課金

### コスト節約のヒント

1. **短時間の利用**: 長時間の連続接続を避ける
2. **必要時のみ接続**: 使用しない時は切断する
3. **予算アラート**: Google Cloud で予算アラートを設定
4. **使用量監視**: 定期的に利用状況をチェック

### 無料利用枠

- Gemini APIには月次無料利用枠があります
- 詳細は Google AI Studio で確認してください

## 📞 サポート

### 問題が解決しない場合

1. **エラーメッセージの確認**
   - ブラウザの開発者ツール（F12）でConsoleを確認
   - 具体的なエラーメッセージをメモ

2. **サービス状態の確認**
   - Cloud Run サービスが正常に動作しているか確認
   - ログでエラーが発生していないか確認

3. **システム要件の確認**
   - 対応ブラウザ（Chrome/Edge）を使用しているか
   - マイクとスピーカーが正常に動作するか

### 参考リンク

- **Google AI Studio**: https://aistudio.google.com/
- **Cloud Run ドキュメント**: https://cloud.google.com/run/docs
- **Gemini API ドキュメント**: https://ai.google.dev/docs

---

## 🏆 成功の確認

以下がすべて動作すれば、セットアップ完了です：

- [ ] アプリケーションページが正常に読み込まれる
- [ ] 「接続」ボタンで Gemini Live API に接続できる
- [ ] マイクボタンで音声録音が開始される
- [ ] AIから音声応答が返ってくる
- [ ] 連続的な会話ができる

**おめでとうございます！** Virtual Human Chat をお楽しみください 🎉