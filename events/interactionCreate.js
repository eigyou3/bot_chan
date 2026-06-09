const { EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');
const ALLOWED_USERS = ['1088369918069715024', '936419559165026304', '834272659067895838'];

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}
function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
}

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try { await command.execute(interaction, client); } catch (error) { console.error(error); }
      return;
    }

    if (interaction.isButton()) {
      // アナウンスボタンの処理
      if (interaction.customId.startsWith('ann_btn_')) {
        const [_, __, action, roleId] = interaction.customId.split('_');
        const role = await interaction.guild.roles.fetch(roleId).catch(() => null);
        const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!role || !member) return interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });

        if (action === 'add') {
          await member.roles.add(role).catch(() => null);
          return interaction.reply({ content: `✅ <@&${roleId}> を付与しました！`, ephemeral: true });
        } else {
          await member.roles.remove(role).catch(() => null);
          return interaction.reply({ content: `🗑️ <@&${roleId}> を解除しました。`, ephemeral: true });
        }
      }

      // マッチングボタンの処理
      if (!client.matchingData) client.matchingData = new Map();
      // 💡 メッセージIDではなく、チャンネルIDを鍵にしてデータを取得します
      let data = client.matchingData.get(interaction.channelId);
      
      if (!data) return interaction.reply({ content: '募集データが見つかりません。新しくコマンドを実行し直してください。', ephemeral: true });

      // 1. 参加
      if (interaction.customId === 'join_match') {
        const exists = data.participants.some(p => p.id === interaction.user.id);
        if (exists) return interaction.reply({ content: '既に登録されています。', ephemeral: true });

        const modal = new ModalBuilder().setCustomId('modal_match_join').setTitle('参戦登録');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_power').setLabel('戦力（例: 23.5M）').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_job').setLabel('ジョブ・役職').setStyle(TextInputStyle.Short).setRequired(false))
        );
        return await interaction.showModal(modal);
      }

      // 2. 削除
      if (interaction.customId === 'leave_match') {
        data.participants = data.participants.filter(p => p.id !== interaction.user.id);
        const { buildAnnounceEmbed } = require('../utils/teamMaker');
        await interaction.deferUpdate();
        await interaction.message.edit({ embeds: [buildAnnounceEmbed(data)] });
        return;
      }

      // 3. 戦力変更
      if (interaction.customId === 'edit_power') {
        const participant = data.participants.find(p => p.id === interaction.user.id);
        if (!participant) {
          return await interaction.reply({ content: '❌ まだ参加登録されていません。「参加する」ボタンから登録してください。', ephemeral: true });
        }

        const modal = new ModalBuilder().setCustomId('modal_match_edit').setTitle('戦力変更');
        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('input_power').setLabel('新しい戦力').setStyle(TextInputStyle.Short).setValue(participant.power.toString()).setRequired(true))
        );
        return await interaction.showModal(modal);
      }

      // 4. 集計方法変更
      if (interaction.customId === 'change_method') {
        if (!ALLOWED_USERS.includes(interaction.user.id)) return interaction.reply({ content: '権限がありません。', ephemeral: true });
        data.sortMethod = data.sortMethod === 'snake' ? 'balance' : 'snake';
        data.sortLabel = data.sortMethod === 'snake' ? 'スネーク方式' : '平均化方式';
        
        const { buildAnnounceEmbed } = require('../utils/teamMaker');
        await interaction.deferUpdate();
        await interaction.message.edit({ embeds: [buildAnnounceEmbed(data)] });
        return;
      }

      // 5. 集計
      if (interaction.customId === 'calc_match') {
        if (!ALLOWED_USERS.includes(interaction.user.id)) return interaction.reply({ content: '権限がありません。', ephemeral: true });
        if (data.participants.length === 0) return interaction.reply({ content: '参加者がいません。', ephemeral: true });

        const { makeTeams, formatPower } = require('../utils/teamMaker');
        const { teams, remainderMembers } = makeTeams(data.participants, data.sortMethod);
        let desc = `集計方法：**${data.sortLabel}**\n\n`;
        teams.forEach((team, i) => {
          const total = team.reduce((s, p) => s + p.power, 0);
          const members = team.map(p => `${p.name}┃${formatPower(p.power)}┃${p.job}`).join('\n');
          desc += `**チーム${i + 1}**（総戦力：${formatPower(total)}）\n${members}\n\n`;
        });
        await interaction.reply({ embeds: [new EmbedBuilder().setColor('#5865F2').setDescription(desc)] });
        return;
      }
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId.startsWith('ann_mdl_')) {
        const parts = interaction.customId.split('_');
        const roleId = parts[2];
        const isSticky = parts[3] === '1';
        const text = interaction.fields.getTextInputValue('announce_text');

        const embed = new EmbedBuilder().setColor('#5865F2').setDescription(text);
        const row = new ActionRowBuilder();
        if (roleId !== 'none') {
          row.addComponents(
            new ButtonBuilder().setCustomId(`ann_btn_add_${roleId}`).setLabel('ロールを受け取る').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ann_btn_remove_${roleId}`).setLabel('ロールを解除する').setStyle(ButtonStyle.Danger)
          );
        }

        await interaction.reply({ content: '送信しました。', ephemeral: true });
        const msg = await interaction.channel.send({ embeds: [embed], components: row.components.length > 0 ? [row] : [] });

        if (isSticky) {
          const config = loadConfig();
          if (!config.sticky) config.sticky = {};
          config.sticky[interaction.channelId] = { messageId: msg.id, text };
          saveConfig(config);
          if (!client.stickyMap) client.stickyMap = new Map();
          client.stickyMap.set(interaction.channelId, { messageId: msg.id, text });
        }
      }

      // マッチング登録・変更の反映
      if (interaction.customId === 'modal_match_join' || interaction.customId === 'modal_match_edit') {
        // 💡 チャンネルIDを鍵にしてデータを取得します
        const data = client.matchingData.get(interaction.channelId);
        const rawPower = interaction.fields.getTextInputValue('input_power');
        const { parsePower, buildAnnounceEmbed } = require('../utils/teamMaker');
        const power = parsePower(rawPower);

        if (interaction.customId === 'modal_match_join') {
          const job = interaction.fields.getTextInputValue('input_job') || '未設定';
          data.participants.push({ id: interaction.user.id, name: interaction.user.username, power, job });
        } else {
          const participant = data.participants.find(p => p.id === interaction.user.id);
          if (participant) participant.power = power;
        }

        await interaction.deferUpdate();
        await interaction.message.edit({ embeds: [buildAnnounceEmbed(data)] });
      }
    }
  },
};
