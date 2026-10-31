const directory = require('../utils/serverDirectory');

module.exports = {
  name: 'guildCreate',
  async execute(guild) {
    await directory.notifyJoin(guild).catch(e => console.error('導入通知の処理失敗:', e.message));
  },
};
