const { REST, Routes } = require('discord.js');
const st = require('../utils/store');
const wel = require('../utils/welcome');

module.exports = {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log(`ログイン完了: ${client.user.tag}`);

    // スラッシュコマンド登録
    const cmds = client.commands.map(c => c.data.toJSON());
    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
    try {
      await rest.put(Routes.applicationCommands(client.user.id), { body: cmds });
    } catch (e) {
      console.error('コマンド登録エラー:', e);
    }

    // 各サーバーの #bot-config から設定を戻す
    await st.loadAll(client);

    // アラーム 1分ごとチェック
    let prev = '';
    setInterval(async () => {
      const now = new Date().toLocaleTimeString('ja-JP', { timeZone: 'Asia/Tokyo', hour: '2-digit', minute: '2-digit', hour12: false });
      if (now === prev) return;
      prev = now;

      // 来客リマインド
      await wel.tick(client, now).catch(e => console.error('リマインド処理エラー:', e.message));

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
