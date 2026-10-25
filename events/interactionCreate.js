const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const st = require('../utils/store');
const { annRows } = require('../utils/annRows');
const intro = require('../utils/intro');
const art = require('../utils/artifact');
const gift = require('../utils/gift');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction, client) {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      try { await command.execute(interaction, client); } catch (error) { console.error(error); }
      return;
    }

    // 聖遺物自慢のメニュー
    if (interaction.isStringSelectMenu()) {
      const run = { art_c: art.pickChar, art_b: art.pickBase, art_p: art.pickPart }[interaction.customId.slice(0, 5)];
      if (run) return run(interaction).catch(e => console.error('聖遺物エラー:', e.message));
      return;
    }

    if (interaction.isButton()) {
      // UID登録
      if (interaction.customId.startsWith('intro_open_')) return intro.open(interaction).catch(e => console.error(e));
      if (interaction.customId === 'gift_open') return gift.open(interaction).catch(e => console.error(e));
      // 押すたびに付く/外れる
      if (interaction.customId.startsWith('ann_tg_')) {
        const id = interaction.customId.slice(7);
        const role = await interaction.guild.roles.fetch(id).catch(() => null);
        const mem = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
        if (!role || !mem) return interaction.reply({ content: 'エラーが発生しました。', ephemeral: true });

        if (mem.roles.cache.has(id)) {
          await mem.roles.remove(role).catch(() => null);
          return interaction.reply({ content: `🗑️ <@&${id}> を外しました。`, ephemeral: true });
        }
        await mem.roles.add(role).catch(() => null);
        return interaction.reply({ content: `✅ <@&${id}> を付けました！`, ephemeral: true });
      }

      // 前の形式のボタン（古いアナウンス用に残してる）
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
      if (interaction.customId.startsWith('intro_mdl_')) return intro.submit(interaction).catch(e => console.error('UID登録エラー:', e.message));
      if (interaction.customId === 'gift_mdl') return gift.submit(interaction).catch(e => console.error('ギフトコードエラー:', e.message));
      if (interaction.customId.startsWith('ann_mdl_')) {
        const pend = client.commands.get('announce').pend;
        const p = pend.get(interaction.customId.slice(8));
        if (!p) return interaction.reply({ content: '時間が経ちすぎたので、もう一度 /announce からお願いします。', ephemeral: true });
        pend.delete(interaction.customId.slice(8));

        const text = interaction.fields.getTextInputValue('announce_text');
        const embed = new EmbedBuilder().setColor('#5865F2').setDescription(text);

        await interaction.reply({ content: '送信しました。', ephemeral: true });
        const msg = await interaction.channel.send({ embeds: [embed], components: annRows(interaction.guild, p.ids) });

        if (p.sticky) {
          st.get(interaction.guildId).sticky[interaction.channelId] = { messageId: msg.id, text, roles: p.ids };
          await st.save(interaction.guild);
        }
      }
    }
  },
};
