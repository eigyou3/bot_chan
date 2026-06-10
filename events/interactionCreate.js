const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

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

      // ==========================================
      // マッチング募集ボタンの処理 (修正版)
      // ==========================================
      if (interaction.customId === 'match_join' || interaction.customId === 'match_leave') {
        if (!client.matchStorage) client.matchStorage = new Map();
        if (!client.matchChannelMap) client.matchChannelMap = new Map();

        const data = client.matchStorage.get(interaction.channelId);
        if (!data) return interaction.reply({ content: '募集データが見つかりません。', ephemeral: true });

        const userId = interaction.user.id;
        const role = await interaction.guild.roles.fetch(data.roleId).catch(() => null);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!role || !member) {
          return interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
        }

        // 💡 3. サーバー内の表示名（ニックネーム等）を取得
        const displayName = member.displayName;
        let replyContent = '';

        if (interaction.customId === 'match_join') {
          // 重複チェック（IDで判定）
          if (!data.participants.some(p => p.id === userId)) {
            data.participants.push({ id: userId, name: displayName });
          }
          await member.roles.add(role).catch(() => null);
          
          // 💡 4. 画像のような通知メッセージをセット
          replyContent = `✅ **${displayName}** として参加登録し、<@&${data.roleId}> を付与しました！`;

        } else if (interaction.customId === 'match_leave') {
          data.participants = data.participants.filter(p => p.id !== userId);
          await member.roles.remove(role).catch(() => null);
          
          replyContent = `🗑️ 参加を辞退し、<@&${data.roleId}> を解除しました。`;
        }

        // Embedテキストの再構築
        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setDescription(`┃ ${data.text}`);

        if (data.participants.length > 0) {
          // 💡 表示名だけで綺麗にカンマ区切りにする
          const names = data.participants.map(p => p.name).join(', ');
          embed.addFields({ name: '現在の参加者', value: names });
        }

        // 💡 4. 本人だけにポップアップ通知を送りつつ、メッセージ全体をEmbedで更新
        await interaction.reply({ content: replyContent, ephemeral: true });

        const activeMessageId = client.matchChannelMap.get(interaction.channelId);
        const targetMsg = await interaction.channel.messages.fetch(activeMessageId).catch(() => null);
        if (targetMsg) {
          await targetMsg.edit({ embeds: [embed] });
        }
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
    }
  },
};
