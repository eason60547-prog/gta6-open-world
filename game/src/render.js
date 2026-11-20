// Palmera Bay — everything the player sees: camera, city, HUD, minimap.
// One job: draw the world from the game state, nothing else.
import { WORLD, ROADS_X, ROADS_Y, COLORS } from './config.js';
import { isRoad, isBeach, isWater } from './world.js';

export class Renderer {
  constructor(canvas, minimapCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.map = minimapCanvas;
    this.mapCtx = minimapCanvas.getContext('2d');
    this.camera = { x: 0, y: 0, zoom: 1 };
    this.shake = 0;
  }

  resize(w, h) {
    this.canvas.width = w;
    this.canvas.height = h;
  }

  updateCamera(dt, targetX, targetY, speed) {
    const zoom = speed > 380 ? 0.78 : speed > 200 ? 0.88 : 1;
    this.camera.zoom += (zoom - this.camera.zoom) * Math.min(1, dt * 2);
    const w = this.canvas.width / this.camera.zoom;
    const h = this.canvas.height / this.camera.zoom;
    const tx = targetX - w / 2;
    const ty = targetY - h / 2;
    this.camera.x += (tx - this.camera.x) * Math.min(1, dt * 5);
    this.camera.y += (ty - this.camera.y) * Math.min(1, dt * 5);
    this.shake = Math.max(0, this.shake - dt * 30);
  }

  screenToWorld(sx, sy) {
    const z = this.camera.zoom;
    return {
      x: this.camera.x + sx / z,
      y: this.camera.y + sy / z,
    };
  }

  draw(game) {
    const ctx = this.ctx;
    const { width: W, height: H } = this.canvas;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    const shx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const shy = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    ctx.translate(-this.camera.x * this.camera.zoom + shx, -this.camera.y * this.camera.zoom + shy);
    ctx.scale(this.camera.zoom, this.camera.zoom);

    const vx0 = this.camera.x - 40;
    const vy0 = this.camera.y - 40;
    const vx1 = this.camera.x + W / this.camera.zoom + 40;
    const vy1 = this.camera.y + H / this.camera.zoom + 40;

    this._drawGround(ctx, vx0, vy0, vx1, vy1);
    this._drawRoads(ctx, vx0, vy0, vx1, vy1);
    this._drawCity(ctx, game, vx0, vy0, vx1, vy1);
    this._drawPickups(ctx, game);
    this._drawPeds(ctx, game);
    this._drawCars(ctx, game);
    this._drawPlayer(ctx, game);
    this._drawEffects(ctx, game);
    this._drawMissionMarker(ctx, game);
    ctx.restore();

    if (game.state !== 'title') {
      this._drawHud(game);
      this._drawMinimap(game);
    }
  }

  _drawGround(ctx, x0, y0, x1, y1) {
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // Beach and sea along the south edge.
    const beachTop = WORLD.height - 260;
    if (y1 > beachTop) {
      ctx.fillStyle = COLORS.sand;
      ctx.fillRect(x0, Math.max(y0, beachTop), x1 - x0, Math.min(y1, WORLD.height - 90) - Math.max(y0, beachTop));
      ctx.fillStyle = COLORS.water;
      ctx.fillRect(x0, Math.max(y0, WORLD.height - 90), x1 - x0, Math.min(y1, WORLD.height) - Math.max(y0, WORLD.height - 90));
      ctx.fillStyle = COLORS.waterDeep;
      for (let x = Math.floor(x0 / 180) * 180; x < x1; x += 180) {
        ctx.fillRect(x + 40, WORLD.height - 60, 90, 5);
      }
    }
    // Port docks on the east edge.
    if (x1 > WORLD.width - 260) {
      ctx.fillStyle = '#9a8a72';
      ctx.fillRect(WORLD.width - 260, 1400, 260, 800);
      ctx.fillStyle = '#7a6a55';
      for (let y = 1450; y < 2150; y += 120) ctx.fillRect(WORLD.width - 260, y, 260, 8);
    }
  }

  _drawRoads(ctx, x0, y0, x1, y1) {
    const half = WORLD.roadWidth / 2;
    ctx.fillStyle = COLORS.sidewalk;
    for (const rx of ROADS_X) ctx.fillRect(rx - half - 12, y0, WORLD.roadWidth + 24, y1 - y0);
    for (const ry of ROADS_Y) ctx.fillRect(x0, ry - half - 12, x1 - x0, WORLD.roadWidth + 24);
    ctx.fillStyle = COLORS.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - half, y0, WORLD.roadWidth, y1 - y0);
    for (const ry of ROADS_Y) ctx.fillRect(x0, ry - half, x1 - x0, WORLD.roadWidth);
    // Centre dashes.
    ctx.fillStyle = COLORS.lane;
    for (const rx of ROADS_X) {
      for (let y = Math.floor(y0 / 60) * 60; y < y1; y += 60) {
        if (ROADS_Y.some((ry) => Math.abs(y - ry) < 60)) continue;
        ctx.fillRect(rx - 2, y, 4, 28);
      }
    }
    for (const ry of ROADS_Y) {
      for (let x = Math.floor(x0 / 60) * 60; x < x1; x += 60) {
        if (ROADS_X.some((rx) => Math.abs(x - rx) < 60)) continue;
        ctx.fillRect(x, ry - 2, 28, 4);
      }
    }
  }

  _drawCity(ctx, game, x0, y0, x1, y1) {
    const city = game.city;
    // Park block.
    ctx.fillStyle = COLORS.park;
    ctx.fillRect(2200 + WORLD.roadWidth / 2, 1000 + WORLD.roadWidth / 2, 400 - WORLD.roadWidth, 300 - WORLD.roadWidth);
    for (const b of city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Drop shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = COLORS.buildingWall;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, 8);
      if (b.label) {
        ctx.fillStyle = 'rgba(20,20,20,0.75)';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 4);
      }
    }
    for (const t of city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(t.x - 2, t.y - 2, 4, 8);
      ctx.fillStyle = '#3f8f3a';
      ctx.beginPath();
      ctx.arc(t.x, t.y - 4, t.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#57a84f';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 6, t.r * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawPickups(ctx, game) {
    for (const pk of game.pickups) {
      const bob = Math.sin(game.time * 4 + pk.x) * 3;
      ctx.fillStyle = pk.kind === 'cash' ? '#ffd94d' : '#7ddb7d';
      ctx.beginPath();
      ctx.arc(pk.x, pk.y + bob, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#7a5b00';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(pk.kind === 'cash' ? '$' : '+', pk.x, pk.y + bob + 4);
    }
  }

  _drawPeds(ctx, game) {
    for (const p of game.peds.peds) {
      const bob = Math.sin(p.walkPhase) * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(p.x, p.y + 8, 9, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = p.shirt;
      ctx.beginPath();
      ctx.arc(p.x, p.y + bob * 0.4, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(p.x + Math.cos(p.angle) * 4, p.y + Math.sin(p.angle) * 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const cop of game.police.cops) {
      ctx.fillStyle = '#2b4c9b';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#e8e8e8';
      ctx.beginPath();
      ctx.arc(cop.x + Math.cos(cop.angle) * 5, cop.y + Math.sin(cop.angle) * 5, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  _drawCarShape(ctx, c, isPlayer) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-22, -11, 46, 26);
    ctx.fillStyle = c.color;
    ctx.beginPath();
    ctx.roundRect(-22, -13, 46, 26, 7);
    ctx.fill();
    ctx.fillStyle = '#20242c';
    ctx.fillRect(-6, -11, 16, 22);
    ctx.fillStyle = '#cfe8ff';
    ctx.fillRect(12, -10, 6, 20);
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(20, -11, 3, 6);
    ctx.fillRect(20, 5, 3, 6);
    ctx.fillStyle = '#ff3b30';
    ctx.fillRect(-23, -11, 3, 6);
    ctx.fillRect(-23, 5, 3, 6);
    if (c.siren) {
      const on = Math.floor(performance.now() / 300) % 2 === 0;
      ctx.fillStyle = on ? '#ff3b30' : '#3d7bff';
      ctx.beginPath();
      ctx.arc(-2, 0, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    if (isPlayer) {
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(c.x, c.y, 30, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  _drawCars(ctx, game) {
    for (const c of game.cars) {
      if (c.wrecked) {
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.angle);
        ctx.fillStyle = '#555';
        ctx.beginPath();
        ctx.roundRect(-22, -13, 46, 26, 7);
        ctx.fill();
        ctx.restore();
        continue;
      }
      this._drawCarShape(ctx, c, c === game.player.car);
    }
  }

  _drawPlayer(ctx, game) {
    const p = game.player;
    if (p.car) return;
    const bob = p.moving ? Math.sin(game.time * 12) * 2 : 0;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + 9, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = COLORS.playerShirt;
    ctx.beginPath();
    ctx.arc(p.x, p.y + bob * 0.3, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 5, p.y + Math.sin(p.angle) * 5, 6, 0, Math.PI * 2);
    ctx.fill();
    // Aim direction when armed.
    if (p.hasPistol) {
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 26, p.y + Math.sin(p.aimAngle) * 26);
      ctx.stroke();
    }
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 17, 0, Math.PI * 2);
    ctx.stroke();
  }

  _drawEffects(ctx, game) {
    for (const e of game.effects) {
      if (e.kind === 'shot') {
        ctx.strokeStyle = `rgba(255, 220, 120, ${e.life / e.max})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(e.x0, e.y0);
        ctx.lineTo(e.x1, e.y1);
        ctx.stroke();
      } else if (e.kind === 'boom') {
        ctx.fillStyle = `rgba(255, ${140 + Math.floor(80 * (e.life / e.max))}, 40, ${e.life / e.max})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 8 + (1 - e.life / e.max) * 26, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.kind === 'smoke') {
        ctx.fillStyle = `rgba(120,120,120,${0.5 * (e.life / e.max)})`;
        ctx.beginPath();
        ctx.arc(e.x, e.y, 6 + (1 - e.life / e.max) * 14, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const s of game.skids) {
      ctx.strokeStyle = `rgba(20,20,20,${s.life * 0.5})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.stroke();
    }
  }

  _drawMissionMarker(ctx, game) {
    const target = game.missions.target;
    if (!target) return;
    const pulse = 1 + Math.sin(game.time * 5) * 0.15;
    ctx.save();
    ctx.translate(target.x, target.y);
    ctx.scale(pulse, pulse);
    ctx.strokeStyle = '#ffd94d';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, -34);
    ctx.lineTo(10, -14);
    ctx.lineTo(-10, -14);
    ctx.closePath();
    ctx.fillStyle = '#ffd94d';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    // Mission pickup points.
    const obj = game.missions.active?.objective;
    if (obj && obj.kind === 'collect') {
      for (const pt of obj.points) {
        if (pt.taken) continue;
        ctx.fillStyle = '#ffd94d';
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a5b00';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('$', pt.x, pt.y + 4);
      }
    }
  }

  _drawHud(game) {
    const ctx = this.ctx;
    const { width: W } = this.canvas;
    ctx.save();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'left';

    // Cash + health, top left.
    ctx.fillStyle = COLORS.hudBg;
    ctx.beginPath();
    ctx.roundRect(12, 12, 210, 64, 10);
    ctx.fill();
    ctx.fillStyle = '#ffd94d';
    ctx.fillText(`$${game.player.cash}`, 24, 36);
    ctx.fillStyle = '#e8e8e8';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText(`Mission ${Math.min(game.missions.index + 1, 6)}/6 — ${game.missions.currentTitle}`, 24, 54);
    ctx.fillStyle = '#333';
    ctx.fillRect(24, 60, 186, 8);
    ctx.fillStyle = game.player.health > 30 ? '#57d977' : '#ff5b4d';
    ctx.fillRect(24, 60, 186 * (game.player.health / 100), 8);

    // Wanted stars, top right.
    ctx.fillStyle = COLORS.hudBg;
    ctx.beginPath();
    ctx.roundRect(W - 182, 12, 170, 44, 10);
    ctx.fill();
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    let stars = '';
    for (let i = 0; i < 5; i++) stars += i < game.police.wanted ? '★' : '☆';
    ctx.fillStyle = game.police.wanted > 0 ? '#ffd94d' : '#8a8f99';
    ctx.fillText(stars, W - 97, 42);

    // Mission objective, bottom centre.
    const objText = game.missions.objectiveText;
    if (objText) {
      ctx.font = 'bold 15px system-ui, sans-serif';
      const tw = ctx.measureText(objText).width + 28;
      ctx.fillStyle = COLORS.hudBg;
      ctx.beginPath();
      ctx.roundRect((W - tw) / 2, this.canvas.height - 196, tw, 34, 10);
      ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.fillText(objText, W / 2, this.canvas.height - 174);
    }

    // Message banner.
    if (game.missions.messageTimer > 0) {
      ctx.font = 'bold 20px system-ui, sans-serif';
      const tw = ctx.measureText(game.missions.message).width + 36;
      ctx.fillStyle = 'rgba(12,16,24,0.82)';
      ctx.beginPath();
      ctx.roundRect((W - tw) / 2, 76, tw, 42, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(game.missions.message, W / 2, 104);
    }

    // Driving speed + car name, bottom right.
    if (game.player.car) {
      ctx.textAlign = 'right';
      ctx.fillStyle = COLORS.hudBg;
      ctx.beginPath();
      ctx.roundRect(W - 172, this.canvas.height - 196, 160, 56, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 24px system-ui, sans-serif';
      ctx.fillText(`${Math.round(Math.abs(game.player.car.speed) * 0.18)} mph`, W - 24, this.canvas.height - 160);
      ctx.font = '12px system-ui, sans-serif';
      ctx.fillStyle = '#c8ccd4';
      ctx.fillText(game.player.car.name, W - 24, this.canvas.height - 146);
    }

    // Controls hint, bottom centre-left, clear of the minimap (220px wide).
    ctx.textAlign = 'left';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(232,232,232,0.85)';
    const hint = game.player.car
      ? 'W/S drive · A/D steer · Space handbrake · E hop out · M mute · P pause'
      : 'WASD move · Shift run · E enter car · F punch · Click shoot · M mute · P pause';
    ctx.fillText(hint, 244, this.canvas.height - 216);

    // Ammo.
    if (game.player.hasPistol && game.player.onFoot) {
      ctx.textAlign = 'right';
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.fillStyle = '#e8e8e8';
      ctx.fillText(`AMMO ${game.player.ammo}`, W - 16, this.canvas.height - 168);
    }
    ctx.restore();
  }

  _drawMinimap(game) {
    const ctx = this.mapCtx;
    const mw = this.map.width;
    const mh = this.map.height;
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.clearRect(0, 0, mw, mh);
    ctx.fillStyle = '#20242c';
    ctx.fillRect(0, 0, mw, mh);
    ctx.fillStyle = '#3d9ec4';
    ctx.fillRect(0, mh - 10, mw, 10);
    ctx.strokeStyle = COLORS.minimapRoad;
    ctx.lineWidth = 3;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(rx * sx, 0);
      ctx.lineTo(rx * sx, mh);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(0, ry * sy);
      ctx.lineTo(mw, ry * sy);
      ctx.stroke();
    }
    // Mission target.
    const target = game.missions.target;
    if (target) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.arc(target.x * sx, target.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Police.
    ctx.fillStyle = '#3d7bff';
    for (const c of game.police.cars) {
      ctx.beginPath();
      ctx.arc(c.x * sx, c.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    // Player.
    const p = game.player;
    ctx.fillStyle = '#ffd94d';
    ctx.beginPath();
    ctx.arc(p.x * sx, p.y * sy, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x * sx, p.y * sy, 6, 0, Math.PI * 2);
    ctx.stroke();
    // Viewport box.
    const vw = (this.canvas.width / this.camera.zoom) * sx;
    const vh = (this.canvas.height / this.camera.zoom) * sy;
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(this.camera.x * sx, this.camera.y * sy, vw, vh);
  }
}
