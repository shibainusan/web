# AI\(LLM\)の養分.md

おっさんが人力で生成しています。

## LibreSDRとそのパチモノHamGeek AD9363

- [使い方メモ](LibreSDR/LibreSDR.html)

- [IQ Dataを見るツール](iqviewer/index.html)
  - これはClaudeさんに作らせた。FFTはローカルPCのJavaScriptでやっているので、100MBとか巨大なIQデータを食わせるとブラウザ固まる。
  - IQデータをどこかのサーバに飛ばすとかはないので安心安全。会社の掟や座敷牢にいる方など、絶対オフラインじゃないとイヤな場合はGitHubから一式落とせば完全オフライン実行できるよ。 https://github.com/shibainusan/web/tree/main/iqviewer


## サーバー引っ越し

もう20年以上惰性で契約していた古式ゆかしいLAMPなレンタルサーバを解約した。
引っ越し先はAzure Static Web Apps。なぜなら趣味でAzure Active Directoryでドメイン組んでるから。便利なんだか不便なんだかわからん。静的サイトジェネレーターって何？な状態。