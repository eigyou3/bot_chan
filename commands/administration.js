const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} = require('discord.js');
const st = require('../utils/store');

const ALLOWED_USERS = ['1088369918069715024', '936419559165026304'];

// bot-config無い時の注意書き
const warn = g => st.findCh(g) ? '' : `\n⚠️ #${st.CH_NAME} が無いので再起動すると消えます`;

module.exports = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('管理用コマンド')
    .addSubcommand(sub =>
      sub.setName('announce')
        .setDescription('アナウンスを送信（文章はポップアップで入力）')
        .addRoleOption(o => o.setName('role').setDescription('付与・解除させたいロール（空欄ならボタンなし）').setRequired(false))
        .addBooleanOption(o => o.setName('sticky').setDescription('最下行に常駐（固定）させるか（デフォルト: いいえ）').setRequired(false))
    )
    .addSubcommand(sub =>
      sub.setName('alarm')
        .setDescription('毎日繰り返すアラームを設定（複数指定はスペース区切り）')
        .addStringOption(o => o.setName('times').setDescription('時刻（例: 15:30 21:00）').setRequired(true))
        .addStringOption(o => o.setName('message').setDescription('通知メッセージ').setRequired(true))
    )
    .addSubcommand(sub =>
      sub.setName('setvc')
        .setDescription('このチャンネルをVC参加の通知先に設定します')
    ),

  async execute(interaction, client) {
    if (!ALLOWED_USERS.includes(interaction.user.id)) {
      return interaction.reply({ content: 'このコマンドを実行する権限がありません。', ephemeral: true });
    }

    const sub = interaction.options.getSubcommand();
    const g = interaction.guild;
    const d = st.get(g.id);

    if (sub === 'announce') {
      const role = interaction.options.getRole('role');
      const sticky = interaction.options.getBoolean('sticky') || false;

      const modal = new ModalBuilder()
        .setCustomId(`ann_mdl_${role ? role.id : 'none'}_${sticky ? '1' : '0'}`)
        .setTitle('アナウンス内容の入力');

      const txt = new TextInputBuilder()
        .setCustomId('announce_text')
        .setLabel('案内文章（ここで普通に改行できます）')
        .setStyle(TextInputStyle.Paragraph)
        .setRequired(true);

      modal.addComponents(new ActionRowBuilder().addComponents(txt));
      return interaction.showModal(modal);
    }

    if (sub === 'alarm') {
      const msg = interaction.options.getString('message');
      const ins = interaction.options.getString('times').split(/[\s　]+/).filter(Boolean);
      const ok = [];

      for (const s of ins) {
        const m = s.trim().match(/^([0-2]?\d):([0-5]\d)$/);
        if (!m) continue;
        // 5:3 -> 05:03
        const t = `${m[1].padStart(2, '0')}:${m[2].padStart(2, '0')}`;
        if (!d.alarms.some(a => a.time === t && a.ch === interaction.channelId && a.msg === msg)) {
          d.alarms.push({ time: t, ch: interaction.channelId, msg });
        }
        ok.push(t);
      }

      if (!ok.length) {
        return interaction.reply({ content: '❌ 時刻の形式が正しくありません。「15:30」や「21:00」のように入力してください。', ephemeral: true });
      }

      await interaction.deferReply({ ephemeral: true });
      await st.save(g);
      return interaction.editReply(`⏰ 以下の時刻に毎日繰り返すアラームを設定しました。\n設定時刻: ${ok.map(t => `**${t}**`).join(', ')}${warn(g)}`);
    }

    if (sub === 'setvc') {
      d.vc = interaction.channelId;
      await interaction.deferReply({ ephemeral: true });
      await st.save(g);
      return interaction.editReply(`✅ VC参加の通知先をこのチャンネル（ <#${interaction.channelId}> ）に設定しました。${warn(g)}`);
    }
  },
};
