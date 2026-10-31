const st = require('../utils/store');
const analytics = require('../utils/analyticsCollector');
module.exports = {
  name: 'guildMemberRemove',
  execute(member) {
    analytics.memberEvent(member.guild,'leaves');
    const s = st.get(member.guild.id).inactive;
    if (s?.users[member.id]) { delete s.users[member.id]; st.saveLater(member.guild); }
  },
};
