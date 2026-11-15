const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { randomBytes } = require('node:crypto');
require('./docs/data.js');
require('./docs/engine.js');

const rooms = new Map();
const token = () => randomBytes(24).toString('hex');
const alias = (value, fallback) => String(value || '').trim().slice(0,18) || fallback;
const port = Number(process.env.PORT || 8060);
const webRoot = path.join(__dirname,'docs');
const types = { html:'text/html; charset=utf-8', js:'text/javascript; charset=utf-8', css:'text/css; charset=utf-8', jpg:'image/jpeg' };

function reply(res, status, value) {
  res.writeHead(status, { 'Content-Type':'application/json; charset=utf-8', 'Cache-Control':'no-store' });
  res.end(JSON.stringify(value));
}

function snapshot(room, index) {
  return {
    code:room.code, count:room.count, host:index===0, seat:index, roster:room.members.map(p=>p.name),
    game:room.game ? Dream.view(room.game,index) : null,
  };
}

async function read(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size>8192) throw new Error('输入过长。');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

async function api(req,res) {
  if (req.method !== 'POST') return reply(res,405,{ error:'请求方式无效。' });
  const a = await read(req);
  if (a.kind==='create') {
    if (rooms.size >= 100) return reply(res,503,{error:'房间数量已达到上限。'});
    const count = Number(a.count), password = String(a.password || '').trim();
    if (![6,7,8].includes(count) || password.length<4 || password.length>32) return reply(res,400,{error:'请选择 6–8 人，并输入 4–32 位房间口令。'});
    let code;
    do { code = randomBytes(3).toString('hex').toUpperCase(); } while (rooms.has(code));
    const key = token();
    const room = {code,count,password,members:[{key,name:alias(a.name,'梦行者 1')}],active:Date.now()};
    rooms.set(code,room);
    return reply(res,200,{...snapshot(room,0),key});
  }
  const room = rooms.get(String(a.code || '').toUpperCase());
  if (!room) return reply(res,404,{error:'房间不存在或已关闭。'});
  if (a.kind==='join') {
    if (room.game || room.members.length>=room.count || room.password!==String(a.password || '').trim()) return reply(res,403,{error:'口令有误，或房间已满／已开局。'});
    const key = token(), index = room.members.length;
    room.members.push({key,name:alias(a.name,'梦行者 '+(index+1))});
    return reply(res,200,{...snapshot(room,index),key});
  }
  const index = room.members.findIndex(p=>p.key===a.key);
  if (index<0) return reply(res,403,{error:'房间凭据已失效。'});
  room.active = Date.now();
  if (a.kind==='start') {
    if (index!==0 || room.game) return reply(res,403,{error:'只有房主可以开启本局。'});
    const seats = Dream.players(room.count).map((bot,i)=>room.members[i] ? {name:room.members[i].name,bot:false} : bot);
    room.game = Dream.create(seats,null,true);
  }
  if (a.kind==='act') {
    const error = room.game ? Dream.act(room.game,index,a.action) : '房间还未开局。';
    if (error) return reply(res,400,{error});
  }
  return reply(res,200,snapshot(room,index));
}

const server = http.createServer(async (req,res)=>{
  const url = new URL(req.url,'http://localhost');
  if (url.pathname==='/api/room') {
    try { await api(req,res); } catch { reply(res,400,{error:'房间请求无效。'}); }
    return;
  }
  const name = url.pathname==='/' ? 'index.html' : url.pathname.slice(1);
  if (!/^(?:index\.html|style\.css|data\.js|engine\.js|app\.js|assets\/[0-9]{2}\.jpg)$/.test(name)) {
    res.writeHead(404).end();
    return;
  }
  fs.readFile(path.join(webRoot,name),(error,bytes)=>{
    if (error) return res.writeHead(404).end();
    res.writeHead(200,{'Content-Type':types[name.split('.').pop()]});
    res.end(name === 'index.html'
      ? bytes.toString('utf8').replace('<!-- room-server -->','<meta name="jangar-room-server" content="available">')
      : bytes);
  });
});

setInterval(()=>{
  for (const [code,room] of rooms) {
    if (Date.now()-room.active>6*60*60*1000) rooms.delete(code);
    else if (room.game?.deadline && Date.now()>=room.game.deadline) Dream.advance(room.game);
  }
},1000).unref();

server.listen(port,'0.0.0.0',()=>{
  console.log('本机打开 http://localhost:'+port);
  for (const addr of Object.values(os.networkInterfaces()).flat()) {
    if (addr.family==='IPv4' && !addr.internal) console.log('同一网络可访问 http://'+addr.address+':'+port);
  }
});
