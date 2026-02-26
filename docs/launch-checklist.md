# Gomical Launch Checklist

## Pre-Launch (1週間前)

- [ ] アプリ名「ゴミカル」の商標検索（J-PlatPat: https://www.j-platpat.inpit.go.jp/）
- [ ] プライバシーポリシーをWebページとして公開（GitHub Pages / Notion等）
- [ ] 利用規約をWebページとして公開
- [ ] Google Play Developer登録（$25）
- [ ] Apple Developer Program登録（$99/年）
- [ ] EAS Projectにリンク: `eas init`
- [ ] app.jsonのextra.eas.projectIdを設定
- [ ] 実機でフル動作確認（Android + iOS）

## Build & Submit

### Android
```bash
eas build --platform android --profile production
eas submit --platform android --profile production
```

### iOS
```bash
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## Store Listing

- [ ] アプリアイコン（1024x1024）をアップロード
- [ ] スクリーンショット（各解像度）を用意・アップロード
  - iPhone 6.7" (1290x2796)
  - iPhone 6.1" (1179x2556)
  - Android phone (1080x1920+)
- [ ] フィーチャーグラフィック（Google Play: 1024x500）
- [ ] ストア説明文を設定（docs/store-listing.md参照）
- [ ] カテゴリ: ライフスタイル / ユーティリティ
- [ ] 対象年齢: 13歳以上
- [ ] Data Safety / App Privacy Labels を申告

## Post-Launch マーケティング

### Week 1: 初期認知
- [ ] X/Twitter アカウント作成（@gomical_app等）
- [ ] 初回投稿: アプリ公開のお知らせ
- [ ] Zennに技術記事投稿: 「個人開発でごみアプリを作ってストアに公開した話」
- [ ] Product Huntに投稿

### Week 2-4: 拡散
- [ ] Reddit投稿: r/japanlife, r/movingtojapan
- [ ] キャラクターを使った「今日のごみの日」定期投稿開始
- [ ] 対応自治体のユーザからのフィードバック収集開始
- [ ] Qiitaに技術記事: 「Expo + React Nativeで通知カレンダーアプリ」

### Month 2+: 継続
- [ ] ユーザリクエストに基づき自治体データ追加
- [ ] App Store / Google Playのレビュー返信
- [ ] SNS定期投稿の継続（週2-3回）
- [ ] 外国人コミュニティ（Facebook等）で告知

## KPIトラッキング

| 指標 | 1ヶ月目標 | 3ヶ月目標 |
|------|----------|----------|
| ダウンロード | 100 | 1,000 |
| DAU | 20 | 200 |
| レビュー数 | 5 | 30 |
| 平均評価 | 4.0+ | 4.0+ |
| 対応自治体数 | 3 | 10 |
