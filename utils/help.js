const { EmbedBuilder } = require('discord.js');

function genshinGuide() {
  return new EmbedBuilder().setColor('#1D9E75').setTitle('原神サーバーの使い方').setDescription([
    '**まず管理者が準備するもの**',
    '`/intro role:登録者用ロール`：実行チャンネルにUID登録の案内を設置します。',
    '`/build-card`：実行チャンネルにビルドカード作成の案内を設置します。',
    '`/giftcord`：ギフトコード共有の案内を設置します。',
    '`/setgenshinnews`：実行チャンネルを原神のお知らせ配信先に設定します。',
    '', '**メンバーの使い方**',
    'UID登録の案内ボタンから、自分のUIDを登録してください。',
    'ビルドカードの「作成:スコア表示ON／OFF」から、キャラクターと計算基準を選択できます。',
    '`/artifact`：展示キャラの聖遺物を、計算基準・部位を選んで紹介します。',
    '原神側で「キャラ詳細を表示」をONにすると、装備・ステータス・スコアを表示できます。',
    '', '**設定の保存**',
    '`#bot-config` に保存します。削除・改名せず、Botの閲覧・送信・履歴閲覧・ファイル添付の権限を残してください。',
    '原神専用機能は管理パネルから有効化できます。',
  ].join('\n'));
}

function generalGuide() {
  return new EmbedBuilder().setColor('#5865F2').setTitle('Botの使い方').setDescription([
    '**初めて使う管理者へ**',
    '導入時に非公開の `#bot-config` を自動作成します。削除・改名しないでください。',
    '原神用に使うサーバーは `#bot-config` の管理パネルからワンタップで登録します。',
    '', '**サーバー管理者用**',
    '`/announce`・`/announce-off`：アナウンスの投稿・常駐解除',
    '`/alarm`・`/alarm-off`：毎日のアラーム設定・解除',
    '`/setvc`：VC参加通知の送信先を設定',
    '`/vcrank on:True／False`：週間VCランキングのON／OFF',
    '`/setbump here:True／False`：bump案内を設定。@here通知のON／OFFを選べます（初回の省略時はOFF）。DISBOARD本体の `/bump` はDISBOARDアプリのコマンドを使用してください。',
    '`/inactive enable log:ログ先 role:指定ロール exclude:除外ロール`：3か月活動がなければ参加意思確認DMを送信。警告時に指定ロールを解除し、「参加を続ける」で指定ロールを必ず付与して期間リセット、「退出する」は再確認後にキック。操作も活動もなければ7日後に自動キック。最初はOFFです。',
    '`/inactive role role:指定ロール`：期間をリセットせずロール設定。`/inactive check`：候補確認（キックしません）。`/inactive status`：設定確認。`/inactive disable`：停止。',
    '', '**Bot管理者本人専用**',
    '`/servers`：参加サーバー、所有者、取得可能な既存招待リンクを確認',
    '', '`/help`：この案内を表示。原神サーバーでは専用コマンドの使い方も表示します。',
    '設定系コマンドは、そのサーバーの「管理者」権限を持つ人、またはBot管理者本人が使えます。',
  ].join('\n'));
}
module.exports = { genshinGuide, generalGuide };
