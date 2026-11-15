const { roles, chapters, endings, achievements, artNames, phases, tags } = DreamData;
const app = document.querySelector('#app');
const modal = document.querySelector('#modal');
const modalContent = document.querySelector('#modal-content');
const storage = {
  read(key) { try { return JSON.parse(localStorage.getItem('jangar-v1-' + key)); } catch { return null; } },
  write(key,value) { try { localStorage.setItem('jangar-v1-' + key,JSON.stringify(value)); } catch {} },
};
let solo = storage.read('solo');
let honors = storage.read('honors') || {};
let lastResult = storage.read('result');
const roomServer = document.querySelector('meta[name="jangar-room-server"]') !== null;
let connection = roomServer ? storage.read('room') : null;
let room = null;
let page = 'home';
let timer;
let busy = false;
let currentRequest;
let lastView = '';

const img = n => 'assets/' + String(n).padStart(2,'0') + '.jpg';
const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
const button = (name, attrs, cls='outline') => '<button class="'+cls+'" '+attrs+'>'+name+'</button>';
const picture = (n, name, lazy=true) => '<img src="'+img(n)+'" alt="'+esc(name)+'" '+(lazy?'loading="lazy"':'')+'>';
const title = (name, sub='') => '<h1 class="page-title">'+name+'</h1>'+(sub?'<p class="sub">'+sub+'</p>':'');
const roster = () => '<div class="roster">'+[4,2,0,7,3,5,6,1].map(i=>roles[i]).map(r=>button(
  picture(r.image,r.name)+'<span>'+r.name+'</span>', 'data-art="'+r.image+'"','portrait')).join('')+'</div>';
const needs = c => Object.entries(c.need).map(([name,n])=>'<span class="tag">'+name+' ≥ '+n+'</span>').join('')+'<span class="tag">怀疑 ≤ '+c.doubt+'</span>';
const view = () => room?.game || (solo ? Dream.view(solo,0) : null);

function home() {
  const primary = solo && solo.phase<5 && !room ? button('继续梦境 <span aria-hidden="true">→</span>','data-page="game"','primary') : button('开启梦境 <span aria-hidden="true">→</span>','data-open="start"','primary');
  return `<section class="hero">
    <div class="wrap hero-inner">
      <div class="eyebrow">蒙古族英雄史诗改编 · 合作推理桌游</div>
      <h1>江格尔史诗</h1><h2>宝木巴的梦境守护</h2>
      <p>迷雾吞没了宝木巴，蟒古斯的影子藏在英雄之中。循着散落的篇章入梦，在信念熄灭之前，找出影子、修复史诗。</p>
      <div class="actions">${room ? button('返回房间 →','data-page="'+(room.game?'game':'room')+'"','primary') : primary}
      ${button('联机房间','data-open="online"')}</div>
      <div class="meta"><span>单人可玩</span><i></i><span>6–8 人联机</span><i></i><span>4 幕剧情</span></div>
    </div>
  </section>
  <div class="wrap">
    <section class="chapter-rail" aria-label="四大史诗篇章">${chapters.map((c,i)=>button(picture(c.image,'',false)+'<span>第 '+['一','二','三','四'][i]+' 幕</span><strong>'+c.short+'</strong>','data-chapter="'+i+'"','')).join('')}</section>
    <section class="section">
      <div class="section-head"><div><div class="eyebrow">宝木巴人物志</div><h2>史诗群像</h2></div>${button('查看图鉴 →','data-page="gallery"','text-button')}</div>
      ${roster()}
    </section>
  </div>`;
}

function gallery() {
  const grid = (items, cards='') => '<div class="art-grid '+cards+'">'+items.map(i=>button(picture(i,artNames[i-1])+'<span>'+artNames[i-1]+'</span>','data-art="'+i+'"','art-item')).join('')+'</div>';
  return `<div class="wrap page">${title('史诗图鉴','查阅人物、卡牌、场景和团队文创设计。')}
    <section class="section"><div class="section-head"><h2>英雄人物</h2></div>${roster()}</section>
    <section class="section"><div class="section-head"><h2>场景与卡牌</h2></div>${grid([1,2,13,14])}<br>${grid([11,12,15,16,17,18,19,20],'cards')}</section>
    <section class="section"><div class="section-head"><h2>结局与成就设计</h2></div>${grid([21,25,26,27,28,29])}</section>
    <section class="section"><div class="section-head"><h2>文创展陈</h2></div>${grid([22,23,24,30,31])}</section>
    <section class="section panel"><h2>从说唱到桌游</h2>
    <p>《江格尔》以英雄与宝木巴家园为中心，由江格尔奇等演唱者在口头传统中传承。本游戏以四幕梦境改编团队的篇章设计，叙事和技能属于游戏设定。</p>
    <details><summary>马头琴与草原叙事</summary><p>马头琴以琴首装饰得名。草原音乐、史诗说唱和英雄形象构成了初稿的文化线索，也为游戏的叙事提供了灵感。</p></details>
    <details><summary>服饰、纹样与文创</summary><p>八张角色卡用不同的服装、马匹与武器区分人物。图鉴中的刺绣感纹样、珐琅徽章和蒙古包礼盒是团队围绕史诗主题创作的设计。</p></details>
    </section></div>`;
}

function honorPage() {
  return `<div class="page wrap">${title('成就与荣誉','已解锁 '+Object.keys(honors).length+' / '+achievements.length+' 项成就')}
  <div class="honor-grid">${achievements.map(([id,name,desc])=>`<article class="panel honor ${honors[id]?'':'locked'}"><strong>${honors[id]?'◆ 已解锁':'◇ 待解锁'}</strong><h3>${name}</h3><p>${desc}</p></article>`).join('')}</div>
  <div class="actions">${button('下载体验证书','data-action="certificate" '+(!lastResult?'disabled':''),'primary')}${button('查看成就设计','data-art="21"')}</div></div>`;
}

function roomPage() {
  if (!room) return '<div class="wrap page">'+title('联机房间')+button('创建或加入房间','data-open="online"','primary')+'</div>';
  return `<div class="wrap page">${title('等待入梦','房间 '+room.code+' · 已加入 '+room.roster.length+' / '+room.count)}
    <div class="columns"><section class="panel"><h3>在席玩家</h3><div class="tags">${room.roster.map((name,i)=>'<span class="seat-chip">'+esc(name)+(i===0?' · 房主':'')+'</span>').join('')}</div>
    <p class="muted">空席由电脑伙伴补齐。把当前网页地址、房间号和创建时的口令发给同一网络中的朋友。</p>
    <div class="actions">${room.host?button('开启本局','data-action="room-start"','primary'):''}${button('返回首页','data-page="home"' )}</div></section>
    <section class="panel"><h3>加入地址</h3><p class="muted">朋友需使用服务器终端输出的局域网地址。开局后可以在原浏览器刷新续玩。</p></section></div></div>`;
}

function seats(v) {
  return '<div class="seats">'+v.seats.map(p=>{
    const role = p.role && Dream.role(p.role);
    return `<div class="seat ${p.id===v.me.id?'own':''} ${p.faith===0?'lost':''}">${picture(role?role.image:11,role?role.name:'身份未揭晓')}<span>${esc(p.name)}${p.id===v.me.id?' · 你':''}</span><small>${p.faith===0?'梦魇':'信念 '+p.faith}${v.phase===5?' · '+role.name:''}</small></div>`;
  }).join('')+'</div>';
}

function targetOptions(v, includeSelf=false) {
  return '<option value="">选择玩家</option>'+v.seats.filter(p=>includeSelf || p.id!==v.me.id).map(p=>'<option value="'+p.id+'">'+esc(p.name)+'</option>').join('');
}

function skillPanel(v) {
  const r = Dream.role(v.me.role);
  const left = r.limit-(v.me.uses[r.id]||0);
  const available = {jangar:[1,2],hong:[1],ceji:[0,1,2,3],agai:[0,1,2,3],gu:[0,1,2],ming:[2],shadow:[1,3],spark:[1]}[r.id].includes(v.phase);
  const targeted = ['ceji','agai','gu','ming','shadow','spark'].includes(r.id);
  const active = v.me.faith && available && left && !v.used;
  return `<section class="panel"><h3>我的身份 · ${r.name}</h3><p>${r.title} · ${v.me.enemy?'影子阵营':'守护阵营'}</p>
    ${v.ally.length?'<p class="muted">同阵营席位 '+v.ally.map(i=>esc(v.seats[i].name)).join('、')+'</p>':''}
    <details ${active?'open':''}><summary>${r.skill} · 剩余 ${left} 次</summary><p>${r.desc}</p>
    ${r.art?button('查看技能卡','data-art="'+r.art+'"','text-button'):''}
    ${active?`<form data-form="skill">${r.id==='shadow'?'<label>裂隙效果<select name="mode"><option value="damage">完整度 −5</option>'+ (v.phase===1?'<option value="block">使标签失效</option>':'') +'<option value="peek">查看内心波动</option></select></label>':''}
    ${targeted?'<label>技能目标<select name="target">'+targetOptions(v,['agai','gu'].includes(r.id))+'</select></label>':''}
    ${button('发动技能','type="submit"')}</form>`:'<p class="muted">本阶段技能暂不可用。</p>'}</details>
    ${r.id==='shadow' && v.me.faith>0 && v.phase===1 && !v.submitted && !v.masked && (v.me.uses.mask||0)<3 ?`<details><summary>心魔伪装 · 剩余 ${3-(v.me.uses.mask||0)} 次</summary><form data-form="skill"><input type="hidden" name="mode" value="mask"><label>模仿标签<select name="tag">${tags.slice(0,4).map(t=>'<option>'+t+'</option>').join('')}</select></label>${button('使用伪装','type="submit"')}</form></details>`:''}</section>`;
}

function reportBlock(v,r) {
  return `<h3>${r.success?'篇章挑战达成':'篇章挑战失败'}</h3>
    <p>全力修复 ${r.full} 枚 · 有所保留 ${r.reserve} 枚</p>
    <div class="tags">${tags.map(t=>'<span class="tag">'+t+' '+r.tally[t]+'</span>').join('')}</div>
    <p class="muted">${r.changes.map(esc).join(' · ') || '完整度无变化'}</p>
    ${r.best?'<p>最佳叙事 · '+esc(r.best)+'</p>':''}
    <details><summary>查阅本轮叙事</summary><ul class="log">${r.clues.filter(c=>c.text).map(c=>'<li><strong>'+esc(v.seats[c.id].name)+'</strong>　'+esc(c.text)+'</li>').join('')}</ul></details>`;
}

function stageBody(v) {
  const stage = v.phase;
  const waiting = '<p class="sub">已提交，正在等待其他玩家。</p>';
  const ready = (label) => v.submitted ? waiting : '<div class="actions">'+button(label,'data-act="ready"','primary')+'</div>';
  if (stage===0) return '<h3>阅读篇章，准备叙事</h3><p>参考本轮所需标签，想一段贴合场景的角色叙事。</p>'+ready('准备就绪 →');
  if (stage===1) return '<h3>织梦叙事</h3><p>写下你的角色行动，提交一枚叙事标签。</p>'+(v.submitted ? waiting :
    `<form data-form="narrate"><label>角色叙事<textarea name="story" maxlength="200" placeholder="例如：我先护住向营地撤退的同伴。"></textarea></label>
      <fieldset><legend>本轮标签</legend><div class="checklist">${tags.map(t=>`<label><input type="radio" name="tag" value="${t}" ${v.maskTag===t?'checked':''} required> ${t}</label>`).join('')}</div></fieldset>
      ${v.maskTag?'<p class="muted">心魔伪装已预置标签 · '+v.maskTag+'</p>':''}
      ${[0,2].includes(v.round)?`<details><summary>内心波动 · 可选，秘密提交</summary><label>波动类型<select name="motion"><option value="">无</option>
      ${[['fear','直面恐惧 · 信念 −1，额外标签'],['observe','暗中观察 · 查看一名玩家的波动'],['seed','播下怀疑 · 完整度 −5']].filter(([key])=>!v.me.motions.includes(key)&&(key!=='seed'||v.me.enemy)&&(key!=='fear'||v.me.faith)).map(([key,text])=>'<option value="'+key+'">'+text+'</option>').join('')}</select></label><div class="field-row"><label>恐惧附加标签<select name="extra">${tags.slice(0,4).map(t=>'<option>'+t+'</option>').join('')}</select></label><label>观察目标<select name="target">${targetOptions(v)}</select></label></div></details>`:''}
      <div class="actions">${button('提交叙事 →','type="submit"','primary')}</div></form>`);
  if (stage===2) return `<h3>选择修复令牌</h3><p>全力修复占优时完整度 +15；若同时达成挑战再 +5。持平或有所保留占优时，全员信念 −1。</p>
    <div class="tags">${tags.slice(0,4).map(t=>'<span class="tag">'+t+' '+v.tally[t]+'</span>').join('')}</div>
    ${v.voted?'<p class="muted">令牌已提交，醒梦时公开统计。</p>'+ready('揭晓本轮结果 →'):'<div class="actions">'+button('全力修复','data-act="full"','primary')+button('有所保留','data-act="reserve"')+'</div>'}`;
  if (stage===3) return reportBlock(v,v.reports[v.round])+ready(v.round===3?'进入最终指认 →':'进入下一篇章 →');
  return `<h3>最终指认</h3><p>结合叙事和秘密线索，最多指认两名玩家。联机按全员票数结算，截止位并列的席位不算指认成功。</p>
    <details><summary>翻看四幕叙事与异常记录</summary><ul class="log">${v.reports.map((r,i)=>'<li><strong>'+chapters[i].short+'</strong><br>'+r.clues.map(c=>esc(v.seats[c.id].name)+(c.doubt?' · 有怀疑痕迹':'')+(c.text?'　'+esc(c.text):'')).join('<br>')+'</li>').join('')}</ul></details>
    ${v.accused||v.submitted ? waiting : v.me.faith===0 ? ready('确认旁观结局 →') : `<form data-form="accuse"><div class="checklist">${v.seats.filter(p=>p.id!==v.me.id).map(p=>'<label><input type="checkbox" name="suspect" value="'+p.id+'"> '+esc(p.name)+'</label>').join('')}</div>${button('提交指认','type="submit"','primary')}</form>`}`;
}

function results(v) {
  const [name,status,desc,art] = endings[v.ending];
  const found = v.detected.length;
  return `<div class="wrap page">
    <section class="scene" style="background-image:url('${img(v.ending==='perfect'?2:v.ending==='standard'?1:14)}')"><div><div class="eyebrow">${status}</div>${title(name)}<p>${desc}</p></div></section>
    <div class="stats"><div class="stat"><b>${v.epic}/100</b><span>史诗完整度</span></div><div class="stat"><b>${v.seats.filter(p=>p.faith>0).length}/${v.seats.length}</b><span>信念未归零</span></div><div class="stat"><b>${found}/2</b><span>成功指认</span></div></div>
    <div class="columns"><section class="panel"><h3>身份揭晓</h3>${seats(v)}
    <p class="sub">初始影子阵营 · ${v.seats.filter(p=>Dream.role(p.role).enemy).map(p=>esc(p.name)+'（'+Dream.role(p.role).name+'）').join('、')}</p>
    ${v.ending==='neutral'&&v.branches.length?'<p class="sub">'+v.branches.join(' ')+'</p>':''}</section>
    <section class="panel"><h3>对局复盘</h3>${v.reports.map((r,i)=>'<details><summary>'+chapters[i].short+'</summary>'+reportBlock(v,r)+'</details>').join('')}</section></div>
    <div class="actions">${button('下载体验证书','data-action="certificate"','primary')}${button('查看结局插画','data-art="'+art+'"')}${button(v.online?'离开房间':'再开一局',v.online?'data-action="leave"':'data-open="start"')}</div></div>`;
}

function gamePage(v) {
  if (!v) return home();
  if (v.phase===5) return results(v);
  const c = chapters[v.round], humanCount = v.seats.filter(p=>!p.bot).length;
  return `<div class="wrap page">
    <section class="scene" style="background-image:url('${img(v.phase===4?13:c.image)}')">
      <div><div class="eyebrow">${v.phase===4?'终局 · 身份推理':'第 '+(v.round+1)+' 幕 · '+c.place}</div>
      ${title(v.phase===4?'揭开影子的身份':c.name)}<p>${v.phase===4?'四幕梦境已经走完。现在，票选你怀疑的潜伏者。':c.story}</p></div>
    </section>
    <div class="stats"><div class="stat"><b>${v.epic}<small>/100</small></b><span>史诗完整度</span><meter min="0" max="100" value="${v.epic}" aria-label="史诗完整度"></meter></div>
    <div class="stat"><b>${v.me.faith}<small>/10</small></b><span>我的信念</span><meter min="0" max="10" value="${v.me.faith}" aria-label="我的信念"></meter></div>
    <div class="stat"><b>${v.online?'<span id="clock"></span>':(v.round+1)+' / 4'}</b><span>${v.online?'阶段剩余时间':'梦境轮数'}</span></div></div>
    ${v.phase<4?'<div class="stage-bar" aria-label="回合阶段">'+phases.map((p,i)=>'<span '+(v.phase===i?'class="current" aria-current="step"':'')+'>'+p+'</span>').join('')+'</div>':''}
    <div class="columns">
      <div class="stack"><section class="panel">${v.phase<4?'<p class="muted">篇章挑战 · 达成 +'+c.gain+' / 失败 −'+c.loss+'</p><div class="tags">'+needs(c)+'</div>':''}
        ${stageBody(v)}${v.online?'<p class="sub">已提交 '+v.progress+' / '+humanCount+'</p>':''}</section>
        ${skillPanel(v)}
        ${v.online?`<section class="panel"><h3>房间讨论</h3><ul class="messages">${v.chat.slice(-12).map(m=>'<li>'+ (m.secret?'[影子密语] ':'') +'<b>'+esc(v.seats[m.id].name)+'</b>　'+esc(m.message)+'</li>').join('')}</ul><form data-form="chat"><label>消息<input name="text" maxlength="200" required></label>${v.me.enemy?'<label><input type="checkbox" name="secret"> 影子密语</label>':''}${button('发送','type="submit"')}</form></section>`:''}
      </div>
      <aside class="stack"><section class="panel"><h3>梦境席位</h3>${seats(v)}</section>
      <section class="panel"><h3>我的秘密线索</h3>${v.me.notes.length?'<ul class="notes">'+v.me.notes.slice().reverse().map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':'<p class="muted">使用查验或暗中观察，获得专属信息。</p>'}</section>
      <section class="panel"><h3>主持记录</h3>${v.log.length?'<ul class="log">'+v.log.slice().reverse().map(n=>'<li>'+esc(n)+'</li>').join('')+'</ul>':'<p class="muted">史诗完整度从 60 开始，所有人的信念初始为 10。</p>'}</section></aside>
    </div></div>`;
}

function saveResult(v) {
  if (v?.phase!==5) return;
  const earned = {
    finish:true, perfect:v.ending==='perfect', heal:v.me.healed,
    detect:v.detected.length>0, lion:(v.me.uses.hong||0)>=3, seer:(v.me.uses.ceji||0)>=4,
  };
  Object.keys(earned).filter(key=>earned[key]).forEach(key=>{ honors[key]=true; });
  lastResult = { title:endings[v.ending][0], name:v.me.name, epic:v.epic, count:v.seats.length };
  storage.write('honors',honors);
  storage.write('result',lastResult);
}

function render() {
  document.querySelectorAll('nav [data-page]').forEach(b=>{
    b.classList.toggle('active', b.dataset.page===page);
    if (b.dataset.page===page) b.setAttribute('aria-current','page');
    else b.removeAttribute('aria-current');
  });
  const v = view();
  if (page==='game') saveResult(v);
  app.innerHTML = ({ home, gallery, honors:honorPage, room:roomPage, game:()=>gamePage(v) })[page]();
  updateClock();
}

function show(next) {
  page = next;
  render();
  window.scrollTo(0,0);
}

function updateClock() {
  const el = document.querySelector('#clock');
  if (!el) return;
  const left = Math.max(0,Math.ceil((view().deadline-Date.now())/1000));
  el.textContent = Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
}

function notify(message) {
  const toast = document.querySelector('#toast');
  toast.textContent = message;
  clearTimeout(timer);
  timer = setTimeout(()=>{toast.textContent='';},4500);
}

function openModal(name, html) {
  modalContent.innerHTML = '<div class="dialog-body"><div class="dialog-head"><h2 id="dialog-title">'+name+'</h2>'+button('关闭','data-action="close"','outline compact')+'</div>'+html+'</div>';
  if (!modal.open) modal.showModal();
  modal.scrollTop=0;
}

const selectCount = '<label>席位数<select name="count"><option>6</option><option>7</option><option selected>8</option></select></label>';
const nameField = '<label>玩家昵称<input name="name" maxlength="18" placeholder="梦行者"></label>';
const passField = '<label>房间口令<input name="password" type="password" minlength="4" maxlength="32" required></label>';
const ruleText = `<div class="stack">
  <p>四轮梦境各经历入梦、织梦、激梦、醒梦。开局史诗完整度为 60，个人信念为 10。</p>
  <section><h3>入梦与织梦</h3><p>阅读本幕挑战。提交一段角色叙事和一枚标签。第 1、3 轮可秘密提交内心波动，每种波动整局只能用一次。守护者主动打出怀疑会损失 2 点信念。</p></section>
  <section><h3>激梦与醒梦</h3><p>选择全力修复或有所保留。全力修复占优时完整度 +15，且挑战达成时额外 +5。否则参与者信念 −1。挑战奖惩、怀疑与技能一并结算，每枚有效怀疑扣 5 点完整度。信念归零会转入影子阵营，同时失去角色技能。</p></section>
  <section><h3>终局</h3><p>最多指认两名玩家。完整度至少 90、全员信念大于 0 且指认两名反派，可获完美胜利。完整度至少 80、至少三人信念非零且指认一名反派，可获标准胜利。完整度不高于 40 或至少三人归零时，通常为影子胜利。完整度不高于 20、幸存者至多两人且江格尔信念归零时，优先触发史诗悲歌。其余为中立结局。</p></section>
  <section><h3>联机阶段计时</h3><p>联机阶段在所有真人完成动作或倒计时结束时推进。若有缺席动作，系统会自动代打标签与令牌，最终指认则按已提交的选票统计。</p></section>
</div>`;

function openMenu(which) {
  if (which==='rules') return openModal('玩法说明',ruleText);
  if (which==='start') return openModal('开启单人梦境',`<form data-form="start">
    <p class="sub">你操控一位英雄，其余席位由电脑伙伴扮演。身份和技能只在对局中向你展示。</p>
    <div class="field-row">${nameField}${selectCount}</div>
    <label>身份<select name="role"><option value="">随机抽取</option>${roles.map(r=>'<option value="'+r.id+'">'+r.name+'</option>').join('')}</select></label>
    ${button('进入第一幕 →','type="submit"','primary')}</form>`);
  if (room) return openModal('联机房间','<p>当前房间 '+room.code+'</p><div class="actions">'+button('返回房间','data-page="'+(room.game?'game':'room')+'"','primary')+button('离开房间','data-action="leave"')+'</div>');
  if (!roomServer) return openModal('联机房间','<p>此页面可直接开启单人梦境。要和同一网络中的好友联机，在项目文件夹运行 <code>npm start</code>，然后打开终端显示的网址。</p>');
  openModal('联机房间',`<div class="mode-grid">
    <form class="panel" data-form="create"><h3>创建房间</h3>${nameField}${selectCount}${passField}${button('创建','type="submit"','primary')}</form>
    <form class="panel" data-form="join"><h3>加入房间</h3>${nameField}<label>房间号<input name="code" maxlength="6" pattern="[A-Fa-f0-9]{6}" required></label>${passField}${button('加入','type="submit"')}</form>
    </div><p class="sub" role="status" id="room-error"></p>`);
}

async function request(kind, fields={}) {
  const res = await fetch('./api/room',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({...connection,...fields,kind}),
  });
  let response;
  try { response = await res.json(); } catch { throw new Error('请先运行游戏自带的联机服务器。'); }
  if (!res.ok || response.error) {
    const error = new Error(response.error || '联机请求失败。');
    error.status = res.status;
    throw error;
  }
  return response;
}

function acceptRoom(next, enter=false) {
  const snapshot = JSON.stringify(next);
  if (!enter && snapshot===lastView) return;
  const before = room?.game;
  const openDetails = [...app.querySelectorAll('details')].map(d=>d.open);
  const controls = [...app.querySelectorAll('input,select,textarea')].map(el=>({name:el.name,value:el.value,checked:el.checked,type:el.type}));
  lastView = snapshot;
  room = next;
  if (enter) return show(room.game?'game':'room');
  if (page==='room' && room.game) return show('game');
  if (!['game','room'].includes(page)) return;
  const sameStep = before?.phase===room.game?.phase && before?.round===room.game?.round;
  const old = document.activeElement;
  const focus = [...app.querySelectorAll('input,select,textarea')].indexOf(old);
  render();
  if (sameStep) {
    [...app.querySelectorAll('details')].forEach((d,i)=>{ if (openDetails[i]!==undefined) d.open=openDetails[i]; });
    [...app.querySelectorAll('input,select,textarea')].forEach((el,i)=>{
      const saved = controls[i];
      if (!saved || saved.name!==el.name || saved.type!==el.type || el.type==='hidden') return;
      if (el.type==='checkbox' || el.type==='radio') el.checked=saved.checked;
      else el.value=saved.value;
      if (i===focus) el.focus({preventScroll:true});
    });
  }
}

async function online(kind, fields={}, enter=false) {
  if (busy) {
    if (kind==='poll') return;
    await currentRequest.catch(()=>{});
    if (busy) return;
  }
  busy = true;
  try {
    currentRequest = request(kind,fields);
    const next = await currentRequest;
    if (next.key) {
      connection = {code:next.code,key:next.key};
      storage.write('room',connection);
      delete next.key;
    }
    if (enter) modal.close();
    acceptRoom(next,enter);
    return true;
  } catch (error) {
    if (kind==='poll' && [403,404].includes(error.status)) {
      leave();
      notify(error.message);
    } else if (kind!=='poll') {
      const status = modal.querySelector('#room-error');
      if (modal.open && status) status.textContent = error.message;
      else notify(error.message || '无法连接房间。');
    }
  } finally { busy=false; currentRequest=null; }
}

function leave() {
  connection=null;
  room=null;
  lastView='';
  storage.write('room',null);
  if (modal.open) modal.close();
  show('home');
}

async function act(action) {
  if (room?.game) return online('act',{action});
  if (!solo) return;
  const error = Dream.act(solo,0,action);
  if (error) return notify(error);
  const draft = action.kind==='skill' && app.querySelector('form[data-form="narrate"]');
  const saved = draft && new FormData(draft);
  storage.write('solo',solo);
  render();
  const newForm = saved && app.querySelector('form[data-form="narrate"]');
  if (newForm) {
    for (const [name,value] of saved) {
      if (name==='tag' && solo.turn.mask) continue;
      const control = newForm.elements.namedItem(name);
      if (control) control.value=value;
    }
    if (saved.get('motion')) newForm.querySelector('details').open=true;
  }
}

function certificate() {
  if (!lastResult) return;
  const canvas = document.createElement('canvas');
  canvas.width=1200;
  canvas.height=800;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle='#f0e3c6';
  ctx.fillRect(0,0,1200,800);
  ctx.strokeStyle='#916737';
  ctx.lineWidth=4;
  ctx.strokeRect(25,25,1150,750);
  ctx.lineWidth=1;
  ctx.strokeRect(39,39,1122,722);
  ctx.textAlign='center';
  const draw = (text,size,y,color='#3a2b22')=>{
    ctx.fillStyle=color;
    ctx.font=size+'px "Microsoft YaHei", sans-serif';
    ctx.fillText(text,600,y,1040);
  };
  draw('◆',52,158,'#916737');
  draw('江格尔史诗 · 非遗文化体验证书',52,260);
  draw(lastResult.name,58,383,'#754925');
  draw('完成「宝木巴的梦境守护」四幕体验',29,474);
  draw(lastResult.title+'　│　完整度 '+lastResult.epic+'/100　│　'+lastResult.count+' 个席位',25,542);
  draw('创闯怆团队　·　'+new Date().toLocaleDateString('zh-CN'),22,676);
  canvas.toBlob(blob=>{
    if (!blob) return notify('证书生成失败。');
    const url=URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href=url;
    link.download='江格尔史诗-体验证书.png';
    link.click();
    setTimeout(()=>URL.revokeObjectURL(url),1000);
  },'image/png');
}

document.addEventListener('click',event=>{
  const b=event.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.page) {
    if (modal.open) modal.close();
    return show(b.dataset.page);
  }
  if (b.dataset.open) return openMenu(b.dataset.open);
  if (b.dataset.art) {
    const n=Number(b.dataset.art);
    return openModal(artNames[n-1],'<img class="dialog-img" src="'+img(n)+'" alt="'+artNames[n-1]+'">'+(n>=25&&n<=29?'<p class="muted">团队结局设计原图，图中数值为示例。</p>':''));
  }
  if (b.dataset.chapter!==undefined) {
    const c=chapters[Number(b.dataset.chapter)];
    return openModal(c.name,'<img class="dialog-img" src="'+img(c.image)+'" alt="'+c.place+'"><p>'+c.story+'</p><div class="tags">'+needs(c)+'</div>');
  }
  if (b.dataset.act) {
    const kind=b.dataset.act;
    return act(kind==='ready'?{kind}:{kind:'vote',full:kind==='full'});
  }
  if (b.dataset.action==='close') modal.close();
  if (b.dataset.action==='room-start') online('start',{},true);
  if (b.dataset.action==='leave') leave();
  if (b.dataset.action==='certificate') certificate();
});

document.addEventListener('submit',event=>{
  const kind=event.target.dataset.form;
  if (!kind) return;
  event.preventDefault();
  const form=new FormData(event.target);
  const fields=Object.fromEntries(form);
  if (kind==='start') {
    const playerSeats=Dream.players(Number(fields.count));
    playerSeats[0]={name:fields.name.trim().slice(0,18)||'梦行者',bot:false};
    solo=Dream.create(playerSeats,fields.role||null);
    storage.write('solo',solo);
    modal.close();
    return show('game');
  }
  if (kind==='create'||kind==='join') return online(kind,fields,true);
  const target = fields.target ? Number(fields.target) : undefined;
  if (kind==='accuse') return act({kind,targets:form.getAll('suspect').map(Number)});
  if (kind==='chat') {
    const input=event.target.elements.text;
    act({kind,text:fields.text,secret:fields.secret==='on'}).then(sent=>{
      const live = app.querySelector('form[data-form="chat"] input[name="text"]');
      if (sent && live?.value===input.value) live.value='';
    });
    return;
  }
  return act({...fields,kind,target});
});

render();
setInterval(updateClock,500);
setInterval(()=>{if (connection) online('poll');},1200);
