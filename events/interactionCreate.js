const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const ALLOWED_USERS = [
  '1088369918069715024',
  '936419559165026304'
];

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    
    // --- スラッシュコマンドの処理 ---
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try {
        await command.execute(interaction, client);
      } catch (error) {
        console.error('コマンド実行エラー:', error);
        await interaction.reply({ content: 'コマンドの実行中にエラーが発生しました。', ephemeral: true }).catch(() => null);
      }
      return;
    }

    // --- ボタン入力の処理 ---
    if (interaction.isButton()) {
      if (!client.matchingData) client.matchingData = new Map();
      const data = client.matchingData.get(interaction.message.id);

      if (!data) {
        await interaction.reply({ content: '募集データが見つかりません。', ephemeral: true });
        return;
      }

      // 管理者専用ボタン（赤ボタン）の権限チェック
      if (interaction.customId === 'calc_match') {
        if (!ALLOWED_USERS.includes(interaction.user.id)) {
          await interaction.reply({ content: 'この操作を行う権限がありません。', ephemeral: true });
          return;
        }
      }

      // 1. 参加する
      if (interaction.customId === 'join_match') {
        const exists = data.participants.some(p => p.id === interaction.user.id);
        if (exists) {
          await interaction.reply({ content: '既に登録されています。', ephemeral: true });
          return;
        }

        const modal = new ModalBuilder().setCustomId('modal_match_join').setTitle('参戦登録');
        const powerInput = new TextInputBuilder().setCustomId('input_power').setLabel('戦力（例: 23.5M、2350万）').setStyle(TextInputStyle.Short).setRequired(true);
        const jobInput = new TextInputBuilder().setCustomId('input_job').setLabel('ジョブ・役職（自由入力）').setStyle(TextInputStyle.Short).setRequired(false);
        
        modal.addComponents(new ActionRowBuilder().addComponents(powerInput), new ActionRowBuilder().addComponents(jobInput));
        await interaction.showModal(modal);
        return;
      }

      // 2. 削除する
      if (interaction.customId === 'leave_match') {
        const initialLength = data.participants.length;
        data.participants = data.participants.filter(p => p.id !== interaction.user.id);

        if (data.participants.length === initialLength) {
          await interaction.reply({ content: '登録されていません。', ephemeral: true });
          return;
        }

        client.matchingData.set(interaction.message.id, data);
        const { buildAnnounceEmbed } = require('../utils/teamMaker');
        await interaction.message.edit({ embeds: [buildAnnounceEmbed(data)] });
        await interaction.reply({ content: '参戦を辞退しました。', ephemeral: true });
        return;
      }

      // 3. 集計（管理者のみ）
      if (interaction.customId === 'calc_match') {
        if (data.participants.length === 0) {
          await interaction.reply({ content: '参加者がいません。', ephemeral: true });
          return;
        }

        const { makeTeams, formatPower } = require('../utils/teamMaker');
        const { teams, remainderMembers } = makeTeams(data.participants, data.sortMethod);

        let description = `集計方法：**${data.sortLabel}**\n\n`;
        teams.forEach((team, i) => {
          const total = team.reduce((s, p) => s + p.power, 0);
          const members = team.map(p => `${p.name}┃${formatPower(p.power)}┃${p.job}`).join('\n');
          description += `**チーム${i + 1}**（総戦力：${formatPower(total)}）\n${members}\n\n`;
        });
        
        if (remainderMembers.length > 0) {
          const members = remainderMembers.map(p => `${p.name}┃${formatPower(p.power)}┃${p.job}`).join('\n');
          description += `**⚠️ 余り（人数が足りません）**\n${members}`;
        }

        await interaction.reply({
          embeds: [
            new EmbedBuilder()
              .setColor('#5865F2')
              .setAuthor({ name: data.authorTag, iconURL: data.authorAvatar })
              .setDescription(description)
          ]
        });
        return;
      }
    }

    // --- モーダル送信の処理 ---
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'modal_match_join') {
        if (!client.matchingData) client.matchingData = new Map();
        const data = client.matchingData.get(interaction.message.id);
        if (!data) {
          await interaction.reply({ content: '募集データが見つかりません。', ephemeral: true });
          return;
        }

        const rawPower = interaction.fields.getTextInputValue('input_power');
        const job = interaction.fields.getTextInputValue('input_job') || '未設定';
        const { parsePower, buildAnnounceEmbed } = require('../utils/teamMaker');
        const power = parsePower(rawPower);

        data.participants.push({ id: interaction.user.id, name: interaction.user.username, power, job });
        client.matchingData.set(interaction.message.id, data);
        await interaction.message.edit({ embeds: [buildAnnounceEmbed(data)] });
        await interaction.reply({ content: '参戦登録が完了しました！', ephemeral: true });
        return;
      }
    }
  },
};