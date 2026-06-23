const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try { return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8')); } catch { return {}; }
}

module.exports = {
  name: 'ready',
  once: true,
  async execute(client) {
    console.log(`ログイン完了: ${client.user.tag}`);

    // --- スラッシュコマンドの一括登録処理 ---
    const commands = [];
    client.commands.forEach(command => {
      commands.push(command.data.toJSON());
    });

    const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

    try {
      console.log('スラッシュコマンドの再登録を開始します...');
      await rest.put(
        Routes.applicationCommands(client.user.id),
        { body: commands }
      );
      console.log('スラッシュコマンドの登録が正常に完了しました。');
    } catch (error) {
      console.error('スラッシュコマンドの登録中にエラーが発生しました:', error);
    }

    // --- 常駐アナウンスのデータ復元処理 ---
    const config = loadConfig();
    if (config.sticky) {
      client.stickyMap = new Map();
      for (const [channelId, data] of Object.entries(config.sticky)) {
        client.stickyMap.set(channelId, data);
      }
    }

    // --- 【新機能】毎日繰り返すアラームの常駐監視システム（1分ごとチェック） ---
    let lastTriggeredMinute = ''; // 同じ1分間に何度も鳴るのを防ぐフラグ

    setInterval(async () => {
      // 日本時刻の「HH:MM」を取得
      const jstStr = new Date().toLocaleString("en-US", { timeZone: "Asia/Tokyo" });
      const jstDate = new Date(jstStr);
      const hours = jstDate.getHours().toString().padStart(2, '0');
      const minutes = jstDate.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${hours}:${minutes}`; // 例: "15:30"

      // 既にこの分でアラームを処理済みの場合はスキップ
      if (lastTriggeredMinute === currentTimeStr) return;

      const currentConfig = loadConfig();
      if (!currentConfig.alarms || currentConfig.alarms.length === 0) return;

      let triggered = false;

      for (const alarm of currentConfig.alarms) {
        if (alarm.time === currentTimeStr) {
          triggered = true;
          try {
            const channel = await client.channels.fetch(alarm.channelId).catch(() => null);
            if (channel) {
              await channel.send(alarm.message);
            }
          } catch (err) {
            console.error('アラーム定期送信エラー:', err);
          }
        }
      }

      // 鳴らした時間帯を記録して、同じ1分間の重複を防ぐ
      if (triggered) {
        lastTriggeredMinute = currentTimeStr;
      }
    }, 60000); // 60秒（1分）ごとにチェック
  },
};
