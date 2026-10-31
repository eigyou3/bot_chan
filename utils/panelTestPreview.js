const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const ROOT = 'pt_';
const button = (id, label, style=ButtonStyle.Secondary) => new ButtonBuilder().setCustomId(ROOT+id).setLabel(label).setStyle(style);
const line = (...elements) => new ActionRowBuilder().addComponents(...elements);
const routes = {
  notifications: ['🛎️ 通知設定','通知機能を選んでください。', [['vc','🔊 VC参加通知'],['bump','🔔 Bump通知']]],
  vc: ['🔊 VC参加通知','通知先チャンネルの設定画面（プレビューのみ）',[]],
  bump: ['🔔 Bump通知','通知先・リマインドの設定画面（プレビューのみ）',[]],
  announce: ['📢 アナウンスを作る','投稿先・本文・画像・通知ロールを指定する画面（プレビューのみ）',[]],
  analytics: ['📊 サーバー分析','メンバー分析 → VC分析の順で表示する予定です。データの表示は今後追加します。',[]],
  members: ['👥 メンバー管理','非アクティブ管理・VCランキングなどの設定画面（プレビューのみ）', [['inactive','非アクティブ管理'],['ranking','VCランキング']]],
  inactive: ['👥 非アクティブ管理','判定期間・警告・キックの設定画面（プレビューのみ）',[]],
  ranking: ['📈 VCランキング','ランキングの設定画面（プレビューのみ）',[]],
  contact: ['🗨️ お問い合わせ','問い合わせ内容を送る画面（プレビューのみ・送信不可）',[]],
  reset: ['⚠️ すべての設定を初期化','⚠️ UID情報・分析履歴・管理ログも削除され、元に戻せません。原神の常駐パネルや通知も停止します。\n\n【テストモード】初期化は実行できません。',[]],
  genshin: ['🎮 原神サーバー：ON','有効化前の説明画面（プレビューのみ・登録不可）',[]]
};
const back = id => ['vc','bump'].includes(id) ? 'notifications' : ['inactive','ranking'].includes(id) ? 'members' : 'home';
function render(page='home') {
  const target = routes[page];
  const embed = new EmbedBuilder().setColor('#5865F2');
  let components;
  if(!target) {
    embed.setTitle('⚙️ Bot 管理パネル').setDescription('**プレビューモード**\n実際の設定やメッセージは変更されません。\n\n管理したい機能を選択してください。');
    components = [
      line(button('announce','📢 アナウンスを作る',ButtonStyle.Primary),button('notifications','🛎️ 通知設定',ButtonStyle.Primary)),
      line(button('analytics','📊 サーバー分析'),button('members','👥 メンバー管理')),
      line(button('genshin','🎮 原神サーバー：ON',ButtonStyle.Success),button('contact','🗨️ お問い合わせ')),
      line(button('reset','すべての設定を初期化',ButtonStyle.Danger))
    ];
  } else {
    embed.setTitle(target[0]).setDescription(target[1]+'\n\n※ 操作確認用の画面です。設定の保存・投稿などは行われません。');
    components = target[2].map(([id,label])=>line(button(id,label)));
    components.push(line(button(back(page),'← 戻る')));
  }
  return {embeds:[embed],components,allowedMentions:{parse:[]}};
}
async function handle(i) {
  if(!i.isButton() || !i.customId?.startsWith(ROOT)) return false;
  if(i.guildId !== '1341988738074542111' || i.user.id !== i.guild?.ownerId || i.channel?.name !== 'bot-config') {
    await i.reply({content:'このテストは指定サーバーの所有者専用です。',flags:MessageFlags.Ephemeral});
    return true;
  }
  const page=i.customId.slice(ROOT.length);
  await i.update(render(page));
  return true;
}
module.exports={render,handle};
