const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ALLOWED_USERS = [
  '1088369918069715024',
  '936419559165026304',
  '834272659067895838'
];

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

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
      
      // アナウンス用のロール付与・解除ボタンの処理
      if (interaction.customId.startsWith('ann_btn_')) {
        const [_, action, roleId] = interaction.customId.split('_');
        
        if (!roleId || roleId === 'none') {
          return interaction.reply({ content: 'このボタンには連動するロールがありません。', ephemeral: true });
        }

        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        if (!role) {
          return interaction.reply({ content: '対象のロールが見つかりませんでした。', ephemeral: true });
        }

        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!member) return;

        if (action === 'add') {
          if (member.roles.cache.has(roleId)) {
            return interaction.reply({ content: `すでに <@&${roleId}> を持っています。`, ephemeral: true });
          }
          await member.roles.add(role).catch(() => null);
          return interaction.reply({ content: `✅ <@&${roleId}> を付与しました！`, ephemeral: true });
        } else if (action === 'remove') {
          if (!member.roles.cache.has(roleId)) {
            return interaction.reply({ content: `まだ <@&${roleId}> を持っていません。`, ephemeral: true });
          }
          await member.roles.remove(role).catch(() => null);
          return interaction.reply({ content: `🗑️ <@&${roleId}> を解除しました。`, ephemeral: true });
        }
        return;
      }

      // --- マッチング機能の処理 ---
      if (!client.matchingData) client.matchingData = new Map();
      let data = client.matchingData.get(interaction.message.id);

      if (!data && interaction.message.embeds.length > 0) {
        const embed = interaction.message.embeds[0];
        if (embed.title === '━━ 参戦募集 ━━') {
          const { parseAnnounceEmbed } = require('../utils/teamMaker');
          data = parseAnnounceEmbed(interaction.message);
          if (data) client.matchingData.set(interaction.message.id, data);
        }
      }

      if (!data) {
        await interaction.reply({ content: '募集データが見つからないか、復元できませんでした。新しく募集し直してください。', ephemeral: true });
        return;
      }

      if (interaction.customId === 'calc_match') {
        if (!ALLOWED_USERS.includes(interaction.user.id)) {
          await interaction.reply({ content: 'この操作を行う権限がありません。', ephemeral: true });
          return;
        }
      }

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
              .setDescription(description)
          ]
        });
        return;
      }
    }

    // --- モーダル送信の処理 ---
    if (interaction.isModalSubmit()) {
      
      if (interaction.customId.startsWith('ann_mdl_')) {
        // ID分割の狂いを完全に修正
        const parts = interaction.customId.split('_');
        const roleId = parts[2];
        const stickyFlag = parts[3];
        const isSticky = stickyFlag === '1';
        const text = interaction.fields.getTextInputValue('announce_text');

        // ロールが実在するかチェック（none以外の場合）
        if (roleId && roleId !== 'none') {
          const roleCheck = await interaction.guild.roles.fetch(roleId).catch(() => null);
          if (!roleCheck) {
            return interaction.reply({ content: '対象のロールが見つかりませんでした。', ephemeral: true });
          }
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setDescription(text);

        const components = [];
        if (roleId && roleId !== 'none') {
          const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ann_btn_add_${roleId}`).setLabel('ロールを受け取る').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ann_btn_remove_${roleId}`).setLabel('ロールを解除する').setStyle(ButtonStyle.Danger)
          );
          components.push(row);
        }

        await interaction.reply({ content: '✅ アナウンスを送信しました。', ephemeral: true });
        
        const msg = await interaction.channel.send({ embeds: [embed], components });

        if (isSticky) {
          const config = loadConfig();
          if (!config.sticky) config.sticky = {};
          config.sticky[interaction.channelId] = { messageId: msg.id, text };
          saveConfig(config);

          if (!client.stickyMap) client.stickyMap = new Map();
          client.stickyMap.set(interaction.channelId, { messageId: msg.id, text });
        }
        return;
      }

      // B. マッチングの参戦登録情報が返ってきた時の処理
      if (interaction.customId === 'modal_match_join') {
        if (!client.matchingData) client.matchingData = new Map();
        let data = client.matchingData.get(interaction.message.id);
        
        if (!data && interaction.message.embeds.length > 0) {
          const { parseAnnounceEmbed } = require('../utils/teamMaker');
          data = parseAnnounceEmbed(interaction.message);
        }

        if (!data) {
          await interaction.reply({ content: '募集データが見つかりません。もう一度募集し直してください。', ephemeral: true });
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
