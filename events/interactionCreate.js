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
    // スラッシュコマンドの処理
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try { await command.execute(interaction, client); } catch (error) { console.error(error); }
      return;
    }

    // ボタンの処理
    if (interaction.isButton()) {
      // 既存の通常アナウンス用ボタンの処理
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
      // 新しいシンプルなマッチング募集ボタンの処理
      // ==========================================
      if (interaction.customId === 'match_join' || interaction.customId === 'match_leave') {
        if (!client.matchStorage) client.matchStorage = new Map();
        if (!client.matchChannelMap) client.matchChannelMap = new Map();

        // 💡 チャンネルIDを鍵にして、常に安定した大元データを直接取得
        const data = client.matchStorage.get(interaction.channelId);
        if (!data) return interaction.reply({ content: '募集データが見つかりません。新しくコマンドを実行し直してください。', ephemeral: true });

        const userId = interaction.user.id;
        const role = await interaction.guild.roles.fetch(data.roleId).catch(() => null);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!role || !member) {
          return interaction.reply({ content: 'ロールまたはメンバーの情報が取得できませんでした。', ephemeral: true });
        }

        if (interaction.customId === 'match_join') {
          // 参加処理：重複していなければ配列に追加
          if (!data.participants.includes(userId)) {
            data.participants.push(userId);
          }
          // ロールを付与
          await member.roles.add(role).catch(() => null);
        } else if (interaction.customId === 'match_leave') {
          // 辞退処理：配列から削除
          data.participants = data.participants.filter(id => id !== userId);
          // ロールを解除
          await member.roles.remove(role).catch(() => null);
        }

        // 💡 参加者の名前（メンション）を綺麗に並べるテキストの組み立て
        let newContent = `┃ ${data.text}\n[対象ロール: <@&${data.roleId}>]`;
        if (data.participants.length > 0) {
          const mentions = data.participants.map(id => `<@${id}>`).join(', ');
          newContent += `\n┃--\n┃現在の参加者\n┃ ${mentions}`;
        }

        // 応答を確定させつつ、最新の固定メッセージの内容を更新
        await interaction.deferUpdate();
        
        const activeMessageId = client.matchChannelMap.get(interaction.channelId);
        const targetMsg = await interaction.channel.messages.fetch(activeMessageId).catch(() => null);
        if (targetMsg) {
          await targetMsg.edit({ content: newContent });
        }
        return;
      }
    }

    // 通常アナウンス用のモーダル処理
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
