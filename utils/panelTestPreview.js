const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, StringSelectMenuBuilder } = require('discord.js');
const PREFIX='pt_';
const modes=['pending','on','off'];
const button=(route,label,style=ButtonStyle.Secondary)=>new ButtonBuilder().setCustomId(PREFIX+route).setLabel(label).setStyle(style);
const row=(...items)=>new ActionRowBuilder().addComponents(...items);
const menu=(kind,mode,label,entries)=>new StringSelectMenuBuilder()
  .setCustomId(PREFIX+'select_'+kind+'_'+mode).setPlaceholder(label)
  .addOptions(entries.map(([value,label])=>({label,value})));
const routes={
 notifications:['🛎️ 通知設定','通知機能を選択してください。',[['vc','🔊 VC参加通知'],['ranking','🏆 VCランキング'],['bump','🔔 Bump通知']]],
 vc:['🔊 VC参加通知','VC参加通知の設定画面（表示のみ）。',[]],
 ranking:['🏆 VCランキング','VCランキングの設定画面（表示のみ）。',[]],
 bump:['🔔 Bump通知','Bump通知の設定画面（表示のみ）。',[]],
 announce:['📢 アナウンスを作る','投稿先・本文・画像・通知ロールの設定画面（表示のみ）。',[]],
 analytics:['📊 サーバー分析','メンバー分析・VC分析の画面（表示のみ）。',[]],
 members:['👥 メンバー管理','非アクティブ管理を設定します。',[['inactive','非アクティブ管理']]],
 inactive:['👥 非アクティブ管理','判定月数・対象ロール・除外ロール・有効化／停止の設定画面（表示のみ）。',[]],
 contact:['🗨️ お問い合わせ','Bot制作者へのお問い合わせ画面（送信不可）。',[]],
 reset:['すべての設定を初期化','原神機能・通知設定・常駐パネルなどが停止・削除されます。\n登録済みUID情報・分析履歴・管理ログも削除され、取り消せません。\n\n【テストモード】初期化は実行できません。',[]],
 genshin:['🎮 原神設定','原神通知・UID登録・ビルドカード・ギフトコードの設定画面（表示のみ）。',[]],
 enable:['🎮 原神機能を有効化','初回OFFを選択した場合も、ここから後でONにできます。\n【テストモード】有効化は実行されません。',[]]
};
const back=p=>['vc','ranking','bump'].includes(p)?'notifications':p==='inactive'?'members':'home';
function render(page='home',mode='pending'){
 if(!modes.includes(mode))mode='pending';
 const target=routes[page];
 const embed=new EmbedBuilder().setColor('#5865F2');
 let components=[];
 if(!target){
  embed.setTitle('⚙️ Bot 管理パネル').setDescription('**プレビューモード** — 設定・通知・データは変更されません。'+(mode==='pending'?'\n\n**原神サーバーとして利用しますか？（初回のみ）**':''));
  components.push(row(
    button('go_'+mode+'_announce','📢 アナウンスを作る',ButtonStyle.Primary),
    button('go_'+mode+'_notifications','🛎️ 通知設定',ButtonStyle.Primary),
    ...(mode==='on'?[button('go_on_genshin','🎮 原神設定',ButtonStyle.Primary)]:[])
  ));
  if(mode==='pending')components.push(row(button('mode_on','原神設定：ON',ButtonStyle.Success),button('mode_off','原神設定：OFF',ButtonStyle.Danger)));
  components.push(row(menu('manage',mode,'📊 サーバー管理',[['analytics','📊 サーバー分析'],['members','👥 メンバー管理']])));
  components.push(row(menu('other',mode,'⚙️ その他',[
   ...(mode==='off'?[['enable','🎮 原神機能を有効化']]:[]),
   ['contact','🗨️ お問い合わせ'],['reset','すべての設定を初期化']
  ])));
  components.push(row(button('cycle_'+mode,'↻ 表示状態を切り替える')));
  embed.setFooter({text:'表示状態：'+({pending:'初回未選択',on:'原神ON',off:'原神OFF'}[mode])+'（疑似切替・保存なし）'});
 }else{
  embed.setTitle(target[0]).setDescription(target[1]+'\n\n※ 表示専用。設定の保存や投稿は行われません。');
  if(page==='reset')components.push(row(button('go_'+mode+'_home','キャンセル')));
  else{
   for(const [id,label] of target[2])components.push(row(button('go_'+mode+'_'+id,label)));
   components.push(row(button('go_'+mode+'_'+back(page),'← 戻る')));
  }
 }
 return {embeds:[embed],components,allowedMentions:{parse:[]}};
}
async function handle(i){
 if(!(i.isButton()||i.isStringSelectMenu())||!i.customId?.startsWith(PREFIX))return false;
 if(i.guildId!=='1341988738074542111'||i.user.id!==i.guild?.ownerId||i.channel?.name!=='bot-config'){
  await i.reply({content:'このテストは指定サーバーの所有者専用です。',flags:MessageFlags.Ephemeral});return true;
 }
 const id=i.customId.slice(PREFIX.length);
 let page='home',mode='pending';
 if(id.startsWith('mode_'))mode=id.slice(5);
 else if(id.startsWith('cycle_'))mode=({pending:'on',on:'off',off:'pending'})[id.slice(6)]||'pending';
 else if(id.startsWith('go_')){
  const m=id.match(/^go_(pending|on|off)_(.+)$/);
  if(m){mode=m[1];page=m[2];}
 }else if(id.startsWith('select_')){
  const m=id.match(/^select_(manage|other)_(pending|on|off)$/);
  if(m){mode=m[2];page=i.values?.[0]||'home';}
 }
 await i.update(render(page,mode));return true;
}
module.exports={render,handle};