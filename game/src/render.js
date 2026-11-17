// Lantern Keeper — all drawing. render.js reads world state and paints it;
// it never changes the game. Screens: title, playing, paused, won, over.
import { COLORS, ENERGY_TO_WIN, LIGHTHOUSE, VIEW, WALL, comboMultiplier } from './config.js';
import { createRandom } from './random.js';
import { KIND_BLOCK, KIND_FIREFLY, KIND_SUNSTONE } from './world.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'playing';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_WIN = 'won';
export const SCREEN_OVER = 'over';

const FONT = '"Avenir Next", "Segoe UI", system-ui, "PingFang SC", "Microsoft YaHei", sans-serif';

/** Star field, fixed once from its own seed so every frame (and shot) agrees. */
function makeStars() {
  const rand = createRandom(20240917);
  const stars = [];
  for (let i = 0; i < 110; i += 1) {
    stars.push({ x: rand() * VIEW.width, y: rand() * 330, r: 0.6 + rand() * 1.3, phase: rand() * 6.28 });
  }
  return stars;
}

export function createRenderer(canvas) {
  canvas.width = VIEW.width;
  canvas.height = VIEW.height;
  const ctx = canvas.getContext('2d');
  const stars = makeStars();

  function drawSky(state) {
    const sky = ctx.createLinearGradient(0, 0, 0, WALL.top);
    sky.addColorStop(0, COLORS.skyTop);
    sky.addColorStop(1, COLORS.skyHorizon);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    for (const star of stars) {
      const twinkle = 0.55 + 0.45 * Math.sin(state.visualTime * 1.7 + star.phase);
      ctx.globalAlpha = 0.75 * twinkle;
      ctx.fillStyle = '#dceef2';
      ctx.beginPath();
      ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The moon, high over the sea.
    ctx.fillStyle = '#f3ead0';
    ctx.beginPath();
    ctx.arc(96, 84, 27, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.skyTop;
    ctx.beginPath();
    ctx.arc(110, 74, 23, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSea(state) {
    ctx.fillStyle = COLORS.sea;
    ctx.fillRect(0, WALL.waterY - 6, VIEW.width, VIEW.height - WALL.waterY + 6);
    ctx.strokeStyle = COLORS.seaWave;
    ctx.lineWidth = 2;
    for (let row = 0; row < 3; row += 1) {
      const y = WALL.waterY + 8 + row * 9;
      ctx.globalAlpha = 0.5 - row * 0.12;
      ctx.beginPath();
      for (let x = 0; x <= VIEW.width; x += 16) {
        const waveY = y + Math.sin(x / 46 + state.visualTime * 1.3 + row * 1.7) * 2.2;
        if (x === 0) ctx.moveTo(x, waveY);
        else ctx.lineTo(x, waveY);
      }
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  /** The light cone: longer and brighter the more charge the lamp holds. */
  function drawLightCone(state) {
    const charge = state.energy / ENERGY_TO_WIN;
    const sweep = state.won ? Math.sin(state.visualTime * 0.9) * 0.5 : Math.sin(state.visualTime * 0.45) * 0.16;
    const length = 190 + charge * 430;
    const halfAngle = 0.16 + charge * 0.1;
    const centreAngle = Math.PI + 0.32 + sweep; // aimed out over the sea, to the left
    const grad = ctx.createRadialGradient(LIGHTHOUSE.lampX, LIGHTHOUSE.lampY, 8, LIGHTHOUSE.lampX, LIGHTHOUSE.lampY, length);
    grad.addColorStop(0, `rgba(255, 205, 110, ${0.34 + charge * 0.3})`);
    grad.addColorStop(1, 'rgba(255, 205, 110, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(LIGHTHOUSE.lampX, LIGHTHOUSE.lampY);
    ctx.arc(LIGHTHOUSE.lampX, LIGHTHOUSE.lampY, length, centreAngle - halfAngle, centreAngle + halfAngle);
    ctx.closePath();
    ctx.fill();
  }

  function drawLighthouse(state) {
    const { baseX, baseWidth, topY, lampX, lampY, lampRadius } = LIGHTHOUSE;
    const charge = state.energy / ENERGY_TO_WIN;
    // Tower: a tapered stone stack with two amber bands.
    ctx.fillStyle = '#33505c';
    ctx.beginPath();
    ctx.moveTo(baseX, WALL.top);
    ctx.lineTo(baseX + 14, topY + 26);
    ctx.lineTo(baseX + baseWidth - 14, topY + 26);
    ctx.lineTo(baseX + baseWidth, WALL.top);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.amber;
    ctx.fillRect(baseX + 8, WALL.top - 74, baseWidth - 16, 13);
    ctx.fillRect(baseX + 11, WALL.top - 148, baseWidth - 22, 13);
    // Gallery and lamp room.
    ctx.fillStyle = '#22383f';
    ctx.fillRect(baseX + 6, topY + 12, baseWidth - 12, 14);
    ctx.fillStyle = '#16262c';
    ctx.fillRect(lampX - 21, topY - 16, 42, 30);
    ctx.fillStyle = '#0d1b20';
    ctx.beginPath();
    ctx.moveTo(lampX - 26, topY - 16);
    ctx.lineTo(lampX, topY - 38);
    ctx.lineTo(lampX + 26, topY - 16);
    ctx.closePath();
    ctx.fill();
    // The lamp itself, plus a halo that grows with the charge.
    const halo = ctx.createRadialGradient(lampX, lampY, 2, lampX, lampY, 30 + charge * 46);
    halo.addColorStop(0, `rgba(255, 214, 130, ${0.5 + charge * 0.5})`);
    halo.addColorStop(1, 'rgba(255, 214, 130, 0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(lampX, lampY, 30 + charge * 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = charge > 0.02 || state.won ? '#ffe9b0' : '#5d737c';
    ctx.beginPath();
    ctx.arc(lampX, lampY, lampRadius - 5, 0, Math.PI * 2);
    ctx.fill();
    // Energy ring around the lamp: the win progress, readable from anywhere.
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(255, 240, 200, 0.22)';
    ctx.beginPath();
    ctx.arc(lampX, lampY, lampRadius + 7, 0, Math.PI * 2);
    ctx.stroke();
    if (charge > 0) {
      ctx.strokeStyle = COLORS.amber;
      ctx.beginPath();
      ctx.arc(lampX, lampY, lampRadius + 7, -Math.PI / 2, -Math.PI / 2 + charge * Math.PI * 2);
      ctx.stroke();
    }
  }

  function drawWall() {
    ctx.fillStyle = COLORS.wallStone;
    ctx.fillRect(0, WALL.top, VIEW.width, WALL.waterY - WALL.top + 8);
    ctx.fillStyle = COLORS.wallEdge;
    ctx.fillRect(0, WALL.top, VIEW.width, 6);
    ctx.fillStyle = COLORS.wallDark;
    for (let x = 26; x < VIEW.width; x += 64) ctx.fillRect(x, WALL.top + 18, 34, 4);
  }

  function drawFirefly(state, item) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const pulse = 0.75 + 0.25 * Math.sin(state.visualTime * 6 + item.seed * 12);
    const glow = ctx.createRadialGradient(cx, cy, 1, cx, cy, 17 * pulse);
    glow.addColorStop(0, 'rgba(255, 207, 110, 0.85)');
    glow.addColorStop(1, 'rgba(255, 207, 110, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 17 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.firefly;
    ctx.beginPath();
    ctx.arc(cx, cy, 5.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 250, 225, 0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, 2.1, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSunstone(state, item) {
    const cx = item.x + item.width / 2;
    const cy = item.y + item.height / 2;
    const spin = state.visualTime * 2.4 + item.seed * 6;
    const glow = ctx.createRadialGradient(cx, cy, 2, cx, cy, 26);
    glow.addColorStop(0, 'rgba(255, 224, 102, 0.8)');
    glow.addColorStop(1, 'rgba(255, 224, 102, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(cx, cy, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(spin);
    ctx.fillStyle = COLORS.sunstone;
    ctx.beginPath();
    for (let i = 0; i < 8; i += 1) {
      const angle = (i / 8) * Math.PI * 2;
      const r = i % 2 === 0 ? 13 : 6;
      ctx.lineTo(Math.cos(angle) * r, Math.sin(angle) * r);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = COLORS.sunstoneCore;
    ctx.beginPath();
    ctx.arc(cx, cy, 4.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawBlock(item) {
    ctx.save();
    ctx.shadowColor = COLORS.blockGlow;
    ctx.shadowBlur = 13;
    ctx.fillStyle = COLORS.blockBody;
    ctx.fillRect(item.x, item.y, item.width, item.height);
    ctx.restore();
    ctx.strokeStyle = COLORS.blockEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(item.x + 1, item.y + 1, item.width - 2, item.height - 2);
    // A jagged crack, so the block reads as broken shadow, not a box.
    ctx.strokeStyle = COLORS.blockGlow;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    const midX = item.x + item.width * (0.3 + item.seed * 0.4);
    ctx.moveTo(midX, item.y + 3);
    ctx.lineTo(midX - 5, item.y + item.height * 0.45);
    ctx.lineTo(midX + 3, item.y + item.height - 4);
    ctx.stroke();
  }

  function drawItem(state, item) {
    if (item.kind === KIND_FIREFLY) drawFirefly(state, item);
    else if (item.kind === KIND_SUNSTONE) drawSunstone(state, item);
    else if (item.kind === KIND_BLOCK) drawBlock(item);
  }

  /** The keeper: cloak, hood, and a raised lantern that does the catching. */
  function drawKeeper(state) {
    const p = state.player;
    const blinking = state.time < state.invincibleUntil && Math.floor(state.visualTime * 11) % 2 === 0;
    ctx.save();
    if (blinking) ctx.globalAlpha = 0.35;
    const cx = p.x + p.width / 2;
    const feet = p.y + p.height;
    // Cloak.
    ctx.fillStyle = COLORS.keeperCloak;
    ctx.beginPath();
    ctx.moveTo(cx - 15, feet);
    ctx.lineTo(cx - 9, p.y + 16);
    ctx.lineTo(cx + 9, p.y + 16);
    ctx.lineTo(cx + 15, feet);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = COLORS.keeperTrim;
    ctx.fillRect(cx - 10, feet - 7, 20, 3.4);
    // Head and hood.
    ctx.fillStyle = COLORS.keeperSkin;
    ctx.beginPath();
    ctx.arc(cx, p.y + 11, 8.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.keeperCloak;
    ctx.beginPath();
    ctx.arc(cx, p.y + 8, 10, Math.PI, Math.PI * 2);
    ctx.fill();
    // Raised arm and lantern, above the head where the catch zone is.
    ctx.strokeStyle = COLORS.keeperSkin;
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(cx + 7, p.y + 22);
    ctx.lineTo(cx + 14, p.y + 4);
    ctx.stroke();
    const lanternX = cx + 15;
    const lanternY = p.y - 4;
    const glow = ctx.createRadialGradient(lanternX, lanternY, 1, lanternX, lanternY, 21);
    glow.addColorStop(0, 'rgba(255, 190, 80, 0.9)');
    glow.addColorStop(1, 'rgba(255, 190, 80, 0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(lanternX, lanternY, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.amber;
    ctx.fillRect(lanternX - 3.6, lanternY - 4.6, 7.2, 9.2);
    ctx.fillStyle = '#7a4b12';
    ctx.fillRect(lanternX - 4.4, lanternY - 6.4, 8.8, 2.4);
    ctx.restore();
  }

  function drawParticles(state) {
    for (const particle of state.particles) {
      ctx.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawScene(state) {
    ctx.save();
    if (state.shake > 0) {
      const mag = state.shake * 15;
      ctx.translate(Math.sin(state.visualTime * 91) * mag, Math.cos(state.visualTime * 113) * mag * 0.6);
    }
    drawSky(state);
    drawLightCone(state);
    drawSea(state);
    drawLighthouse(state);
    drawWall();
    for (const item of state.items) drawItem(state, item);
    drawKeeper(state);
    drawParticles(state);
    ctx.restore();
  }

  // ---------------------------------------------------------------- the HUD

  function drawHud(state, best) {
    ctx.fillStyle = COLORS.hudBand;
    ctx.fillRect(0, 0, VIEW.width, 56);
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.font = `700 23px ${FONT}`;
    ctx.fillStyle = COLORS.textWarm;
    ctx.fillText(`SCORE ${state.score}`, 16, 29);
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText(`BEST ${Math.max(best, state.score)}`, 190, 29);
    // Centre: the lighthouse charge bar — the whole point of the game.
    const barX = 330;
    const barW = 300;
    ctx.font = `600 13px ${FONT}`;
    ctx.fillStyle = COLORS.textDim;
    ctx.fillText('LIGHTHOUSE', barX, 13);
    ctx.fillStyle = 'rgba(255, 240, 200, 0.18)';
    ctx.fillRect(barX, 24, barW, 14);
    ctx.fillStyle = COLORS.amber;
    ctx.fillRect(barX, 24, (barW * state.energy) / ENERGY_TO_WIN, 14);
    ctx.font = `700 17px ${FONT}`;
    ctx.fillStyle = COLORS.textWarm;
    ctx.fillText(`${Math.floor(state.energy)}%`, barX + barW + 10, 31);
    // Right: level and lives as lantern pips.
    ctx.textAlign = 'right';
    ctx.font = `700 19px ${FONT}`;
    ctx.fillStyle = COLORS.textWarm;
    ctx.fillText(`LEVEL ${state.level}`, VIEW.width - 16, 17);
    for (let i = 0; i < state.lives; i += 1) {
      const x = VIEW.width - 30 - i * 24;
      ctx.fillStyle = COLORS.amber;
      ctx.beginPath();
      ctx.arc(x, 40, 6.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff3cf';
      ctx.beginPath();
      ctx.arc(x, 40, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.textAlign = 'left';
    // Combo streak, centred under the band while it is alive.
    const multiplier = comboMultiplier(state.comboStreak);
    if (state.comboStreak >= 2) {
      ctx.textAlign = 'center';
      ctx.font = `800 21px ${FONT}`;
      ctx.fillStyle = multiplier > 1 ? COLORS.amber : COLORS.textWarm;
      ctx.fillText(`COMBO x${multiplier} · ${state.comboStreak}`, VIEW.width / 2, 74);
      ctx.textAlign = 'left';
    }
    // Level-up banner.
    if (state.bannerText && state.time < state.bannerUntil) {
      ctx.textAlign = 'center';
      ctx.font = `800 30px ${FONT}`;
      ctx.fillStyle = COLORS.amberSoft;
      ctx.fillText(`— ${state.bannerText} —`, VIEW.width / 2, 108);
      ctx.textAlign = 'left';
    }
  }

  // ---------------------------------------------------------------- panels

  function panel(width, height) {
    const x = (VIEW.width - width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = COLORS.panel;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 16);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 179, 64, 0.4)';
    ctx.lineWidth = 1.6;
    ctx.stroke();
    return { x, y, width, height };
  }

  function centredText(text, y, font, color) {
    ctx.font = font;
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, VIEW.width / 2, y);
    ctx.textAlign = 'left';
  }

  function drawTitlePanel(state, best) {
    panel(620, 356);
    centredText('守灯人 · 拾光', 168, `800 52px ${FONT}`, COLORS.amberSoft);
    centredText('LANTERN KEEPER', 216, `700 21px ${FONT}`, COLORS.textDim);
    centredText('接住萤火，把灯塔充到 100%，在天亮前点亮它', 262, `600 19px ${FONT}`, COLORS.textWarm);
    centredText('Catch fireflies to charge the lighthouse to 100%', 290, `500 15px ${FONT}`, COLORS.textDim);
    centredText('← → / A D 移动 · 避开暗潮影块 · 金色阳石 +1 命', 326, `500 16px ${FONT}`, COLORS.textWarm);
    centredText(`BEST ${best}`, 362, `700 19px ${FONT}`, COLORS.amber);
    centredText('按 空格 开始 · PRESS SPACE', 408, `800 23px ${FONT}`, COLORS.textWarm);
    void state;
  }

  function drawPausedPanel() {
    panel(380, 170);
    centredText('暂 停', 232, `800 38px ${FONT}`, COLORS.textWarm);
    centredText('PAUSED', 274, `600 15px ${FONT}`, COLORS.textDim);
    centredText('按 P 或 空格 继续', 312, `500 16px ${FONT}`, COLORS.textWarm);
  }

  function drawWinPanel(state) {
    panel(560, 300);
    centredText('灯塔点亮了！', 178, `800 42px ${FONT}`, COLORS.amberSoft);
    centredText('THE LIGHTHOUSE IS LIT', 220, `700 17px ${FONT}`, COLORS.textDim);
    centredText(`SCORE ${state.score}`, 268, `800 30px ${FONT}`, COLORS.textWarm);
    centredText(
      `用时 ${Math.floor(state.time)} 秒 · 最高连击 x${comboMultiplier(state.bestStreak)}`,
      308,
      `500 17px ${FONT}`,
      COLORS.textWarm,
    );
    centredText('按 空格 再玩一次 · SPACE TO PLAY AGAIN', 356, `700 19px ${FONT}`, COLORS.amber);
  }

  function drawOverPanel(state, best) {
    panel(560, 300);
    centredText('灯火熄灭了', 178, `800 42px ${FONT}`, COLORS.hurt);
    centredText('THE LIGHT WENT OUT', 220, `700 17px ${FONT}`, COLORS.textDim);
    centredText(`SCORE ${state.score}`, 268, `800 30px ${FONT}`, COLORS.textWarm);
    centredText(
      `充能 ${Math.floor(state.energy)}% · BEST ${Math.max(best, state.score)}`,
      308,
      `500 17px ${FONT}`,
      COLORS.textWarm,
    );
    centredText('按 空格 再玩一次 · SPACE TO TRY AGAIN', 356, `700 19px ${FONT}`, COLORS.amber);
  }

  /** Paint one frame: scene first, HUD while playing, then any panel. */
  function draw(state, screen, best) {
    drawScene(state);
    if (screen !== SCREEN_TITLE) drawHud(state, best);
    if (screen === SCREEN_TITLE) drawTitlePanel(state, best);
    else if (screen === SCREEN_PAUSED) drawPausedPanel(); else if (screen === SCREEN_WIN) drawWinPanel(state);
    else if (screen === SCREEN_OVER) drawOverPanel(state, best);
  }

  return { draw };
}
