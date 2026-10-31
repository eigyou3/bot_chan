const directory = require('../utils/serverDirectory');
const { welcomeGuild } = require('../utils/autoWelcome');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    // Creating the private config channel and notifying the Bot owner are
    // independent operations; a permission failure must not block notification.
    await welcomeGuild(guild).catch(e => console.error('初期設定チャンネルの作成失敗:', guild.id, e.message));
    await directory.notifyJoin(guild).catch(e => console.error('導入通知の処理失敗:', e.message));
  },
};
