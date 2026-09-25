import { initialState, canSelectTrack, selectTrack, encodeState, decodeState, moveSkill, focusSkill } from './skill-lab-state.mjs?v=20260923-empty';
const $ = id => document.getElementById(id);
const board = $('lab-board'), picker = $('lab-picker');
const mobile = matchMedia('(max-width: 900px)');
let data, state, pickerTrigger, pickerContext, dragged = null, transitioning = false, transitionRevision = 0;
const escape = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'}[c]));
const img = item => `<img src="./${escape(item.icon)}?v=trimmed2" alt="" draggable="false">`;
const arrow = '<span class="lab-arrow" aria-hidden="true">▶</span>';
const pad = n => mobile.matches ? String(n + 1).padStart(2, '0') : String(n + 1);
function announce(message) { $('lab-status').textContent = message; }
function syncUrl() {
  const url = new URL(location.href);
  url.hash = `lab=${encodeState(state)}`;
  history.replaceState(null, '', url);
}
function commit(message = '') { render(); syncUrl(); announce(message); }
function chooser(kind, index, item, label) {
  const isSpecial = kind === 'exotic' || kind === 'nightmare';
  if (!item) return `<button class="lab-choose is-empty" type="button" data-pick="${kind}" data-index="${index}" aria-label="${label}を選択：未選択" aria-haspopup="dialog" aria-controls="lab-picker">${isSpecial ? '' : '<span aria-hidden="true"></span>'}<span class="lab-track-label"><span class="lab-slot">${label}</span><span class="lab-name lab-empty-name">スキルを選択</span></span>${arrow}</button>`;
  const content = isSpecial
    ? `<span class="lab-slot">${label}</span>${img(item)}<span class="lab-name">${escape(item.name)}</span>`
    : `${img(item)}<span class="lab-track-label"><span class="lab-slot">${label}</span><span class="lab-name">${escape(item.name)}</span></span>`;
  return `<button class="lab-choose" type="button" data-pick="${kind}" data-index="${index}" aria-label="${label}を選択：${escape(item.name)}" aria-haspopup="dialog" aria-controls="lab-picker">${content}${arrow}</button>`;
}
function trackHTML(index) {
  const slot = state.slots[index], track = slot.track === null ? null : data.tracks[slot.track];
  if (!track) return `<section class="lab-track" aria-label="SKILL ${pad(index)}" data-slot="${index}"><div class="lab-track-head">${chooser('track', index, null, `SKILL ${pad(index)}`)}</div>${mobile.matches ? '' : '<ol class="lab-skill-list lab-empty-list" aria-hidden="true">' + '<li class="lab-skill"></li>'.repeat(6) + '</ol>'}</section>`;
  const focused = slot.focus === null ? null : track.skills[slot.focus];
  const description = track.description.length > 110
    ? `<details><summary>トラックの説明</summary><p>${escape(track.description)}</p></details>`
    : escape(track.description);
  return `<section class="lab-track" aria-label="SKILL ${pad(index)}" data-slot="${index}">
  <div class="lab-track-head">${chooser('track', index, track, `SKILL ${pad(index)}`)}<div class="lab-track-description">${description}</div></div>
  <ol class="lab-skill-list">${slot.order.map((skillIndex, position) => {
    const skill = track.skills[skillIndex];
    return `<li class="lab-skill" draggable="false" data-position="${position}" data-skill="${skillIndex}">${img(skill)}<div><h3>${escape(skill.name)}</h3><p>${escape(skill.description)}</p></div><div class="lab-move"><button type="button" data-move="-1" aria-label="${escape(skill.name)}を上へ" ${position === 0 ? 'disabled' : ''}>↑</button><button type="button" data-move="1" aria-label="${escape(skill.name)}を下へ" ${position === slot.order.length - 1 ? 'disabled' : ''}>↓</button></div></li>`;
  }).join('')}</ol>
  <button class="lab-focus" type="button" data-pick="skill" data-index="${index}" aria-label="SKILL ${pad(index)}の注目スキルを選択：${escape(focused?.name ?? '未選択')}" aria-haspopup="dialog" aria-controls="lab-picker"><span class="lab-focus-title">${arrow}${focused ? img(focused) : ''}<strong>${escape(focused?.name ?? '注目スキルを選択')}</strong></span><span class="lab-focus-description">${escape(focused?.description ?? '')}</span></button>
  </section>`;
}
function specialHTML(kind, index) {
  const selected = state[kind][index];
  const skill = selected === null ? null : data[kind][selected];
  if (!skill) return `<section class="lab-special" aria-label="${kind.toUpperCase()} ${index + 1}">${chooser(kind, index, null, kind.toUpperCase())}${mobile.matches ? '' : '<div class="lab-effects" aria-hidden="true">' + '<p class="lab-effect"></p>'.repeat(3) + '</div>'}</section>`;
  return `<section class="lab-special" aria-label="${kind.toUpperCase()} ${index + 1}">${chooser(kind, index, skill, kind.toUpperCase())}<div class="lab-effects">${skill.effects.map((effect, level) => `<p class="lab-effect"><span class="desktop-hint">${['', 'アップグレード：', '最終アップグレード：'][level]}</span><span class="mobile-hint lab-level">LV${level + 1} </span>${escape(effect)}</p>`).join('')}</div></section>`;
}
function prestigeButton(level, expanded, target) {
  return `<button type="button" class="lab-prestige-divider" data-prestige="${level}" aria-expanded="${expanded}" aria-controls="${target}">プレステージ${level}<span aria-hidden="true">${expanded ? '▴' : '▾'}</span></button>`;
}
function groupHTML(kind) {
  const level = kind === 'exotic' ? 1 : 2, expanded = state.prestige >= level;
  return `<div class="lab-special-group">${specialHTML(kind, 0)}${state.prestige === 3 ? '' : prestigeButton(level, expanded, `lab-extra-${kind}`)}<div class="lab-extra" id="lab-extra-${kind}" ${expanded ? '' : 'hidden'}>${expanded ? specialHTML(kind, 1) : ''}</div></div>`;
}
function render() {
  closeInlinePicker(false);
  const config = data.prestige[state.prestige];
  board.classList.toggle('is-prestige-3', state.prestige === 3);
  board.innerHTML = Array.from({ length: config.tracks }, (_, i) => trackHTML(i)).join('') + groupHTML('exotic') + groupHTML('nightmare') + `<div class="lab-p3-note">${prestigeButton(3, state.prestige === 3, 'lab-board')}</div>`;
  if (state.prestige === 3 && mobile.matches) {
    const fourth = board.querySelector('[data-slot="3"]');
    board.append(fourth);
    fourth.before(board.querySelector('.lab-p3-note'));
  }
}
async function togglePrestige(level) {
  if (transitioning) return;
  const revision = ++transitionRevision;
  const next = state.prestige >= level ? level - 1 : level;
  const fade = (state.prestige === 3 || next === 3) && !matchMedia('(prefers-reduced-motion: reduce)').matches;
  transitioning = true;
  try {
    if (fade) await board.animate([{opacity: 1}, {opacity: 0}], {duration: 180, fill: 'forwards'}).finished;
    if (revision !== transitionRevision) return;
    state.prestige = next;
    commit();
    board.getAnimations().forEach(animation => animation.cancel());
    if (fade) await board.animate([{opacity: 0}, {opacity: 1}], {duration: 240}).finished;
    board.querySelector(`[data-prestige="${level}"]`)?.focus({preventScroll: true});
  } catch (error) {
    if (error.name !== 'AbortError') throw error;
  } finally { if (revision === transitionRevision) transitioning = false; }
}
function openPicker(trigger) {
  pickerTrigger = { kind: trigger.dataset.pick, index: Number(trigger.dataset.index) };
  pickerContext = { ...pickerTrigger };
  const { kind, index } = pickerContext;
  const slot = state.slots[index];
  if (kind === 'skill' && slot.track === null) return;
  const options = kind === 'track' ? data.tracks : kind === 'skill' ? data.tracks[slot.track].skills : data[kind];
  const selected = kind === 'track' ? slot.track : kind === 'skill' ? slot.focus : state[kind][index];
  if (!mobile.matches && kind !== 'skill') return openInlinePicker(trigger, options, selected);
  $('lab-picker-title').textContent = kind === 'track' ? `SKILL ${pad(index)} · トラック選択` : kind === 'skill' ? `${data.tracks[slot.track].name} · 注目スキル` : `${kind.toUpperCase()} · スキル選択`;
  $('lab-picker-options').innerHTML = options.map((item, n) => `<button type="button" class="lab-option" data-choice="${n}" ${kind === 'track' && !canSelectTrack(state, index, n) ? 'disabled' : ''} aria-pressed="${n === selected}">${img(item)}<span><strong>${escape(item.name)}${n === selected ? ' · 選択中' : kind === 'track' && !canSelectTrack(state, index, n) ? ' · 他の枠で選択中' : ''}</strong>${item.effects ? item.effects.map((effect, level) => `<p>LV${level + 1} ${escape(effect)}</p>`).join('') : `<p>${escape(item.description)}</p>`}</span></button>`).join('');
  picker.showModal();
}
picker.addEventListener('close', () => {
  if (!pickerTrigger) return;
  const { kind, index } = pickerTrigger;
  board.querySelector(`[data-pick="${kind}"][data-index="${index}"]`)?.focus({ preventScroll: true });
});
$('lab-picker-close').addEventListener('click', () => picker.close());
function chooseOption(n) {
  const { kind, index } = pickerContext;
  if (kind === 'track') { if (!selectTrack(state, data, index, n)) return; }
  else if (kind === 'skill') focusSkill(state.slots[index], n);
  else if (kind === 'exotic' || kind === 'nightmare') state[kind][index] = n;
  closeInlinePicker(false);
  commit();
  if (picker.open) picker.close();
  board.querySelector(`[data-pick="${kind}"][data-index="${index}"]`)?.focus({ preventScroll: true });
}
picker.addEventListener('click', event => {
  const choice = event.target.closest('[data-choice]');
  if (choice && !choice.disabled) chooseOption(Number(choice.dataset.choice));
});
let inlinePicker = null, inlineTrigger = null;
function closeInlinePicker(restoreFocus = true) {
  if (!inlinePicker) return;
  inlinePicker.remove();
  inlinePicker = null;
  inlineTrigger?.setAttribute('aria-expanded', 'false');
  if (restoreFocus) inlineTrigger?.focus({ preventScroll: true });
  inlineTrigger = null;
}
function openInlinePicker(trigger, options, selected) {
  const wasOpen = inlineTrigger === trigger;
  closeInlinePicker(false);
  if (wasOpen) return;
  const { kind, index } = pickerContext;
  const trackOrder = ['ファントム', 'バーサーカー', 'デアデビル', 'イーグルアイ', 'ガーディアン', 'ガンナー', 'サージャン', 'タクティシャン', 'ウォーバンド', 'ブルドーザー'];
  const choices = options.map((item, n) => ({ item, n }));
  if (kind === 'track') choices.sort((a, b) => trackOrder.indexOf(a.item.name) - trackOrder.indexOf(b.item.name));
  inlinePicker = document.createElement('div');
  inlinePicker.className = 'lab-inline-picker';
  inlinePicker.id = 'lab-inline-picker';
  inlinePicker.setAttribute('role', 'dialog');
  const title = kind === 'track' ? `SKILL ${pad(index)}` : kind.toUpperCase();
  inlinePicker.setAttribute('aria-label', `${title}を選択`);
  inlinePicker.innerHTML = `<h2>${title}</h2><button type="button" class="lab-inline-close" aria-label="選択一覧を閉じる">▾</button><div class="lab-inline-options">${choices.map(({item, n}) => `<button type="button" class="lab-inline-option" data-choice="${n}" ${kind === 'track' && !canSelectTrack(state, index, n) ? 'disabled' : ''} aria-pressed="${n === selected}">${img(item)}<span>${escape(item.name)}</span></button>`).join('')}</div>`;
  inlineTrigger = trigger;
  trigger.setAttribute('aria-expanded', 'true');
  trigger.setAttribute('aria-controls', 'lab-inline-picker');
  trigger.closest('.lab-track-head, .lab-special').append(inlinePicker);
  inlinePicker.addEventListener('click', event => {
    event.stopPropagation();
    if (event.target.closest('.lab-inline-close')) return closeInlinePicker();
    const choice = event.target.closest('[data-choice]');
    if (choice && !choice.disabled) chooseOption(Number(choice.dataset.choice));
  });
  inlinePicker.querySelector('[aria-pressed="true"]:not(:disabled), .lab-inline-option:not(:disabled)')?.focus({ preventScroll: true });
}
document.addEventListener('pointerdown', event => {
  if (inlinePicker && !inlinePicker.contains(event.target) && !inlineTrigger?.contains(event.target)) closeInlinePicker(false);
});
document.addEventListener('keydown', event => {
  if (!inlinePicker) return;
  if (event.key === 'Escape') { event.preventDefault(); closeInlinePicker(); }
  else if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) && inlinePicker.contains(document.activeElement)) {
    event.preventDefault();
    const choices = [...inlinePicker.querySelectorAll('.lab-inline-option:not(:disabled)')];
    const current = choices.indexOf(document.activeElement);
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 : (current + (event.key === 'ArrowDown' ? 1 : -1) + choices.length) % choices.length;
    choices[next]?.focus();
  }
});
board.addEventListener('click', event => {
  const prestige = event.target.closest('[data-prestige]');
  if (prestige) return togglePrestige(Number(prestige.dataset.prestige));
  const pick = event.target.closest('[data-pick]');
  if (pick) return openPicker(pick);
  const button = event.target.closest('[data-move]');
  if (!button) return;
  const card = button.closest('[data-position]'), column = Number(card.closest('[data-slot]').dataset.slot);
  const from = Number(card.dataset.position), to = from + Number(button.dataset.move), skill = card.dataset.skill;
  moveSkill(state.slots[column], from, to);
  commit();
  const buttons = board.querySelectorAll(`[data-slot="${column}"] [data-skill="${skill}"] .lab-move button:not(:disabled)`);
  buttons[0]?.focus({ preventScroll: true });
});
// Pointer drag also works with touch-enabled laptops. Mobile uses the focus picker.
board.addEventListener('pointerdown', event => {
  const card = event.target.closest('.lab-skill');
  if (!card || mobile.matches || event.button !== 0 || event.target.closest('button')) return;
  dragged = { slot: Number(card.closest('[data-slot]').dataset.slot), from: Number(card.dataset.position), x: event.clientX, y: event.clientY, pointer: event.pointerId, active: false, to: null };
  board.setPointerCapture(event.pointerId);
  event.preventDefault();
});
board.addEventListener('pointermove', event => {
  if (!dragged || event.pointerId !== dragged.pointer) return;
  if (!dragged.active && Math.hypot(event.clientX - dragged.x, event.clientY - dragged.y) < 6) return;
  dragged.active = true;
  board.querySelector(`[data-slot="${dragged.slot}"] [data-position="${dragged.from}"]`)?.classList.add('dragging');
  board.querySelectorAll('.drop-target').forEach(el => el.classList.remove('drop-target'));
  const card = document.elementFromPoint(event.clientX, event.clientY)?.closest('.lab-skill');
  dragged.to = null;
  if (card && Number(card.closest('[data-slot]').dataset.slot) === dragged.slot) {
    dragged.to = Number(card.dataset.position);
    card.classList.add('drop-target');
  }
  if (event.clientY < 65) window.scrollBy(0, -16);
  else if (event.clientY > innerHeight - 65) window.scrollBy(0, 16);
});
function endDrag(event) {
  if (!dragged || event.pointerId !== dragged.pointer) return;
  const current = dragged;
  dragged = null;
  if (board.hasPointerCapture(current.pointer)) board.releasePointerCapture(current.pointer);
  board.querySelectorAll('.dragging, .drop-target').forEach(el => el.classList.remove('dragging', 'drop-target'));
  if (event.type === 'pointerup' && current.active && current.to !== null && current.from !== current.to) {
    moveSkill(state.slots[current.slot], current.from, current.to);
    commit();
  }
}
board.addEventListener('pointerup', endDrag);
board.addEventListener('pointercancel', endDrag);
function cancelTransition() {
  transitionRevision++;
  transitioning = false;
  board.getAnimations().forEach(animation => animation.cancel());
}
$('lab-reset').addEventListener('click', () => {
  cancelTransition();
  dragged = null;
  state = initialState();
  commit();
});
$('lab-copy').addEventListener('click', async () => {
  syncUrl();
  const url = location.href;
  try {
    await navigator.clipboard.writeText(url);
    announce('ビルドURLをコピーしました。');
  } catch {
    $('lab-share-url').value = url;
    $('lab-share').showModal();
    $('lab-share-url').focus();
    $('lab-share-url').select();
  }
});
$('lab-share-close').addEventListener('click', () => $('lab-share').close());
function readUrl() {
  cancelTransition();
  const hash = new URLSearchParams(location.hash.slice(1));
  const result = decodeState(hash.get('lab'), data);
  state = result.state;
  render();
  announce(result.invalid ? 'ビルドURLを読み取れなかったため、初期状態を表示しています。' : '');
}
window.addEventListener('hashchange', () => { if (data) readUrl(); });
mobile.addEventListener('change', () => { if (data) { if (picker.open) picker.close(); render(); } });
try {
  const response = await fetch('./data/skill-lab/catalog.json');
  if (!response.ok) throw new Error('catalog unavailable');
  data = await response.json();
  readUrl();
  $('lab-load').hidden = true;
  for (const id of ['lab-reset', 'lab-copy']) $(id).disabled = false;
} catch (error) {
  $('lab-load').textContent = 'スキルを読み込めませんでした。ページを再読み込みしてください。';
  console.error('SKILL LAB:', error);
}
