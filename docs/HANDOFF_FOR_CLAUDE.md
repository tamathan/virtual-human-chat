Virtual Human Chat — 引継ぎメモ（Claude向け）

目的
- 直近の作業内容と背景、現在地、次アクションを最短で把握できるようにまとめました。変更差分と簡易ログも残しています。

全体サマリ
- アプリ: React + TypeScript + Vite（フロント）/ Express on Cloud Run（BFF）。
- 機能: エフェメラルトークン発行 → BFF経由で Gemini Live WebSocket に接続 → 音声ストリーミング（AudioWorklet）。
- 直近対応: AudioWorklet の追加とロード方法の是正、トークンAPIのレスポンス整合、検証APIの追加、ドキュメント整備。

今回の変更点（差分）
- 追加: `src/lib/audio/audio-worklet.js`
  - 単純なRMSしきい値ベースの簡易VADとステータス更新を実装。
  - メッセージ: `audio`（Float32Array, isSpeech, energy）/ `status`（isSpeechActive, speechProbability, bufferLevel）。
- 修正: `src/lib/audio/audio-processor.ts`
  - Workletの読み込みを `new URL('./audio-worklet.js', import.meta.url)` に変更（Viteでdev/本番両対応）。
- 修正: `bff/server.js`
  - `POST /api/auth/token` / `POST /api/token` が `expiresAt` を返却するよう変更（`expiresIn`は維持）。
  - `POST /api/auth/verify` を新設（JWT検証と `jti/purpose/iat/exp`、`connectBefore` を返却）。
  - `TOKEN_CONNECT_WINDOW_SEC` を導入（デフォルト60秒）。
- 追加Docs: `docs/CHANGES.md`, `docs/AUDIO_WORKLET.md`
- 更新Docs: `PROJECT_STATUS.md`（進捗/次アクション更新）

動作確認のポイント（ローカル）
- 前提: ルート`.env`で `VITE_BFF_URL` を空（未設定）にすると、フロントは `/api` 相対でBFFに到達します。
- コマンド:
  - `cd bff && npm run dev`（BFF 8080）
  - ルートで `npm run dev`（フロント 5173）
- UIの期待挙動:
  - 接続ボタンで BFF → `POST /api/auth/token` → `GET /api/gemini/ws-url` → WS接続。
  - マイク開始で Worklet が読み込まれ、音声ステータスが更新されます（VAD/ストリーミング）。

セキュリティ注意
- `.env.production` と `bff/.env` に実キー相当の `GEMINI_API_KEY` / `JWT_SECRET` が含まれます。必ず Secret Manager 移行とキー再発行を実施してください。

既知の課題/未解決事項
- フロントの `TokenService.verifyToken()` は現状アプリフローでは必須ではない可能性あり（APIは追加済み）。使わない場合は整理検討。
- 日本語UIの一部に表示上の文字化けが見える環境があるため、文言/エンコードの再チェック推奨。

次アクション（提案順）
1) シークレット移行: Cloud Run 環境変数→Secret Manager 参照化、キー再発行。
2) 音声チューニング: VADしきい値/チャンクサイズ/間隔の実機最適化、低遅延検証。
3) デプロイ整備: README手順どおり build→`bff/dist` 同梱→Cloud Run デプロイ。`/health` と `/api/*` の稼働確認。
4) 不要コード整理: `TokenService.verifyToken()` の呼び出し有無を確認し、未使用なら削除。

作業ログ（抜粋）
- 2025-08-14: リポジトリ構成を確認（`dir`/`type`で主要ファイルを確認）。
- 2025-08-14: 欠落 `src/lib/audio/audio-worklet.js` を特定。
- 2025-08-14: Worklet 実装を追加し、`audio-processor.ts` の読み込みパスを相対URLに修正。
- 2025-08-14: BFF のトークンAPIをフロント期待に合わせて `expiresAt` を追加、`/api/auth/verify` を実装。
- 2025-08-14: ドキュメント追加（`docs/CHANGES.md`, `docs/AUDIO_WORKLET.md`）と `PROJECT_STATUS.md` 更新。

関連ファイル一覧（変更済み）
- `src/lib/audio/audio-worklet.js`
- `src/lib/audio/audio-processor.ts`
- `bff/server.js`
- `docs/CHANGES.md`
- `docs/AUDIO_WORKLET.md`
- `PROJECT_STATUS.md`

備考
- Cloud Run 本番運用時は CORS/Helmet/RateLimit は既に導入済み。CSPやHSTSなどは必要に応じて環境変数で詳細設定へ拡張可能です。

