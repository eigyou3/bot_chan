const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const st = require('../utils/store');

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

      if (interaction.customId === 'entry_join' || interaction.customId === 'entry_leave') {
        const data = st.get(interaction.guildId).entry[interaction.channelId];
        if (!data) return interaction.reply({ content: '募集データが見つかりません。', ephemeral: true });

        const userId = interaction.user.id;
        const role = await interaction.guild.roles.fetch(data.roleId).catch(() => null);
        const member = await interaction.guild.members.fetch(userId).catch(() => null);

        if (!role || !member) {
          return interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });
        }

        const displayName = member.displayName;
        let replyContent = '';

        if (interaction.customId === 'entry_join') {
          if (!data.participants.some(p => p.id === userId)) {
            data.participants.push({ id: userId, name: displayName });
          }
          await member.roles.add(role).catch(() => null);
          replyContent = `✅ **${displayName}** として参加登録し、<@&${data.roleId}> を付与しました！`;

        } else if (interaction.customId === 'entry_leave') {
          data.participants = data.participants.filter(p => p.id !== userId);
          await member.roles.remove(role).catch(() => null);
          replyContent = `🗑️ 参加を辞退し、<@&${data.roleId}> を解除しました。`;
        }

        const embed = new EmbedBuilder()
          .setColor('#5865F2')
          .setDescription(data.text);

        if (data.participants.length > 0) {
          const names = data.participants.map(p => p.name).join(', ');
          embed.addFields({ name: '現在の参加者', value: names });
        }

        await interaction.reply({ content: replyContent, ephemeral: true });
        st.saveLater(interaction.guild, 5000);

        const targetMsg = await interaction.channel.messages.fetch(data.msg).catch(() => null);
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
          st.get(interaction.guildId).sticky[interaction.channelId] = { messageId: msg.id, text, roleId };
          await st.save(interaction.guild);
        }
      }
    }
  },
};
