const st = require('../utils/store');
module.exports = {
  name: 'guildMemberRemove',
  execute(member) {
    const s = st.get(member.guild.id).inactive;
    if (s?.users[member.id]) { delete s.users[member.id]; st.saveLater(member.guild); }
  },
};
