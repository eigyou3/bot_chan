const { SlashCommandBuilder } = require('discord.js');
const st = require('../utils/store');
const vr = require('../utils/vcrank');
const { isAdmin, deny } = require('../utils/perm');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('vcrank')
    .setDescription('週間VCランキングのON/OFF')
    .addBooleanOption(o => o.setName('on').setDescription('ON＝集計する / OFF＝止める').setRequired(true)),

  async execute(interaction) {
    if (!isAdmin(interaction)) return deny(interaction);

    const g = interaction.guild;
    const d = st.get(g.id);
    const v = interaction.options.getBoolean('on');
    await interaction.deferReply({ ephemeral: true });

    if (v) {
      d.rkOff = false;
      await vr.start(g);
      await st.save(g);
      const note = d.vc ? '' : '\n⚠️ VC通知先が未設定なので、先に /setvc をしてね';
      return interaction.editReply(`✅ VCランキングをONにしました。${note}${st.warn(g)}`);
    }

    d.rkOff = true;
    await vr.stop(g);
    await st.save(g);
    return interaction.editReply(`⏸ VCランキングをOFFにしました。集計と投稿が止まります（今週の記録は残ります）。${st.warn(g)}`);
  },
};
