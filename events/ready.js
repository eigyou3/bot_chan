const { REST, Routes } = require('discord.js');
const st = require('../utils/store');
const wel = require('../utils/welcome');
const vr = require('../utils/vcrank');
const gn = require('../utils/gnews');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`ログイン完了: ${client.user.tag}`);

    // スラッシュコマンド登録
    // guild指定ありのコマンドはそのサーバーだけに出す
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    const all = [...client.commands.values()];
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: all.filter(c => !c.guild).map(c => c.data.toJSON()) });
      const gs = {};
      for (const c of all.filter(c => c.guild)) (gs[c.guild] ||= []).push(c.data.toJSON());
      for (const [gid, body] of Object.entries(gs)) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, gid), { body }).catch(e => console.error(`コマンド登録エラー(${gid}):`, e.message));
      }
    } catch (e) {
      console.error('コマンド登録エラー:', e);
    }

    // 各サーバーの #bot-config から設定を戻す
    await st.loadAll(client);
    await vr.init(client).catch(e => console.error('VC集計の初期化エラー:', e.message));

    // 原神のお知らせ 1時間おき（起動1分後に1回）
    setTimeout(() => gn.tick(client).catch(() => null), 60000);
    setInterval(() => gn.tick(client).catch(() => null), 3600000);

    // アラーム 1分ごとチェック
    let prev = '';
    setInterval(async () => {
      const now = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
      if (now === prev) return;
      prev = now;

      // 来客リマインド
      await wel.tick(client, now).catch(e => console.error('リマインド処理エラー:', e.message));
      await vr.tick(client).catch(e => console.error('VC集計エラー:', e.message));

      for (const d of st.db.values()) {
        for (const a of d.alarms) {
          if (a.time !== now) continue;
          const ch = await client.channels.fetch(a.ch).catch(() => null);
          if (ch) await ch.send(a.msg).catch(e => console.error('アラーム送信エラー:', e.message));
        }
      }
    }, 20000);
  },
};
