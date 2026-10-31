const { ensureConfig } = require('./setup');
const adminPanel = require('./adminPanel');
async function welcomeGuild(guild) {
  const ch = await ensureConfig(guild);
  await adminPanel.ensureMessages(guild);
  return {channelId: ch.id};
}
module.exports = { welcomeGuild };
