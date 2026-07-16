const { EmbedBuilder } = require('discord.js');

function parsePower(str) {
  return parseFloat(
    str
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[．]/g, '.').replace(/[，,]/g, '')
      .replace(/[Ｍｍ]/g, 'M').replace(/M/gi, '')
      .trim()
  ) || 0;
}

function formatPower(v) {
  return v.toFixed(1) + 'M';
}

function buildAnnounceEmbed(data) {
  return new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('━━ 参戦募集 ━━')
    .setDescription(`集計方法：**${data.sortLabel}**`)
    .addFields({
      name: `➡️ 参戦メンバー (${data.participants.length}人)`,
      value: data.participants.length > 0
        ? data.participants.map(p => `${p.name}┃${formatPower(p.power)}┃${p.job}`).join('\n')
        : 'なし'
    });
}

function makeTeams(members, method) {
  const sorted = [...members].sort((a, b) => b.power - a.power);
  const teams = [[], []];

  if (method === 'snake') {
    sorted.forEach((m, i) => {
      if (i % 4 === 0 || i % 4 === 3) {
        teams[0].push(m);
      } else {
        teams[1].push(m);
      }
    });
  } else {
    sorted.forEach(m => {
      const sum0 = teams[0].reduce((s, p) => s + p.power, 0);
      const sum1 = teams[1].reduce((s, p) => s + p.power, 0);
      if (sum0 <= sum1) {
        teams[0].push(m);
      } else {
        teams[1].push(m);
      }
    });
  }

  let remainderMembers = [];
  const minLen = Math.min(teams[0].length, teams[1].length);
  if (teams[0].length > minLen) remainderMembers = teams[0].splice(minLen);
  if (teams[1].length > minLen) remainderMembers = teams[1].splice(minLen);

  return { teams, remainderMembers };
}

module.exports = {
  parsePower,
  formatPower,
  buildAnnounceEmbed,
  makeTeams
};
