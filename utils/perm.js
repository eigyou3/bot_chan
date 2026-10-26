const { PermissionFlagsBits, EmbedBuilder } = require('discord.js');

// 自分ともう1人
const OWNERS = ['1088369918069715024', '936419559165026304'];

const isOwner = i => OWNERS.includes(i.user.id);
// 登録した人か、そのサーバーの管理者
const isAdmin = i => isOwner(i) || !!i.memberPermissions?.has(PermissionFlagsBits.Administrator);

const deny = i => i.reply({ embeds: [new EmbedBuilder().setColor('#5F5E5A').setDescription('このコマンドを実行する権限がありません。')], ephemeral: true });

module.exports = { isOwner, isAdmin, deny };
