const analytics = require('../utils/analyticsCollector');
module.exports = {name:'guildMemberAdd',execute(member){analytics.memberEvent(member.guild,'joins');}};
