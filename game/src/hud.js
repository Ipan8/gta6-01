// DOM HUD: health, cash, wanted stars, clock, ammo/speed, objective line,
// mission banner, and the minimap (streets, player, police, mission marker).
// All text the player needs is here; the 3D scene is render.js's job.
import { BLOCK, GRID, CITY_SIZE } from './config.js';

function $(id) {
  return document.getElementById(id);
}

export function createHud(world) {
  const el = {
    healthFill: $('health-fill'),
    cash: $('cash'),
    stars: $('stars'),
    clock: $('clock'),
    ammo: $('ammo'),
    speed: $('speed'),
    objective: $('objective'),
    crosshair: $('crosshair'),
    banner: $('banner'),
    minimap: $('minimap'),
    overlay: $('overlay'),
    overlayTitle: $('overlay-title'),
    overlayLines: $('overlay-lines'),
    overlayPrompt: $('overlay-prompt'),
    status: $('status'),
  };
  const mm = el.minimap.getContext('2d');
  const scale = 180 / CITY_SIZE;
  const toMap = (x, z) => [90 + x * scale, 90 + z * scale];
  let bannerTimer = 0;

  function update(game) {
    const hp = Math.max(0, game.player.health);
    el.healthFill.style.width = `${hp}%`;
    el.healthFill.style.background = hp > 50 ? '#4ade80' : hp > 25 ? '#f2c94c' : '#e5534b';
    el.cash.textContent = `$${game.cash}`;
    let starsHtml = '';
    for (let i = 1; i <= 5; i += 1) {
      starsHtml += game.police.stars >= i ? '★' : '<span class="off">★</span>';
    }
    el.stars.innerHTML = starsHtml;
    const hours = 8 + game.time / 120; // 2 real minutes = 1 game hour
    const hh = Math.floor(hours) % 24;
    const min = Math.floor((hours % 1) * 60);
    el.clock.textContent = `${String(hh).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    if (game.inCar && game.vehicle) {
      el.ammo.textContent = '';
      el.speed.textContent = `${Math.round(Math.abs(game.vehicle.speed) * 3.6)} km/h`;
      el.crosshair.style.display = 'none';
    } else {
      el.ammo.textContent = `Pistol ${game.combat.mag}/${game.combat.reserve}`;
      el.speed.textContent = '';
      el.crosshair.style.display = 'block';
    }
    el.objective.textContent = game.missions.currentObjective();
    drawMinimap(game);
  }

  function drawMinimap(game) {
    mm.clearRect(0, 0, 180, 180);
    // Water (east) + beach (south).
    mm.fillStyle = '#2e7fa8';
    mm.fillRect(90 + (world.half - BLOCK) * scale, 0, BLOCK * scale, 180);
    mm.fillStyle = '#e8d5a0';
    mm.fillRect(0, 90 + (world.half - BLOCK) * scale, 180, BLOCK * scale);
    // Roads.
    mm.strokeStyle = 'rgba(200,200,210,0.7)';
    mm.lineWidth = 1;
    for (const r of world.roads) {
      const [x1, y1] = toMap(r.x1, r.z1);
      const [x2, y2] = toMap(r.x2, r.z2);
      mm.beginPath();
      mm.moveTo(x1, y1);
      mm.lineTo(x2, y2);
      mm.stroke();
    }
    // Mission target.
    const tgt = (() => {
      const l = world.landmarks;
      const i = game.missions.index;
      if (i === 0) return l.garage;
      if (i === 1) return game.missions.sub === 'reachHideout' ? l.hideout : null;
      if (i === 2) return l.harbourLot;
      if (i === 3) return game.missions.sub === 'escape' ? l.hideout : l.harbourLot;
      if (i === 4) return l.marina;
      return null;
    })();
    if (tgt) {
      const [x, y] = toMap(tgt.x, tgt.z);
      mm.fillStyle = '#ffd23e';
      mm.beginPath();
      mm.arc(x, y, 4, 0, Math.PI * 2);
      mm.fill();
    }
    // Traffic (grey), police (red).
    mm.fillStyle = 'rgba(220,220,230,0.8)';
    for (const car of game.traffic.cars) {
      const [x, y] = toMap(car.x, car.z);
      mm.fillRect(x - 1, y - 1, 2, 2);
    }
    mm.fillStyle = '#ff4444';
    for (const car of game.police.cruisers) {
      const [x, y] = toMap(car.x, car.z);
      mm.beginPath();
      mm.arc(x, y, 3, 0, Math.PI * 2);
      mm.fill();
    }
    // Player arrow.
    const [px, py] = toMap(game.player.x, game.player.z);
    const heading = game.inCar && game.vehicle ? game.vehicle.heading : game.player.heading;
    mm.save();
    mm.translate(px, py);
    mm.rotate(heading);
    mm.fillStyle = '#ffffff';
    mm.beginPath();
    mm.moveTo(0, -6);
    mm.lineTo(4, 5);
    mm.lineTo(-4, 5);
    mm.closePath();
    mm.fill();
    mm.restore();
  }

  function banner(title, sub) {
    el.banner.innerHTML = `${title}${sub ? `<small>${sub}</small>` : ''}`;
    el.banner.style.opacity = '1';
    window.clearTimeout(bannerTimer);
    bannerTimer = window.setTimeout(() => { el.banner.style.opacity = '0'; }, 2600);
  }

  function showOverlay(title, lines, prompt) {
    el.overlayTitle.textContent = title;
    el.overlayLines.innerHTML = lines.map((l) => `<p>${l}</p>`).join('');
    el.overlayPrompt.textContent = prompt;
    el.overlay.classList.remove('hidden');
  }

  function hideOverlay() {
    el.overlay.classList.add('hidden');
  }

  function announce(message) {
    el.status.textContent = message;
  }

  return { update, banner, showOverlay, hideOverlay, announce, el };
}
