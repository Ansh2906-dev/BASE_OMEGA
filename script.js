'use strict';

/* =====================================================================
   BASE OMEGA — Junior Astronaut Mission Trainer
   Game logic. All numbers are simplified for learning, not real physics.
   ===================================================================== */

(() => {

  /* ---------- NASA DONKI sample data ----------
     A small SAVED SAMPLE of solar-flare records in the style of NASA's
     DONKI "FLR" (solar flare) catalogue. This is NOT a live API call.
     TODO (see README "Future Development"): verify each record against
     https://kauai.ccmc.gsfc.nasa.gov/DONKI/ and replace placeholders
     (entries with date: null) with real DONKI records before publishing
     them as verified data.                                                */
  const DONKI_SAMPLE = [
    { flrID: 'SAMPLE-C-01', classType: 'C2.4', date: null,         region: null, verified: false },
    { flrID: 'SAMPLE-C-02', classType: 'C7.1', date: null,         region: null, verified: false },
    { flrID: 'SAMPLE-M-01', classType: 'M1.6', date: null,         region: null, verified: false },
    { flrID: 'SAMPLE-M-02', classType: 'M4.3', date: null,         region: null, verified: false },
    { flrID: 'SAMPLE-X-01', classType: 'X5.8', date: '2024-05-11', region: 3664, verified: false },
    { flrID: 'SAMPLE-X-02', classType: 'X8.7', date: '2024-05-14', region: 3664, verified: false },
    { flrID: 'SAMPLE-X-03', classType: 'X9.0', date: '2024-10-03', region: 3842, verified: false }
  ];

  /* ---------- Game constants ---------- */
  const MAX_DAYS = 10;
  const CREW = 4;

  const O2_USE = 15;          // oxygen the crew breathes per day
  const WATER_USE = 8;        // water the crew uses per day
  const RECYCLE_WATER = 7;    // water recycled per day at 100% equipment
  const RECYCLE_POWER = 3;    // power used by the water recycler
  const SOLAR = 22;           // power from solar panels per day
  const BASE_RAD = 2;         // background radiation per day
  const INCOME = 12;          // funding added each day
  const MAINT_COST = 8;
  const MAINT_GAIN = 8;
  const MAINT_POWER = 3;
  const FLARE_CHANCE = 0.35;  // chance of a flare on days 2–10

  const FOOD = {
    low:    { food: 5,  happy: -6 },
    normal: { food: 9,  happy: 0 },
    feast:  { food: 13, happy: 6 }
  };
  const OXYGEN = {
    low:    { o2: 8,  power: 4,  water: 0 },
    normal: { o2: 14, power: 8,  water: 2 },
    high:   { o2: 20, power: 13, water: 5 }
  };
  const MODES = {
    normal:  { power: 14, happy: 0,  wear: 3, rad: 1 },
    eco:     { power: 8,  happy: -3, wear: 2, rad: 1 },
    shelter: { power: 20, happy: -4, wear: 2, rad: 0.3 }
  };
  const CRATES = {
    none:   { label: 'No order',     cost: 0 },
    oxygen: { label: 'Oxygen tanks', cost: 25, res: 'oxygen',    amt: 30 },
    water:  { label: 'Water tanks',  cost: 20, res: 'water',     amt: 30 },
    food:   { label: 'Food crates',  cost: 20, res: 'food',      amt: 30 },
    power:  { label: 'Power cells',  cost: 25, res: 'power',     amt: 30 },
    parts:  { label: 'Spare parts',  cost: 30, res: 'equipment', amt: 30 }
  };

  const FLARE_CLASSES = {
    C: { dose: 4,  damage: 0, strength: 'small' },
    M: { dose: 12, damage: 2, strength: 'medium' },
    X: { dose: 26, damage: 5, strength: 'strong' }
  };

  const RES = [
    { key: 'oxygen',    label: 'Oxygen',    icon: '🫁', hint: 'Essential for crew survival' },
    { key: 'water',     label: 'Water',     icon: '💧', hint: 'Recycling and oxygen production' },
    { key: 'food',      label: 'Food',      icon: '🍲', hint: 'Keeps the crew going' },
    { key: 'power',     label: 'Power',     icon: '🔋', hint: 'Runs essential equipment' },
    { key: 'equipment', label: 'Equipment', icon: '🛠️', hint: 'Supports life support' },
    { key: 'radiation', label: 'Radiation', icon: '☢️', hint: 'Exposure — keep it LOW' },
    { key: 'happiness', label: 'Happiness', icon: '😊', hint: 'Crew morale' },
    { key: 'funding',   label: 'Funding',   icon: '💰', hint: 'Credits for supplies' }
  ];

  const FLARE_LESSONS = {
    C: 'Solar flares are ranked A, B, C, M and X — and each letter is 10 times stronger than the one before. C-class flares are small.',
    M: 'M-class flares are medium-sized. They can cause short radio blackouts and add some extra radiation for astronauts.',
    X: 'X-class flares are the strongest. Crews move into shielded areas, called shelters, to stay safe from the extra radiation.'
  };

  const GENERAL_LESSONS = [
    'Astronauts can make oxygen by splitting water into hydrogen and oxygen using electricity. That is why oxygen, water and power are all connected!',
    'Space stations recycle most of their water — even water from the air — so it can be used again.',
    'Resupply rockets can take days or even weeks to arrive, so space explorers must plan ahead.',
    'Happy crews work better. Space agencies think carefully about food, rest and fun for astronauts.',
    'The Moon has almost no atmosphere and no global magnetic field, so there is less natural protection from space radiation.',
    'One day-and-night cycle on the Moon lasts about 29.5 Earth days, so lunar outposts must plan their power very carefully.',
    'Machines wear out. Regular maintenance keeps life-support systems working safely.',
    'Engineers call this "systems thinking": changing one part of a system can affect every other part.',
    'Space agencies like NASA watch the Sun every day so they can warn astronauts about space weather.',
    'Every mission is a team effort. Planning, testing and learning from mistakes keeps astronauts safe.'
  ];

  /* ---------- State ---------- */
  let state = null;

  /* ---------- DOM helpers ---------- */
  const $ = (id) => document.getElementById(id);
  const refs = {};

  function openDialog(d) {
    if (typeof d.showModal === 'function') {
      if (!d.open) d.showModal();
    } else {
      d.setAttribute('open', '');
    }
  }
  function closeDialog(d) {
    if (typeof d.close === 'function') d.close();
    else d.removeAttribute('open');
  }

  let toastTimer = null;
  function toast(msg) {
    const t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, 3500);
  }

  const clamp = (v, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));

  /* ---------- Flares ---------- */
  function flareInfo(rec) {
    const letter = rec.classType[0];
    const num = parseFloat(rec.classType.slice(1)) || 1;
    const base = FLARE_CLASSES[letter] || FLARE_CLASSES.C;
    return {
      letter,
      dose: Math.round(base.dose + Math.min(num, 10)),
      damage: base.damage,
      strength: base.strength
    };
  }

  function rollFlare() {
    if (state.day < 2) return null;
    const forced = state.day === 6 && state.flaresSeen === 0;
    if (forced || Math.random() < FLARE_CHANCE) {
      state.flaresSeen += 1;
      return DONKI_SAMPLE[Math.floor(Math.random() * DONKI_SAMPLE.length)];
    }
    return null;
  }

  /* ---------- New game ---------- */
  function newGame() {
    state = {
      day: 1,
      oxygen: 80, water: 80, food: 80, power: 80,
      equipment: 100, funding: 100, radiation: 0, happiness: 80,
      pending: [],
      flare: null,
      flaresSeen: 0,
      over: false
    };
    $('log').innerHTML = '';
    // Reset plan controls to defaults
    document.querySelector('input[name="food"][value="normal"]').checked = true;
    document.querySelector('input[name="oxygen"][value="normal"]').checked = true;
    document.querySelector('input[name="mode"][value="normal"]').checked = true;
    document.querySelector('input[name="delivery"][value="standard"]').checked = true;
    $('crate').value = 'none';
    $('maintenance').checked = false;
    render();
  }

  /* ---------- Reading the plan ---------- */
  function readPlan() {
    const val = (n) => document.querySelector(`input[name="${n}"]:checked`).value;
    return {
      food: val('food'),
      oxygen: val('oxygen'),
      mode: val('mode'),
      delivery: val('delivery'),
      crate: $('crate').value,
      maint: $('maintenance').checked
    };
  }

  function planCost(plan) {
    const crate = CRATES[plan.crate].cost * (plan.delivery === 'express' ? 2 : 1);
    return crate + (plan.maint ? MAINT_COST : 0);
  }

  /* ---------- Rendering ---------- */
  function level(key, v) {
    if (key === 'radiation') return v <= 40 ? 'good' : v <= 70 ? 'warn' : 'danger';
    if (key === 'funding')   return v >= 40 ? 'good' : v >= 15 ? 'warn' : 'danger';
    return v >= 50 ? 'good' : v >= 25 ? 'warn' : 'danger';
  }

  function buildResourceCards() {
    const wrap = $('resources');
    wrap.innerHTML = '';
    RES.forEach((r) => {
      const card = document.createElement('article');
      card.className = 'res';
      card.innerHTML =
        '<div class="res-head"><span class="res-icon" aria-hidden="true">' + r.icon + '</span><h3>' + r.label + '</h3></div>' +
        '<div class="res-val">–</div>' +
        '<div class="track" role="progressbar" aria-label="' + r.label + '" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="bar"></div></div>' +
        '<p class="res-hint">' + r.hint + '</p>';
      wrap.appendChild(card);
      refs[r.key] = {
        card,
        val: card.querySelector('.res-val'),
        track: card.querySelector('.track'),
        bar: card.querySelector('.bar')
      };
    });
  }

  function renderResources() {
    RES.forEach((r) => {
      const v = Math.round(state[r.key]);
      const ref = refs[r.key];
      const pct = r.key === 'funding' ? Math.min(100, v / 2) : v;
      ref.val.textContent = r.key === 'funding' ? v + ' cr' : v + '%';
      ref.bar.style.width = pct + '%';
      ref.track.setAttribute('aria-valuenow', String(Math.round(pct)));
      ref.card.dataset.level = level(r.key, v);
    });
  }

  function renderAlert() {
    const box = $('alertBox');
    box.className = 'alert';
    if (!state.flare) {
      box.classList.add('calm');
      box.innerHTML = '<strong>☀️ Space weather: calm</strong>No solar flares are expected today.';
      return;
    }
    const info = flareInfo(state.flare);
    const src = state.flare.date
      ? 'DONKI sample record · ' + state.flare.date + (state.flare.region ? ' · active region ' + state.flare.region : '')
      : 'DONKI sample record';
    box.classList.add(info.letter === 'X' ? 'storm' : 'flare');
    box.innerHTML =
      '<strong>🚨 Solar flare alert! Class ' + state.flare.classType + ' (' + info.strength + ')</strong>' +
      'It will hit the Moon today and raise radiation by about ' + info.dose + '% if the crew is not protected. ' +
      'Tip: choose <em>Shelter</em> mode to block most of it. <span class="muted">(' + src + ')</span>';
  }

  function renderIncoming() {
    const ul = $('incoming');
    ul.innerHTML = '';
    if (!state.pending.length) {
      ul.innerHTML = '<li class="empty">Nothing on the way. Resupply is delayed, so order early!</li>';
      return;
    }
    state.pending
      .slice()
      .sort((a, b) => a.arrive - b.arrive)
      .forEach((p) => {
        const li = document.createElement('li');
        li.textContent = '📦 ' + CRATES[p.crate].label + ' — arrives at the start of Day ' + p.arrive;
        ul.appendChild(li);
      });
  }

  function renderCost() {
    const plan = readPlan();
    const cost = planCost(plan);
    const el = $('costPreview');
    let msg = 'Today\'s plan costs ' + cost + ' credits (you have ' + Math.round(state.funding) + ').';
    el.classList.remove('bad');
    if (cost > state.funding) {
      msg = 'Not enough funding: this plan costs ' + cost + ' credits but you only have ' + Math.round(state.funding) + '.';
      el.classList.add('bad');
    } else if (plan.crate !== 'none') {
      const arrive = state.day + (plan.delivery === 'express' ? 1 : 2);
      msg += arrive > MAX_DAYS
        ? ' ⚠️ This order would arrive after the mission ends.'
        : ' Delivery arrives at the start of Day ' + arrive + '.';
    }
    el.textContent = msg;
  }

  function render() {
    $('dayLabel').textContent = 'Day ' + state.day + ' of ' + MAX_DAYS;
    $('dayProgress').value = state.day;
    renderResources();
    renderAlert();
    renderIncoming();
    renderCost();
  }

  /* ---------- Day resolution ---------- */
  function snapshot() {
    const o = {};
    RES.forEach((r) => { o[r.key] = Math.round(state[r.key]); });
    return o;
  }

  function lossReason(s) {
    if (s.oxygen <= 0)     return 'The oxygen ran out. Life support needs oxygen every single day — try higher oxygen production or order oxygen tanks early.';
    if (s.water <= 0)      return 'The water ran out. Water is used for drinking and for making oxygen, and recycling slows down when equipment is worn.';
    if (s.food <= 0)       return 'The food ran out. Space crews need regular meals — order food crates before the supply gets low.';
    if (s.power <= 0)      return 'The power ran out and life support shut down. Watch your power and consider Eco mode or power cells.';
    if (s.equipment <= 0)  return 'The equipment broke down. Maintenance and spare parts keep life support running.';
    if (s.radiation >= 100) return 'The crew was exposed to too much radiation. Use Shelter mode when a solar flare is coming!';
    if (s.happiness <= 0)  return 'Crew morale collapsed. Good food and rest matter just as much as air and water.';
    return null;
  }

  function pickLesson(flareToday, plan) {
    if (flareToday) {
      const L = flareInfo(flareToday).letter;
      let txt = FLARE_LESSONS[L] || FLARE_LESSONS.C;
      if (plan.mode === 'shelter') txt += ' Good call using Shelter mode today!';
      else if (L !== 'C') txt += ' Next time, try Shelter mode when you get an alert.';
      return txt;
    }
    return GENERAL_LESSONS[(state.day - 1) % GENERAL_LESSONS.length];
  }

  function endDay() {
    if (state.over) return;
    const s = state;
    const plan = readPlan();
    const cost = planCost(plan);

    if (cost > s.funding) {
      toast('Not enough funding for this plan. Pick a cheaper option!');
      return;
    }

    const before = snapshot();
    const lines = [];
    const dayDone = s.day;
    const flareToday = s.flare;
    const F = FOOD[plan.food];
    const O = OXYGEN[plan.oxygen];
    const M = MODES[plan.mode];

    s.funding -= cost;

    if (plan.crate !== 'none') {
      const wait = plan.delivery === 'express' ? 1 : 2;
      s.pending.push({ crate: plan.crate, arrive: s.day + wait });
      lines.push('📦 Ordered ' + CRATES[plan.crate].label + ' — arrives at the start of Day ' + (s.day + wait) + (s.day + wait > MAX_DAYS ? ' (too late for this mission!)' : '') + '.');
    }
    if (plan.maint) {
      s.equipment += MAINT_GAIN;
      lines.push('🔧 The maintenance crew repaired some equipment.');
    }

    // Life support
    s.oxygen += O.o2 - O2_USE;
    const recycled = Math.round(RECYCLE_WATER * clamp(s.equipment) / 100);
    s.water += recycled - WATER_USE - O.water;
    s.food -= F.food;
    s.power += SOLAR - M.power - O.power - RECYCLE_POWER - (plan.maint ? MAINT_POWER : 0);

    // Radiation and flare damage
    let dose = BASE_RAD * M.rad;
    let damage = 0;
    if (flareToday) {
      const info = flareInfo(flareToday);
      const flareDose = info.dose * M.rad;
      dose += flareDose;
      damage = info.damage * (plan.mode === 'shelter' ? 0.4 : 1);
      if (plan.mode === 'shelter') {
        lines.push('🛡️ A class ' + flareToday.classType + ' flare hit, but Shelter mode kept radiation to only +' + Math.round(flareDose) + '%.');
      } else {
        lines.push('☀️ A class ' + flareToday.classType + ' flare hit the outpost: radiation +' + Math.round(flareDose) + '%.');
      }
    }
    s.radiation += dose;

    // Equipment wear
    let wear = M.wear + damage;
    if (s.power < 15) {
      wear += 4;
      lines.push('⚡ Low power strained the equipment.');
    }
    s.equipment -= wear;

    // Round and clamp the physical resources first
    ['oxygen', 'water', 'food', 'power', 'equipment', 'radiation'].forEach((k) => {
      s[k] = clamp(Math.round(s[k]));
    });

    // Happiness depends on the new values
    let mood = F.happy + M.happy;
    if (s.radiation > 60) { mood -= 4; lines.push('😟 The crew is worried about high radiation.'); }
    if (s.power < 20)     { mood -= 3; lines.push('😟 The crew is uncomfortable with so little power.'); }
    if (s.oxygen < 30)    { mood -= 3; lines.push('😟 The air feels thin and the crew is anxious.'); }
    if (mood >= 0 && s.oxygen >= 30 && s.power >= 20 && s.radiation <= 60) mood += 1;
    s.happiness = clamp(Math.round(s.happiness + mood));

    // Did we lose?
    const reason = lossReason(s);
    if (reason) {
      finish(false, reason);
      return;
    }

    // Did we win?
    if (s.day >= MAX_DAYS) {
      finish(true, 'The crew is safe and the outpost is still running after ' + MAX_DAYS + ' days. Great job, Commander!');
      return;
    }

    // Start next day
    s.day += 1;
    s.funding += INCOME;

    const arrived = s.pending.filter((p) => p.arrive === s.day);
    s.pending = s.pending.filter((p) => p.arrive !== s.day);
    arrived.forEach((p) => {
      const c = CRATES[p.crate];
      s[c.res] = clamp(s[c.res] + c.amt);
      lines.push('📬 ' + c.label + ' arrived! +' + c.amt + ' ' + c.res + '.');
    });

    s.flare = rollFlare();

    // Warnings for the new day
    RES.forEach((r) => {
      if (r.key !== 'funding' && level(r.key, s[r.key]) === 'danger') {
        lines.push('⚠️ Watch out: ' + r.label.toLowerCase() + ' is in the danger zone.');
      }
    });

    const after = snapshot();
    const lesson = pickLesson(flareToday, plan);

    render();
    logDay(dayDone, lines);
    showSummary(dayDone, before, after, lines, lesson);
  }

  /* ---------- Summary / log ---------- */
  function showSummary(dayDone, before, after, lines, lesson) {
    $('summaryTitle').textContent = 'Day ' + dayDone + ' complete ✅';

    const chips = RES.map((r) => {
      const d = after[r.key] - before[r.key];
      if (d === 0) return '';
      const good = r.key === 'radiation' ? d < 0 : d > 0;
      return '<span class="chip ' + (good ? 'up' : 'down') + '">' + r.icon + ' ' + r.label + ' ' + (d > 0 ? '+' : '−') + Math.abs(d) + '</span>';
    }).join('');

    const items = lines.length
      ? '<ul class="sum-lines">' + lines.map((l) => '<li>' + l + '</li>').join('') + '</ul>'
      : '<p class="muted">A quiet day on the Moon.</p>';

    $('summaryBody').innerHTML =
      '<div class="chips" aria-label="Changes today">' + chips + '</div>' +
      items +
      '<div class="learn"><strong>💡 Did you know?</strong><br>' + lesson + '</div>';

    $('nextDayBtn').textContent = 'Start Day ' + state.day + ' ▶';
    openDialog($('summaryDialog'));
  }

  function logDay(day, lines) {
    const li = document.createElement('li');
    const text = lines.filter((l) => l.indexOf('Watch out') === -1);
    li.textContent = 'Day ' + day + ': ' + (text.length ? text.join(' ') : 'A quiet day.');
    $('log').prepend(li);
  }

  /* ---------- End of mission ---------- */
  function finish(win, message) {
    state.over = true;
    render();

    const s = state;
    const score = Math.round((s.oxygen + s.water + s.food + s.power + s.equipment + s.happiness + (100 - s.radiation)) / 7);
    let stars = '⭐';
    let rank = 'Survivor';
    if (score >= 70) { stars = '⭐⭐⭐'; rank = 'Mission Commander'; }
    else if (score >= 50) { stars = '⭐⭐'; rank = 'Flight Officer'; }

    $('endTitle').textContent = win ? '🎉 Mission complete!' : '💥 Mission failed';

    let body = '<p>' + message + '</p>';
    if (win) {
      body +=
        '<p class="stars" aria-hidden="true">' + stars + '</p>' +
        '<p>Your rank: <strong>' + rank + '</strong></p>' +
        '<p class="score">Score: ' + score + ' / 100</p>' +
        '<p class="muted">Score is the average of your oxygen, water, food, power, equipment, happiness and radiation safety on the final day.</p>';
    } else {
      body += '<p class="muted">You reached Day ' + s.day + ' of ' + MAX_DAYS + '. Every real mission learns from problems — try a new plan!</p>';
    }
    $('endBody').innerHTML = body;

    openDialog($('endDialog'));
  }

  /* ---------- Wire up ---------- */
  function init() {
    buildResourceCards();
    newGame();

    $('endDayBtn').addEventListener('click', endDay);
    $('nextDayBtn').addEventListener('click', () => {
      closeDialog($('summaryDialog'));
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    $('restartBtn').addEventListener('click', () => {
      closeDialog($('endDialog'));
      newGame();
      window.scrollTo({ top: 0 });
    });
    $('startBtn').addEventListener('click', () => closeDialog($('introDialog')));
    $('helpBtn').addEventListener('click', () => openDialog($('introDialog')));

    // Keep the cost preview live
    document.querySelectorAll('input[name="delivery"], #crate, #maintenance').forEach((el) => {
      el.addEventListener('change', renderCost);
    });

    openDialog($('introDialog'));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
