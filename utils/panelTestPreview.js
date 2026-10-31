const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  StringSelectMenuBuilder, ContainerBuilder, TextDisplayBuilder } = require('discord.js');
const ROOT='pt_';
const testGuild='1341988738074542111';
const states=['pending','on','off'];
const layouts=['select','buttons'];
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
  ['announce','📢 アナウンスを作る','投稿先・本文・画像を設定して投稿'],
  ['notifications','🛎️ 通知設定','VC参加通知・ランキング・Bump'],
  ...(mode==='on'?[['genshin','🎮 原神設定','UID登録・ビルドカード・原神通知']]:[]),
  ['analytics','📊 サーバー分析','メンバー数とVC活動の推移'],
  ['members','👥 メンバー管理','非アクティブ管理'],
  ...(mode==='off'?[['enable','🎮 原神機能を有効化','原神サーバーとして利用する']]:[]),
  ['contact','🗨️ お問い合わせ','Bot制作者に連絡する'],
  ['reset','すべての設定を初期化','設定・UID・分析履歴などを削除']
 ];
}
function back(page){
 return ['vc','ranking','bump'].includes(page)?'notifications':page==='inactive'?'members':'home';
}
function select(id,placeholder,items) {
 return new StringSelectMenuBuilder().setCustomId(ROOT+id).setPlaceholder(placeholder)
  .addOptions(items.map(([value,label,description])=>({value,label,...(description?{description}:{})})));
}
function render(page='home',mode='pending',layout='select'){
 if(!states.includes(mode))mode='pending';
 if(!layouts.includes(layout))layout='select';
 if(!screen[page])page='home';
 const container=new ContainerBuilder().addTextDisplayComponents(
  new TextDisplayBuilder().setContent(page==='home'?'## ⚙️ Bot 管理パネル':'## '+screen[page][0])
 );
 if(page==='home'){
  if(mode==='pending'){
   container.addTextDisplayComponents(new TextDisplayBuilder().setContent('**原神サーバーとして利用しますか？**\n-# 初回のみの選択です。設定は保存されません。'));
   container.addActionRowComponents(row(button('mode_on_'+layout,'原神設定：ON',ButtonStyle.Success),button('mode_off_'+layout,'原神設定：OFF',ButtonStyle.Danger)));
  }
  if(layout==='select'){
   container.addActionRowComponents(row(select('pick_'+mode+'_'+layout,'機能を選択してください',choices(mode))));
  }else{
   container.addActionRowComponents(row(
     button('go_'+mode+'_'+layout+'_announce','📢 アナウンスを作る',ButtonStyle.Primary),
     button('go_'+mode+'_'+layout+'_notifications','🛎️ 通知設定',ButtonStyle.Primary),
     ...(mode==='on'?[button('go_on_buttons_genshin','🎮 原神設定',ButtonStyle.Primary)]:[])
   ));
   container.addActionRowComponents(row(button('go_'+mode+'_'+layout+'_analytics','📊 サーバー分析'),button('go_'+mode+'_'+layout+'_members','👥 メンバー管理')));
   container.addActionRowComponents(row(button('go_'+mode+'_'+layout+'_contact','🗨️ お問い合わせ'),...(mode==='off'?[button('go_off_buttons_enable','🎮 原神を有効化')]:[])));
   container.addActionRowComponents(row(button('go_'+mode+'_'+layout+'_reset','すべての設定を初期化',ButtonStyle.Danger)));
  }
  container.addActionRowComponents(row(button('layout_'+mode+'_'+layout,layout==='select'?'ボタン形式を比較':'メニュー形式を比較')));
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent('-# 表示確認用 · 原神：'+({pending:'初回未選択',on:'ON',off:'OFF'}[mode])+' · 実際の設定は変更されません。'));
  if(mode!=='pending')container.addActionRowComponents(row(button('cycle_'+mode+'_'+layout,'原神の表示状態を切り替える')));
 }else{
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(screen[page][1]));
  const next=page==='notifications'?[['vc','🔊 VC参加通知'],['ranking','🏆 VCランキング'],['bump','🔔 Bump通知']]:
    page==='members'?[['inactive','非アクティブ管理']]:[];
  if(next.length)container.addActionRowComponents(row(select('sub_'+mode+'_'+layout,'設定項目を選択',next)));
  container.addActionRowComponents(row(button('go_'+mode+'_'+layout+'_'+back(page),'← 戻る')));
 }
 return {components:[container],flags:MessageFlags.IsComponentsV2,allowedMentions:{parse:[]}};
}
async function handle(i){
 if(!(i.isButton()||i.isStringSelectMenu())||!i.customId?.startsWith(ROOT))return false;
 if(i.guildId!==testGuild||i.user.id!==i.guild?.ownerId||i.channel?.name!=='bot-config'){
  await i.reply({content:'このテストは指定サーバーの所有者専用です。',flags:MessageFlags.Ephemeral});return true;
 }
 const id=i.customId.slice(ROOT.length);
 let mode='pending',layout='select',page='home';
 let m;
 if((m=id.match(/^mode_(on|off)_(select|buttons)$/)))mode=m[1],layout=m[2];
 else if((m=id.match(/^cycle_(pending|on|off)_(select|buttons)$/)))mode=({pending:'on',on:'off',off:'pending'})[m[1]],layout=m[2];
 else if((m=id.match(/^layout_(pending|on|off)_(select|buttons)$/)))mode=m[1],layout=m[2]==='select'?'buttons':'select';
 else if((m=id.match(/^go_(pending|on|off)_(select|buttons)_(\w+)$/)))mode=m[1],layout=m[2],page=m[3];
 else if((m=id.match(/^(?:pick|sub)_(pending|on|off)_(select|buttons)$/)))mode=m[1],layout=m[2],page=i.values?.[0]||'home';
 await i.update(render(page,mode,layout));return true;
}
module.exports={render,handle};