// 成功の確認だけは数秒で片付ける。警告・エラーや操作画面には使わない。
function dismiss(i, ms = 4000) {
  const timer = setTimeout(() => i.deleteReply().catch(() => null), ms);
  timer.unref?.();
}

async function done(i, payload) {
  await i.editReply(payload);
  const text = JSON.stringify(payload);
  if (!text.includes('⚠️') && !text.includes('❌')) dismiss(i);
}

module.exports = { dismiss, done };
