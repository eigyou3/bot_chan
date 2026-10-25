const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// ロールごとのトグルボタン（1行5個まで）
function annRows(g, ids) {
  const rows = [];
  ids.forEach((id, i) => {
    if (i % 5 === 0) rows.push(new ActionRowBuilder());
    const nm = g.roles.cache.get(id)?.name || 'ロール';
    rows.at(-1).addComponents(
      new ButtonBuilder().setCustomId(`ann_tg_${id}`).setLabel(nm.slice(0, 80)).setStyle(ButtonStyle.Secondary)
    );
  });
  return rows;
}

module.exports = { annRows };
