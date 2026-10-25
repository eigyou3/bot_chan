const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const st = require('./store');
const en = require('./enka');

const COLOR = '#1D9E75';

// 案内（ボタン付き）
function panel(roleId) {
  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setDescription('加入された方は、UIDのご提示をお願いします！\nご提示が済んだらすべてのチャンネルの閲覧が可能になります✨️');
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`intro_open_${roleId}`).setLabel('ギルドにUIDを登録する').setStyle(ButtonStyle.Success)
  );
  return { embeds: [e], components: [row] };
}

// ボタン → フォーム
async function open(i) {
  const roleId = i.customId.slice(11);
  const m = new ModalBuilder().setCustomId(`intro_mdl_${roleId}`).setTitle('自己紹介');
  m.addComponents(
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('uid').setLabel('UID').setStyle(TextInputStyle.Short).setMinLength(9).setMaxLength(12).setRequired(true)
    ),
    new ActionRowBuilder().addComponents(
      new TextInputBuilder().setCustomId('msg').setLabel('ギルドのみんなへ一言').setStyle(TextInputStyle.Paragraph).setMaxLength(300).setRequired(false)
    ),
  );
  return i.showModal(m);
}

const errMsg = {
  400: 'UIDの形が正しくないみたい。もう一度確認してね。',
  404: 'そのUIDのプレイヤーが見つからなかったよ。もう一度確認してね。',
  424: '原神がメンテナンス中みたい。終わってからもう一度お願いします。',
  429: '今ちょっと混んでるみたい。少し待ってからもう一度お願いします。',
};

// フォーム送信 → カード投稿＋ロール
async function submit(i) {
  await i.deferReply({ ephemeral: true });
  const roleId = i.customId.slice(10);
  const uid = en.cleanUid(i.fields.getTextInputValue('uid'));
  if (!uid) return i.editReply(errMsg[400]);

  const { p, err } = await en.player(uid);
  if (!p) return i.editReply(errMsg[err] || '今うまく取れなかったよ。少し待ってからもう一度お願いします。');

  const msg = i.fields.getTextInputValue('msg').trim();
  const nmap = await en.names();
  const chars = (p.showAvatarInfoList || []).map(a => nmap[String(a.avatarId)]).filter(Boolean);

  const e = new EmbedBuilder()
    .setColor(COLOR)
    .setAuthor({ name: `${i.member.displayName} さんの自己紹介`, iconURL: i.user.displayAvatarURL() })
    .setTitle(p.nickname || '（名前なし）')
    .addFields(
      { name: '冒険ランク', value: String(p.level ?? '-'), inline: true },
      { name: '世界ランク', value: String(p.worldLevel ?? '-'), inline: true },
      { name: 'アチーブメント', value: String(p.finishAchievementNum ?? '-'), inline: true },
    )
    .setFooter({ text: `UID ${uid}` });
  if (p.signature) e.setDescription(`「${p.signature}」`);
  if (chars.length) e.addFields({ name: 'キャラ展示', value: chars.join(' ／ ') });
  if (msg) e.addFields({ name: 'ギルドのみんなへ一言', value: msg });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setLabel('詳しいビルドを見る').setStyle(ButtonStyle.Link).setURL(`https://enka.network/u/${uid}/`)
  );

  // 前のカードがあれば差し替え
  const d = st.get(i.guildId);
  if (!d.intro) d.intro = {};
  const old = d.intro[i.user.id];
  if (old) {
    const ch = await i.client.channels.fetch(old.ch).catch(() => null);
    if (ch) await ch.messages.delete(old.msg).catch(() => null);
  }
  const m = await i.channel.send({ embeds: [e], components: [row] });
  d.intro[i.user.id] = { ch: i.channelId, msg: m.id, uid };
  st.saveLater(i.guild, 3000);

  const role = await i.guild.roles.fetch(roleId).catch(() => null);
  let ok = true;
  if (role) ok = await i.member.roles.add(role).then(() => true).catch(() => false);

  return i.editReply(ok ? '✅ 登録したよ！ようこそ✨️' : '✅ 登録したよ！（ロールが付けられなかったので管理者に連絡してね）');
}

module.exports = { panel, open, submit };
