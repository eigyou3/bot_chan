const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');

// チャンネル設定やアラームデータの保存先
const CONFIG_PATH = path.join(__dirname, '..', 'config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
  } catch {
    return {};
  }
}

function saveConfig(data) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2));
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

    // --- 常駐アナウンスとアラームのデータ復元処理 ---
    const config = loadConfig();

    // 常駐アナウンスの復元
    if (config.sticky) {
      client.stickyMap = new Map();
      for (const [channelId, data] of Object.entries(config.sticky)) {
        client.stickyMap.set(channelId, data);
      }
    }

    // アラーム（タイマー）の復元
    if (config.alarms) {
      const now = Date.now();
      const activeAlarms = [];

      for (const alarm of config.alarms) {
        if (alarm.time > now) {
          // 残り時間を計算してタイマーを再セット
          const delay = alarm.time - now;
          setTimeout(async () => {
            try {
              const channel = await client.channels.fetch(alarm.channelId);
              if (channel) {
                await channel.send(alarm.message);
              }
            } catch (err) {
              console.error('アラーム送信エラー:', err);
            } finally {
              // 送信が終わったら保存データから削除
              const currentConfig = loadConfig();
              currentConfig.alarms = (currentConfig.alarms || []).filter(a => a.time !== alarm.time);
              saveConfig(currentConfig);
            }
          }, delay);

          activeAlarms.push(alarm);
        }
      }

      // すでに過ぎてしまった古いアラームを掃除して保存
      config.alarms = activeAlarms;
      saveConfig(config);
    }
  },
};