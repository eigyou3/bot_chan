const { ensureConfig } = require('./setup');
const adminPanel = require('./adminPanel');
async function welcomeGuild(guild) {
  const ch = await ensureConfig(guild);
  await adminPanel.ensureMessages(guild);
  await require('./permissionChecklist').refresh(guild);
  return {channelId: ch.id};
}
module.exports = { welcomeGuild };
