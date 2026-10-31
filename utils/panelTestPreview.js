const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  StringSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const ROOT='pt_';
const testGuild='1341988738074542111';
const { isGI } = require('./gi');
const button=(id,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(ROOT+id).setLabel(label).setStyle(style);
const row=(...items)=>new ActionRowBuilder().addComponents(...items);
const screen={
 announce:['📢 アナウンスを作る','投稿先・本文・画像・通知ロールの設定画面（プレビューのみ）'],
 notifications:['🛎️ 通知設定','VC参加通知・VCランキング・Bump通知'],
 vc:['🔊 VC参加通知','通知先の設定画面（プレビューのみ）'],
 ranking:['🏆 VCランキング','ランキングの設定画面（プレビューのみ）'],
 bump:['🔔 Bump通知','Bump通知の設定画面（プレビューのみ）'],
 analytics:['📊 サーバー分析','メンバー分析・VC分析（プレビューのみ）'],
 members:['👥 メンバー管理','非アクティブ管理'],
 inactive:['👥 非アクティブ管理','判定月数・対象ロール・除外ロール・ON/OFF（プレビューのみ）'],
 genshin:['🎮 原神設定','原神通知・UID登録・ビルドカード・ギフトコード（プレビューのみ）'],
 enable:['🎮 原神機能を有効化','後から原神サーバーとして利用できます。（テスト中は変更不可）'],
 contact:['🗨️ お問い合わせ','制作者へのお問い合わせ（テスト中は送信不可）'],
 reset:['すべての設定を初期化','UID情報・分析履歴・管理ログも削除され、取り消せません。\n原神の常駐パネルや通知も停止します。\n\nテスト中は初期化できません。']
};
function choices(mode){
 return [
  ['announce','📢 アナウンスを作る','投稿先や本文・画像を設定してEmbed形式で投稿'],
  ['notifications','🛎️ 通知設定','VC参加通知・VCランキングのON/OFF・Bump通知設定'],
  ...(mode==='on'?[['genshin','🎮 原神設定','UID登録・ビルドカード・ギフトコード・原神通知の表示先を設定']]:[]),
  ['analytics','📊 サーバー分析','メンバー数とVC活動の推移'],
  ['members','👥 メンバー管理','指定の期間活動がないメンバーを管理'],
  ...(mode==='off'?[['enable','🎮 原神機能を有効化','原神サーバーとして利用する']]:[]),
  ['contact','🗨️ お問い合わせ','Bot制作者に連絡する'],
  ['reset','すべての設定を初期化','このサーバーの設定・ログを消去し、導入時の状態にリセット']
 ];
}
function back(page){
 return ['vc','ranking','bump'].includes(page)?'notifications':page==='inactive'?'members':'home';
}
function select(id,placeholder,items) {
 return new StringSelectMenuBuilder().setCustomId(ROOT+id).setPlaceholder(placeholder)
  .addOptions(items.map(([value,label,description])=>({value,label,...(description?{description}:{})})));
}
function render(page='home',mode='pending') {
 if(!screen[page])page='home';
 const container=new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(page==='home'?'## ⚙️ Bot 管理パネル':'## '+screen[page][0])
 );
 if(page==='home'){
  if(mode==='pending'){
   container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**原神サーバーとして利用しますか？**'));
   container.addActionRowComponents(row(button('gen_on','原神設定：ON',ButtonStyle.Success),button('gen_off','原神設定：OFF',ButtonStyle.Danger)));
  }
  container.addActionRowComponents(row(select('pick','機能を選択してください',choices(mode))));

 }else{
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(screen[page][1]));
  const next=page==='notifications'?[['vc','🔊 VC参加通知'],['ranking','🏆 VCランキング'],['bump','🔔 Bump通知']]:
    page==='members'?[['inactive','非アクティブ管理']]:[];
  if(next.length)container.addActionRowComponents(row(select('sub','設定項目を選択',next)));
  container.addActionRowComponents(row(button('back_'+back(page),'← 戻る')));
 }
 return {components:[container],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}
async function handle(i){
 if(!(i.isButton()||i.isStringSelectMenu())||!i.customId?.startsWith(ROOT))return false;
 if(i.guildId!==testGuild||i.user.id!==i.guild?.ownerId||i.channel?.name!=='bot-config'){
  await i.reply({content:'このテストは指定サーバーの所有者専用です。',flags:MessageFlags.Ephemeral});return true;
 }
 const id=i.customId.slice(ROOT.length);
 const mode=isGI(i.guildId)?'on':'pending';
 if(id==='gen_on'||id==='gen_off'){
  await i.reply({content:'現在のテストでは原神の登録状態を変更しません。',flags:MessageFlags.Ephemeral});return true;
 }
 let page='home';
 if(id==='pick'||id==='sub')page=i.values?.[0]||'home';
 else if(id.startsWith('back_'))page=id.slice(5);
 await i.update(render(page,mode));return true;
}
module.exports={render,handle};
