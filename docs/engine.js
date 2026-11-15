globalThis.Dream = (() => {
  const { roles, chapters, tags, phases } = DreamData;
  const role = id => roles.find(item => item.id === id);
  const living = p => p.faith > 0;
  const enemy = p => role(p.role).enemy || !living(p);
  const players = n => Array.from({length:n}, (_, i) => ({ name:'梦行者 ' + (i + 1), bot:true }));
  const pick = list => list[Math.floor(Math.random() * list.length)];
  const limit = (x, max) => Math.max(0, Math.min(max, x));
  const fresh = () => ({ acts:{}, votes:{}, ready:{}, skills:{}, hidden:[], shields:[], blocked:[], bonus:[], flip:[], flags:{}, pressure:0 });

  function create(seats, chosen, online = false) {
    const core = ['jangar','hong','ceji','agai','shadow','spark'];
    if (seats.length >= 7) core.push(seats.length === 7 && chosen === 'ming' ? 'ming' : 'gu');
    if (seats.length === 8) core.push('ming');
    if (chosen && !core.includes(chosen)) core[3] = chosen;
    for (let i = core.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [core[i],core[j]] = [core[j],core[i]];
    }
    if (chosen) {
      const j = core.indexOf(chosen);
      [core[0],core[j]] = [core[j],core[0]];
    }
    const state = {
      online, round:0, phase:0, epic:60, turn:fresh(), log:[], reports:[], votes:{}, chat:[],
      seats:seats.map((p, i) => ({ ...p, id:i, role:core[i], faith:10, uses:{}, notes:[], motions:[], healed:false })),
    };
    setDeadline(state);
    return state;
  }

  function setDeadline(s) {
    s.deadline = s.online && s.phase < 5
      ? Date.now() + [300,450,300,210,120][s.phase] * 1000 : null;
  }

  function faith(p, delta) {
    p.faith = limit(p.faith + delta, 10);
  }

  function counts(s) {
    const result = Object.fromEntries(tags.map(tag => [tag,0]));
    Object.entries(s.turn.acts).forEach(([id,a]) => {
      if (!s.turn.blocked.includes(Number(id))) {
        result[a.tag] += s.turn.flags[id] === 'lion' && a.tag !== '怀疑' ? 2 : 1;
        if (a.motion === 'fear') result[a.extra]++;
      }
    });
    for (const t of s.turn.bonus) result[t]++;
    if (s.turn.ward) result.怀疑 = Math.max(0,result.怀疑 - 1);
    return result;
  }

  function shielded(s, target) {
    const index = s.turn.shields.indexOf(target.id);
    if (index < 0) return false;
    s.turn.shields.splice(index, 1);
    target.notes.push('圣山庇佑抵挡了一次心魔技能。');
    return true;
  }

  function skill(s,p,a) {
    const r = role(p.role), id = p.id, target = s.seats[a.target];
    const hide = a.mode === 'mask' && r.id === 'shadow';
    const key = hide ? 'mask' : r.id;
    if (!living(p) || s.phase >= 4 || (p.uses[key] || 0) >= (hide ? 3 : r.limit) || s.turn.skills[key]) return '技能暂不可用。';
    const note = msg => p.notes.push('第 ' + (s.round + 1) + ' 轮 · ' + msg);
    switch (key) {
      case 'jangar':
        if (![1,2].includes(s.phase)) return '请在织梦或激梦阶段发动。';
        s.turn.ward = true;
        s.turn.bonus.push('团结');
        break;
      case 'hong':
        if (s.phase !== 1 || p.faith < 2) return '需要在织梦阶段且至少有两点信念。';
        faith(p,-1);
        s.turn.flags[id] = 'lion';
        break;
      case 'ceji':
        if (!target || id === target.id) return '请选择其他玩家。';
        note(target.name + (enemy(target) ? ' 属于影子阵营。' : ' 属于守护阵营。'));
        break;
      case 'agai':
        if (!target || target.faith >= 10 || !living(target)) return '请选择信念为 1–9 的玩家。';
        faith(target,1);
        if (target.id !== id) p.healed = true;
        break;
      case 'gu':
        if (!target || !living(target) || s.phase > 2) return '请选择仍有信念的玩家。';
        s.turn.shields.push(target.id);
        break;
      case 'ming':
        if (s.phase !== 2 || !target || target.id === id) return '请在激梦时选择其他玩家。';
        s.turn.flip.push(target.id);
        break;
      case 'mask':
        if (s.phase !== 1 || !tags.slice(0,4).includes(a.tag) || s.turn.acts[id]) return '请在提交叙事前选择要模仿的正面标签。';
        s.turn.mask = a.tag;
        break;
      case 'shadow':
        if (![1,3].includes(s.phase)) return '请在织梦或醒梦时发动。';
        if (a.mode === 'damage') {
          s.epic = limit(s.epic - 5,100);
          s.log.push('影子侵蚀 · 史诗完整度 −5');
          if (s.phase === 3) {
            s.reports.at(-1).end = s.epic;
            s.reports.at(-1).changes.push('影子侵蚀 −5');
          }
          break;
        }
        if (!target || target.id === id) return '请选择其他玩家。';
        if (a.mode === 'peek') {
          if (!shielded(s,target)) note(target.name + ' 的内心波动为「' + motionName(s.turn.acts[target.id]?.motion) + '」。');
          break;
        }
        if (s.phase !== 1) return '标签失效需要在织梦时发动。';
        if (!shielded(s,target)) s.turn.blocked.push(target.id);
        break;
      case 'spark':
        if (s.phase !== 1 || !target || target.id === id) return '请在织梦时选择其他玩家。';
        if (!shielded(s,target)) s.turn.blocked.push(target.id);
        break;
    }
    p.uses[key] = (p.uses[key] || 0) + 1;
    s.turn.skills[key] = true;
  }

  const motionName = type => ({fear:'直面恐惧',observe:'暗中观察',seed:'播下怀疑'})[type] || '无';

  function narrate(s,p,a) {
    if (s.turn.acts[p.id]) return '已提交叙事。';
    const tag = p.role === 'shadow' && s.turn.mask || a.tag;
    if (!tags.includes(tag)) return '请选择叙事标签。';
    const motion = a.motion || '';
    const extra = a.extra;
    const target = s.seats[a.target];
    if (motion && (![0,2].includes(s.round) || p.motions.includes(motion))) return '此轮无法使用该内心波动。';
    if (motion === 'fear' && (!tags.slice(0,4).includes(extra) || !living(p))) return '请为直面恐惧选择正面标签。';
    if (motion === 'observe' && (!target || target.id === p.id)) return '请选择观察对象。';
    if (motion === 'seed' && !enemy(p)) return '只有影子阵营可以播下怀疑。';
    if (motion && motionName(motion) === '无') return '无效的内心波动。';
    const story = String(a.story || '').trim().slice(0,200);
    if (motion) p.motions.push(motion);
    if (motion === 'fear') faith(p,-1);
    if (tag === '怀疑' && !enemy(p)) faith(p,-2);
    if (motion === 'seed') s.turn.pressure += 5;
    s.turn.acts[p.id] = {tag, story, motion, extra, target:target?.id};
  }

  function fillBots(s, all) {
    const chapter = chapters[s.round], t = s.turn;
    if (s.phase === 1) {
      const preference = Object.entries(chapter.need).flatMap(([tag,n]) => Array(n).fill(tag));
      for (const p of s.seats) {
        if (t.acts[p.id] || (!all && !p.bot)) continue;
        const tally = counts(s);
        const lacking = preference.find(tag => tally[tag] < chapter.need[tag]);
        const doubt = enemy(p) && Math.random() < (chapter.doubt ? .38 : .18);
        const tag = doubt ? '怀疑' : (lacking || pick(tags.slice(0,4)));
        const story = {
          勇气:'我迎向迷雾，守住同伴经过的路。',智慧:'我循着旧歌辨认被梦魇篡改的线索。',
          团结:'我向同伴递出手，一起把散落的篇章接起来。',牺牲:'我愿留下守住归路，让同伴先行。',怀疑:'我听见了两种号令，想再等等。'
        }[tag];
        narrate(s,p,{tag,story});
      }
      for (const p of s.seats) {
        if (!p.bot || !living(p)) continue;
        const others = s.seats.filter(v => v.id !== p.id && !enemy(v));
        if (p.role === 'spark' && Math.random() < .42 && others.length) skill(s,p,{target:pick(others).id});
        if (p.role === 'shadow' && Math.random() < .42) skill(s,p,{mode:'damage'});
        if (p.role === 'gu' && others.length) skill(s,p,{target:[...others].sort((a,b)=>a.faith-b.faith)[0].id});
      }
    }
    if (s.phase === 2) {
      for (const p of s.seats) {
        if (t.votes[p.id] !== undefined || (!all && !p.bot)) continue;
        if (p.bot && p.role === 'jangar' && (counts(s).怀疑 || chapter.need.团结)) skill(s,p,{});
        const hurt = s.seats.filter(v => living(v) && v.faith < 10).sort((a,b) => a.faith-b.faith);
        if (p.bot && p.role === 'agai' && hurt.length) skill(s,p,{target:hurt[0].id});
        t.votes[p.id] = !enemy(p);
      }
    }
  }

  function settle(s) {
    const c = chapters[s.round], t = s.turn, tally = counts(s);
    const success = tally.怀疑 <= c.doubt && Object.keys(c.need).every(tag => tally[tag] >= c.need[tag]);
    const full = s.seats.filter(p => t.flip.includes(p.id) ? !t.votes[p.id] : t.votes[p.id]).length + Number(!!t.ward);
    const majority = full > s.seats.length - full + Number(!!t.ward);
    const start = s.epic;
    const changes = [];
    const adjust = (n, label) => { if (n) changes.push(label + ' ' + (n > 0 ? '+' : '−') + Math.abs(n)); s.epic += n; };
    adjust(success ? c.gain : -c.loss, success ? '挑战达成' : '挑战失败');
    if (majority) adjust(success ? 20 : 15,'全力修复占优');
    adjust(-5*tally.怀疑,'怀疑侵蚀');
    adjust(-t.pressure,'内心波动侵蚀');
    if (!success && s.round === 3) adjust(-Math.round(Math.max(0,s.epic)*.2),'圣山受损');
    s.epic = limit(s.epic,100);
    for (const p of s.seats) {
      if (living(p)) faith(p, (majority ? 0 : -1) + (success ? c.heal : s.round < 2 ? -c.hurt : 0));
      const a = t.acts[p.id];
      if (a?.motion === 'observe') p.notes.push(s.seats[a.target].name + ' 的内心波动为「' + motionName(t.acts[a.target]?.motion) + '」。');
    }
    if (!success && s.round === 2) s.seats.filter(living).sort((a,b)=>a.faith-b.faith).slice(0,2).forEach(p=>faith(p,-2));
    const best = s.seats.filter(p => living(p) && t.acts[p.id]?.story && !t.blocked.includes(p.id) && t.acts[p.id].tag !== '怀疑')
      .sort((a,b)=>Number(t.acts[b.id].motion === 'fear')-Number(t.acts[a.id].motion === 'fear') || t.acts[b.id].story.length-t.acts[a.id].story.length)[0];
    if (best) faith(best,1);
    const whisper = s.seats.filter(p=>living(p) && !enemy(p)).sort((a,b)=>a.faith-b.faith)[0];
    if (whisper && s.seats.some(p=>p.role === 'shadow' && living(p)) && !shielded(s,whisper)) {
      faith(whisper,-2);
      whisper.notes.push('心魔低语使你的信念 −2。请留意下轮的标签与令牌。');
    }
    s.reports.push({success, tally, full, reserve:s.seats.length-full+Number(!!t.ward), start, end:s.epic, changes, best:best?.name,
      clues:s.seats.map(p=>({id:p.id, doubt:t.acts[p.id]?.tag === '怀疑' || t.acts[p.id]?.motion === 'seed', text:t.acts[p.id]?.story || ''}))});
    s.log.push(c.short + ' · ' + (success ? '挑战达成' : '挑战失败') + ' · ' + s.epic + '/100');
  }

  function advance(s) {
    if (s.phase === 1 || s.phase === 2) fillBots(s,true);
    if (s.phase === 2) settle(s);
    if (s.phase === 3 && s.round < 3) {
      s.round++;
      s.phase = 0;
      s.turn = fresh();
    } else {
      s.phase++;
    }
    s.turn.ready = {};
    if (s.phase === 5) finish(s);
    setDeadline(s);
  }

  function finish(s) {
    const villains = s.seats.filter(p=>role(p.role).enemy);
    const suspicions = s.seats.map(p=>s.reports.reduce((n,r)=>n + Number(r.clues[p.id].doubt),0));
    for (const p of s.seats.filter(p=>p.bot && living(p))) {
      const targets = s.seats.filter(q=>q.id!==p.id);
      if (enemy(p)) targets.sort((a,b)=>Number(enemy(a))-Number(enemy(b)) || a.faith-b.faith);
      else targets.sort((a,b)=>suspicions[b.id]-suspicions[a.id] || Math.random()-.5);
      s.votes[p.id] = targets.slice(0,2).map(q=>q.id);
    }
    const raw = (s.online ? Object.values(s.votes) : [s.votes[0] || []]).flat();
    const tally = s.seats.map(p=>({id:p.id, n:raw.filter(i=>i===p.id).length})).sort((a,b)=>b.n-a.n);
    const cutoff = tally[2]?.n || 0;
    const selected = tally.slice(0,2).filter(x=>x.n > cutoff).map(x=>x.id);
    s.detected = villains.filter(p=>selected.includes(p.id)).map(p=>p.id);
    const survivors = s.seats.filter(living).length, zero = s.seats.length-survivors;
    const leader = s.seats.find(p=>p.role==='jangar');
    if (s.epic <= 20 && survivors <= 2 && !living(leader)) s.ending = 'tragedy';
    else if (s.epic <= 40 || zero >= 3) s.ending = 'shadow';
    else if (s.epic >= 90 && zero === 0 && s.detected.length === 2) s.ending = 'perfect';
    else if (s.epic >= 80 && survivors >= 3 && s.detected.length) s.ending = 'standard';
    else s.ending = 'neutral';
    s.branches = [
      leader.faith >= 8 && '江格尔仍有高信念，史诗得以缓慢修复。',
      !living(s.seats.find(p=>p.role==='hong')) && '洪古尔信念归零，雄狮陨落。',
      s.seats.filter(p=>['hong','gu','ming'].includes(p.role)).every(living) && leader.faith < 8 && '战士们仍然并肩，却难以在迷雾中找到方向。',
    ].filter(Boolean);
  }

  function act(s,id,a) {
    const p = s.seats[id];
    if (!p || !a || s.phase >= 5) return '对局已结束或席位无效。';
    const t = s.turn;
    if (a.kind === 'chat') {
      const message = String(a.text || '').trim().slice(0,200);
      if (!message) return '请输入消息。';
      if (a.secret && !enemy(p)) return '影子密语仅对影子阵营开放。';
      s.chat.push({id, message, secret:!!a.secret});
      s.chat = s.chat.slice(-80);
      return;
    }
    if (a.kind === 'skill') return skill(s,p,a);
    if (a.kind === 'narrate' && s.phase === 1) {
      const error = narrate(s,p,a);
      if (error) return error;
    } else if (a.kind === 'vote' && s.phase === 2) {
      if (typeof a.full !== 'boolean' || t.votes[id] !== undefined) return '修复令牌已提交或无效。';
      t.votes[id] = a.full;
    } else if (a.kind === 'accuse' && s.phase === 4) {
      if (!living(p) || s.votes[id]) return '当前席位无法再次指认。';
      const suspects = Array.isArray(a.targets) ? [...new Set(a.targets)] : null;
      if (!suspects || suspects.length > 2 || suspects.some(i=>!Number.isInteger(i) || !s.seats[i] || i===id)) return '请选择至多两位其他玩家。';
      s.votes[id] = suspects;
    } else if (a.kind === 'ready' && [0,2,3,4].includes(s.phase)) {
      if (s.phase === 4 && living(p) && !s.votes[id]) return '请先提交指认。';
      if (s.phase === 2 && t.votes[id] === undefined) return '请先提交令牌。';
      t.ready[id] = true;
    } else return '当前阶段无法使用此操作。';
    const humans = s.seats.filter(q=>!q.bot);
    if (humans.every(q=>s.phase===1 ? t.acts[q.id] : t.ready[q.id] || (s.phase===4 && !!s.votes[q.id]))) advance(s);
  }

  function view(s,id) {
    const t = s.turn, self = s.seats[id];
    return {
      online:s.online, round:s.round, phase:s.phase, epic:s.epic, deadline:s.deadline, log:s.log, ending:s.ending, branches:s.branches, detected:s.detected,
      seats:s.seats.map(p=>({ id:p.id, name:p.name, bot:p.bot, faith:p.faith, role:p.id===id || s.phase===5 ? p.role : undefined })),
      me:{...self, enemy:enemy(self)}, ally:enemy(self) ? s.seats.filter(p=>enemy(p) && p.id!==id).map(p=>p.id) : [],
      reports:s.reports.map(r=>({...r, clues:r.clues.map(c=>({id:c.id,text:c.text,doubt:s.phase>=4 ? c.doubt : undefined}))})),
      chat:s.chat.filter(m=>!m.secret || enemy(self)),
      submitted:!!(s.phase===1 ? t.acts[id] : t.ready[id]), voted:t.votes[id]!==undefined, accused:!!s.votes[id],
      progress:s.seats.filter(p=>!p.bot && (s.phase===1 ? t.acts[p.id] : s.phase===2 ? t.votes[p.id]!==undefined : s.phase===4 ? s.votes[p.id] || t.ready[p.id] : t.ready[p.id])).length,
      tally:s.phase===2 ? counts(s) : null, used:!!t.skills[self.role], masked:!!t.skills.mask, maskTag:self.role==='shadow' ? t.mask : undefined,
    };
  }

  return { create, players, act, view, advance, role, phases };
})();
