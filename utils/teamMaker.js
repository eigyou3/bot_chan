const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

// 戦力数値をパース
function parsePower(str) {
  return parseFloat(
    str
      .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0))
      .replace(/[．]/g, '.').replace(/[，,]/g, '')
      .replace(/[Ｍｍ]/g, 'M').replace(/M/gi, '')
      .trim()
  ) || 0;
}

// 戦力数値をフォーマット
function formatPower(v) { 
  return v.toFixed(1) + 'M'; 
}

// 募集用Embedの作成
function buildAnnounceEmbed(data) {
  const embed = new EmbedBuilder()
    .setColor('#5865F2')
    .setTitle('━━ 参戦募集 ━━')
    .setDescription(`集計方法：**${data.sortLabel}**`)
    .addFields(
      { 
        name: `➡️ 参戦メンバー (${data.participants.length}人)`, 
        value: data.participants.length > 0 
          ? data.participants.map(p => `${p.name} (戦力: ${p.power})`).join('\n') 
          : 'なし' 
      }
    );

  return embed;
}

// チーム分けロジック
function makeTeams(members, method) {
  const sorted = [...members].sort((a, b) => b.power - a.power);
  const teams = [[], []];

  if (method === 'snake') {
    // スネーク方式（蛇行配置）
    sorted.forEach((m, i) => {
      if (i % 4 === 0 || i % 4 === 3) {
        teams[0].push(m);
      } else {
        teams[1].push(m);
      }
    });
  } else {
    // 平均化方式
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

  // 人数が多い方の端数を余りとして処理
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
