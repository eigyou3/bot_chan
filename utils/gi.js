const st = require('./store');
// 既存の原神サーバーは引き続き利用可能。
const GI = ['1386706264578461726', '975023535053496330'];

const isGI = id => !!id && (GI.includes(id) || st.get(id).genshin === true);
const guildIds = client => [...new Set([...GI, ...[...client.guilds.cache.keys()].filter(isGI)])];
module.exports = { GI, isGI, guildIds };
