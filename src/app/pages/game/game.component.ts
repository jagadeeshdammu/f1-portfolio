import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAPS, PROFILE, PROJECTS, SKILLS, STATS } from '../../data/profile.data';
import { Pt, TRACK_WIDTH, WORLD, buildTrack, frame, nearestIndex, seeded } from './track';

type GameState = 'title' | 'lights' | 'race' | 'panel' | 'finish';

interface Car {
  x: number;
  y: number;
  a: number; // heading (radians)
  v: number; // speed (world px per frame)
  steer: number; // -1..1, smoothed
}

interface Gate {
  code: string;
  title: string;
  color: string;
  idx: number;
  route: string;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

const HALF = TRACK_WIDTH / 2;

@Component({
  selector: 'app-game',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
})
export class GameComponent implements AfterViewInit, OnDestroy {
  @ViewChild('cv', { static: true }) private cvRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('time', { static: true }) private timeRef!: ElementRef<HTMLElement>;
  @ViewChild('speed', { static: true }) private speedRef!: ElementRef<HTMLElement>;
  @ViewChild('gear', { static: true }) private gearRef!: ElementRef<HTMLElement>;
  @ViewChild('rev', { static: true }) private revRef!: ElementRef<HTMLElement>;
  @ViewChild('toast', { static: true }) private toastRef!: ElementRef<HTMLElement>;

  private readonly zone = inject(NgZone);

  // ---------- content shown in the sector panels ----------
  readonly profile = PROFILE;
  readonly stats = STATS;
  readonly skills = SKILLS;
  readonly projects = PROJECTS;
  readonly laps = LAPS;

  // ---------- UI state (signals drive the Angular overlays) ----------
  readonly state = signal<GameState>('title');
  readonly panel = signal<number | null>(null);
  readonly done = signal<boolean[]>([false, false, false, false]);
  readonly auto = signal(false);
  readonly sound = signal(false);
  readonly litCount = signal(0);
  readonly openProject = signal<string | null>(null);
  readonly finalTime = signal('');
  readonly best = signal('--:--.---');
  readonly newBest = signal(false);
  readonly touchedControls = signal(false);
  readonly doneCount = computed(() => this.done().filter(Boolean).length);

  // ---------- world ----------
  private readonly track: Pt[] = buildTrack();
  readonly gates: Gate[] = [
    { code: 'S1', title: 'Driver profile', color: '#ffd400', idx: 0, route: '/story' },
    { code: 'S2', title: 'Skills garage', color: '#b14dff', idx: 0, route: '/garage' },
    { code: 'S3', title: 'Projects pit stop', color: '#00d2ff', idx: 0, route: '/pit-stop' },
    { code: 'S4', title: 'Team radio', color: '#00d26a', idx: 0, route: '/finish-line' },
  ];
  private readonly drs: number[];
  private readonly trees: { x: number; y: number; r: number }[] = [];
  private readonly crowd: { x: number; y: number; c: string }[] = [];
  private readonly bounds = { minX: 0, minY: 0, maxX: 0, maxY: 0 };

  private car: Car = { x: 0, y: 0, a: 0, v: 0, steer: 0 };
  private cam = { x: 0, y: 0, zoom: 1 };
  private skids: { x: number; y: number; a: number }[] = [];
  private particles: Particle[] = [];
  private keys = new Set<string>();
  private nearest = 0;
  private prevNearest = 0;
  private offTrack = false;
  private boostT = 0;
  private raceMs = 0;
  private raf = 0;
  private last = 0;
  private w = 0;
  private h = 0;
  private dpr = 1;
  private ctx!: CanvasRenderingContext2D;
  private timers: ReturnType<typeof setTimeout>[] = [];
  private toastTimer?: ReturnType<typeof setTimeout>;
  private audio?: { ctx: AudioContext; osc: OscillatorNode; gain: GainNode };

  constructor() {
    const n = this.track.length;
    [0.17, 0.4, 0.63, 0.86].forEach((f, i) => (this.gates[i].idx = Math.round(f * n)));
    this.drs = [0.08, 0.29, 0.52, 0.75].map((f) => Math.round(f * n));

    for (const p of this.track) {
      this.bounds.minX = Math.min(this.bounds.minX || p.x, p.x);
      this.bounds.minY = Math.min(this.bounds.minY || p.y, p.y);
      this.bounds.maxX = Math.max(this.bounds.maxX, p.x);
      this.bounds.maxY = Math.max(this.bounds.maxY, p.y);
    }

    const rnd = seeded(21);
    while (this.trees.length < 170) {
      const x = rnd() * WORLD.w;
      const y = rnd() * WORLD.h;
      if (nearestIndex(this.track, x, y).d > HALF + 70) this.trees.push({ x, y, r: 16 + rnd() * 22 });
    }
    // grandstand next to the start line
    const { n: nn, t } = frame(this.track, 0);
    const colors = ['#e10600', '#ffd400', '#fff', '#00d2ff', '#00d26a'];
    for (let row = 0; row < 4; row++) {
      for (let col = -14; col <= 14; col++) {
        const off = HALF + 60 + row * 16;
        this.crowd.push({
          x: this.track[0].x - nn.x * off + t.x * col * 14,
          y: this.track[0].y - nn.y * off + t.y * col * 14,
          c: colors[Math.floor(rnd() * colors.length)],
        });
      }
    }

    try {
      const b = localStorage.getItem('dj-best-lap');
      if (b) this.best.set(this.fmt(Number(b)));
    } catch {
      /* storage blocked: best lap just isn't remembered */
    }
    this.resetCar();
  }

  // ======================= lifecycle =======================
  ngAfterViewInit(): void {
    const ctx = this.cvRef.nativeElement.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    document.body.classList.add('game-on');
    this.resize();
    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onResize);
      window.addEventListener('keydown', this.onKeyDown);
      window.addEventListener('keyup', this.onKeyUp);
      this.last = performance.now();
      const loop = (now: number) => {
        const dt = Math.min(2.5, (now - this.last) / 16.667);
        this.last = now;
        if (!document.hidden) {
          this.update(dt, now);
          this.draw(now);
        }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    this.timers.forEach(clearTimeout);
    clearTimeout(this.toastTimer);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    document.body.classList.remove('game-on');
    this.audio?.ctx.close();
  }

  // ======================= UI actions =======================
  start(autoDrive = false): void {
    this.resetCar();
    this.done.set([false, false, false, false]);
    this.raceMs = 0;
    this.skids = [];
    this.newBest.set(false);
    this.auto.set(autoDrive);
    this.panel.set(null);
    this.state.set('lights');
    this.litCount.set(0);
    this.timers.forEach(clearTimeout);
    for (let i = 1; i <= 5; i++) this.timers.push(setTimeout(() => this.litCount.set(i), i * 380));
    this.timers.push(
      setTimeout(() => {
        this.state.set('race');
        this.showToast('LIGHTS OUT AND AWAY WE GO');
      }, 5 * 380 + 650),
    );
  }

  continueRace(): void {
    this.panel.set(null);
    this.openProject.set(null);
    this.state.set('race');
    if (this.doneCount() === 4) this.showToast('ALL SECTORS CLEAR · CROSS THE FINISH LINE');
  }

  toggleAuto(): void {
    this.auto.update((v) => !v);
  }

  toggleProject(id: string): void {
    this.openProject.update((v) => (v === id ? null : id));
  }

  toggleSound(): void {
    if (!this.audio) {
      try {
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        filter.type = 'lowpass';
        filter.frequency.value = 900;
        gain.gain.value = 0;
        osc.connect(filter).connect(gain).connect(ctx.destination);
        osc.start();
        this.audio = { ctx, osc, gain };
      } catch {
        return;
      }
    }
    this.sound.update((v) => !v);
    this.audio.gain.gain.setTargetAtTime(this.sound() ? 0.045 : 0, this.audio.ctx.currentTime, 0.05);
  }

  press(key: string, down: boolean, ev?: Event): void {
    ev?.preventDefault();
    if (down) {
      this.keys.add(key);
      this.auto.set(false);
      this.touchedControls.set(true);
    } else {
      this.keys.delete(key);
    }
  }

  // ======================= input =======================
  private readonly onResize = () => this.resize();

  private readonly onKeyDown = (e: KeyboardEvent) => {
    const k = this.mapKey(e.key);
    if (k) {
      e.preventDefault();
      this.keys.add(k);
      if (this.state() === 'race' && (this.auto() || !this.touchedControls())) {
        this.zone.run(() => {
          this.auto.set(false);
          this.touchedControls.set(true);
        });
      }
    }
    if (e.key === 'Enter' || (e.key === 'Escape' && this.state() === 'panel')) {
      this.zone.run(() => {
        const s = this.state();
        if (s === 'title' || s === 'finish') this.start();
        else if (s === 'panel') this.continueRace();
      });
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent) => {
    const k = this.mapKey(e.key);
    if (k) this.keys.delete(k);
  };

  private mapKey(key: string): string | null {
    switch (key) {
      case 'ArrowUp': case 'w': case 'W': return 'gas';
      case 'ArrowDown': case 's': case 'S': case ' ': return 'brake';
      case 'ArrowLeft': case 'a': case 'A': return 'left';
      case 'ArrowRight': case 'd': case 'D': return 'right';
      default: return null;
    }
  }

  // ======================= simulation =======================
  private resetCar(): void {
    const p = this.track[2];
    const { t } = frame(this.track, 2);
    this.car = { x: p.x, y: p.y, a: Math.atan2(t.y, t.x), v: 0, steer: 0 };
    this.nearest = this.prevNearest = 2;
    this.cam.x = p.x;
    this.cam.y = p.y;
  }

  private update(dt: number, now: number): void {
    const s = this.state();
    const c = this.car;
    const driving = s === 'race' || s === 'title';
    let gas = false;
    let brake = false;
    let steer = 0;

    if (driving) {
      if (s === 'title' || this.auto()) {
        // autopilot: aim at a point further down the track
        const target = this.track[(this.nearest + 16) % this.track.length];
        let diff = Math.atan2(target.y - c.y, target.x - c.x) - c.a;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        steer = Math.max(-1, Math.min(1, diff * 2.6));
        gas = Math.abs(diff) < 0.5 || c.v < 7;
        brake = Math.abs(diff) > 0.7 && c.v > 8;
      } else {
        gas = this.keys.has('gas');
        brake = this.keys.has('brake');
        steer = (this.keys.has('right') ? 1 : 0) - (this.keys.has('left') ? 1 : 0);
      }
    } else {
      brake = true;
    }

    const max = (this.boostT > 0 ? 21 : 13.5) * (this.offTrack ? 0.42 : 1);
    if (gas) c.v += 0.3 * dt;
    if (brake) c.v -= (c.v > 0 ? 0.6 : 0.15) * dt;
    if (!gas && !brake) c.v *= Math.pow(this.offTrack ? 0.95 : 0.988, dt);
    if (c.v > max) c.v += (max - c.v) * 0.08 * dt;
    if (!driving && c.v < 0) c.v = 0;
    c.v = Math.max(-4, c.v);

    c.steer += (steer - c.steer) * Math.min(1, 0.25 * dt);
    const grip = Math.min(1, Math.abs(c.v) / 5) * (c.v < 0 ? -1 : 1);
    c.a += c.steer * 0.05 * grip * dt;
    c.x += Math.cos(c.a) * c.v * dt;
    c.y += Math.sin(c.a) * c.v * dt;

    // tyre-wall at the edge of the world
    const pad = 40;
    if (c.x < pad || c.x > WORLD.w - pad || c.y < pad || c.y > WORLD.h - pad) {
      c.x = Math.max(pad, Math.min(WORLD.w - pad, c.x));
      c.y = Math.max(pad, Math.min(WORLD.h - pad, c.y));
      c.v *= -0.3;
      this.spark(c.x, c.y, '#ffd400', 14);
    }

    const near = nearestIndex(this.track, c.x, c.y);
    this.prevNearest = this.nearest;
    this.nearest = near.i;
    this.offTrack = near.d > HALF + 8;

    if (this.boostT > 0) this.boostT -= dt * 16.667;

    // effects
    const speed = Math.abs(c.v);
    if ((Math.abs(c.steer) > 0.65 && speed > 9) || (this.offTrack && speed > 3)) {
      if (this.skids.length > 900) this.skids.splice(0, 2);
      const bx = c.x - Math.cos(c.a) * 20;
      const by = c.y - Math.sin(c.a) * 20;
      const nx = -Math.sin(c.a) * 12;
      const ny = Math.cos(c.a) * 12;
      this.skids.push({ x: bx + nx, y: by + ny, a: c.a }, { x: bx - nx, y: by - ny, a: c.a });
      if (this.offTrack && Math.random() < 0.6) this.spark(bx, by, 'rgba(160,140,110,.8)', 1);
    }
    if (this.boostT > 0 && Math.random() < 0.8) this.spark(c.x - Math.cos(c.a) * 34, c.y - Math.sin(c.a) * 34, '#00d2ff', 1);
    for (const p of this.particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.life -= 0.03 * dt;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    // camera follows with a look-ahead
    const lead = 22;
    this.cam.x += (c.x + Math.cos(c.a) * c.v * lead - this.cam.x) * 0.08 * dt;
    this.cam.y += (c.y + Math.sin(c.a) * c.v * lead - this.cam.y) * 0.08 * dt;
    const baseZoom = Math.max(0.5, Math.min(1.05, Math.min(this.w, this.h) / 820));
    const targetZoom = baseZoom * (1 - Math.min(speed, 21) / 70);
    this.cam.zoom += (targetZoom - this.cam.zoom) * 0.05 * dt;

    // engine note
    if (this.audio && this.sound()) {
      const gearSize = 2.6;
      const rev = (speed % gearSize) / gearSize;
      this.audio.osc.frequency.setTargetAtTime(55 + rev * 110 + Math.floor(speed / gearSize) * 12, this.audio.ctx.currentTime, 0.04);
    }

    // HUD (direct DOM writes, no change detection)
    const gear = speed < 0.3 ? 'N' : c.v < 0 ? 'R' : String(Math.min(8, 1 + Math.floor(speed / 2.6)));
    this.speedRef.nativeElement.textContent = String(Math.round(speed * 24));
    this.gearRef.nativeElement.textContent = gear;
    this.revRef.nativeElement.style.transform = `scaleX(${Math.min(1, speed / 21).toFixed(3)})`;

    if (s !== 'race') return;
    this.raceMs += dt * 16.667;
    this.timeRef.nativeElement.textContent = this.fmt(this.raceMs);

    // DRS pads
    for (const d of this.drs) {
      const p = this.track[d];
      if (this.boostT <= 0 && Math.hypot(p.x - c.x, p.y - c.y) < 60) {
        this.boostT = 1300;
        this.showToast('DRS ENABLED');
        this.spark(c.x, c.y, '#00d2ff', 18);
      }
    }

    // sector gates
    const doneNow = this.done();
    this.gates.forEach((g, i) => {
      const p = this.track[g.idx];
      if (!doneNow[i] && Math.hypot(p.x - c.x, p.y - c.y) < HALF + 10) {
        c.v *= 0.25;
        this.spark(p.x, p.y, g.color, 40);
        this.zone.run(() => {
          const next = [...this.done()];
          next[i] = true;
          this.done.set(next);
          this.panel.set(i);
          this.state.set('panel');
        });
      }
    });

    // finish line: all sectors cleared and the car crosses sample 0
    const n = this.track.length;
    if (this.doneCount() === 4 && this.prevNearest > n - 40 && this.nearest < 20) {
      this.finish();
    }
    void now;
  }

  private finish(): void {
    const ms = this.raceMs;
    let isBest = false;
    try {
      const prev = Number(localStorage.getItem('dj-best-lap') || 0);
      if (!prev || ms < prev) {
        localStorage.setItem('dj-best-lap', String(Math.round(ms)));
        isBest = true;
      }
    } catch {
      isBest = true;
    }
    this.spark(this.car.x, this.car.y, '#fff', 60);
    this.zone.run(() => {
      this.finalTime.set(this.fmt(ms));
      if (isBest) this.best.set(this.fmt(ms));
      this.newBest.set(isBest);
      this.state.set('finish');
    });
  }

  private spark(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 1 + Math.random() * 5;
      this.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 1, color, size: 2 + Math.random() * 4 });
    }
  }

  private showToast(text: string): void {
    const el = this.toastRef.nativeElement;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
  }

  fmt(ms: number): string {
    const m = Math.floor(ms / 60000).toString().padStart(2, '0');
    const s = Math.floor((ms % 60000) / 1000).toString().padStart(2, '0');
    const x = Math.floor(ms % 1000).toString().padStart(3, '0');
    return `${m}:${s}.${x}`;
  }

  // ======================= rendering =======================
  private resize(): void {
    const c = this.cvRef.nativeElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    c.width = Math.round(this.w * this.dpr);
    c.height = Math.round(this.h * this.dpr);
  }

  private draw(now: number): void {
    const { ctx, w, h, dpr, cam } = this;
    const z = cam.zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#0b0d12';
    ctx.fillRect(0, 0, w, h);

    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - cam.x * z), dpr * (h / 2 - cam.y * z));
    const view = { x0: cam.x - w / 2 / z - 80, y0: cam.y - h / 2 / z - 80, x1: cam.x + w / 2 / z + 80, y1: cam.y + h / 2 / z + 80 };

    // ground grid
    ctx.strokeStyle = 'rgba(255,255,255,0.035)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let x = Math.floor(view.x0 / 100) * 100; x < view.x1; x += 100) { ctx.moveTo(x, view.y0); ctx.lineTo(x, view.y1); }
    for (let y = Math.floor(view.y0 / 100) * 100; y < view.y1; y += 100) { ctx.moveTo(view.x0, y); ctx.lineTo(view.x1, y); }
    ctx.stroke();

    // tyre wall around the world
    ctx.lineWidth = 18;
    ctx.setLineDash([36, 36]);
    ctx.strokeStyle = '#e10600';
    ctx.strokeRect(12, 12, WORLD.w - 24, WORLD.h - 24);
    ctx.lineDashOffset = 36;
    ctx.strokeStyle = '#eee';
    ctx.strokeRect(12, 12, WORLD.w - 24, WORLD.h - 24);
    ctx.setLineDash([]);
    ctx.lineDashOffset = 0;

    // trees
    for (const t of this.trees) {
      if (t.x < view.x0 || t.x > view.x1 || t.y < view.y0 || t.y > view.y1) continue;
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.beginPath(); ctx.arc(t.x + 8, t.y + 10, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#123a24';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#1d5a37';
      ctx.beginPath(); ctx.arc(t.x - t.r * 0.25, t.y - t.r * 0.25, t.r * 0.55, 0, Math.PI * 2); ctx.fill();
    }

    // track: kerbs, asphalt, centre line
    this.pathTrack();
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#f2f2f2';
    ctx.lineWidth = TRACK_WIDTH + 26;
    ctx.stroke();
    ctx.strokeStyle = '#e10600';
    ctx.setLineDash([30, 30]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = '#1c1c25';
    ctx.lineWidth = TRACK_WIDTH;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.18)';
    ctx.lineWidth = 3;
    ctx.setLineDash([40, 50]);
    ctx.stroke();
    ctx.setLineDash([]);

    // skid marks
    ctx.fillStyle = 'rgba(0,0,0,.45)';
    for (const s of this.skids) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);

    this.drawStartLine();
    this.drawDrs(now);
    this.drawGates(now);

    // crowd
    for (const p of this.crowd) {
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.55 + 0.45 * Math.sin(now / 180 + p.x);
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    ctx.globalAlpha = 1;

    // particles
    for (const p of this.particles) {
      ctx.globalAlpha = Math.max(0, p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;

    this.drawCar();
    this.drawMinimap();
  }

  private pathTrack(): void {
    const { ctx, track } = this;
    ctx.beginPath();
    ctx.moveTo(track[0].x, track[0].y);
    for (let i = 1; i < track.length; i++) ctx.lineTo(track[i].x, track[i].y);
    ctx.closePath();
  }

  private drawStartLine(): void {
    const { ctx } = this;
    const p = this.track[0];
    const { t, n } = frame(this.track, 0);
    const sq = 17;
    const cells = Math.ceil(TRACK_WIDTH / sq);
    for (let r = 0; r < 2; r++) {
      for (let k = 0; k < cells; k++) {
        ctx.fillStyle = (k + r) % 2 ? '#111' : '#fff';
        const off = -HALF + k * sq;
        const cx = p.x + n.x * off + t.x * r * sq;
        const cy = p.y + n.y * off + t.y * r * sq;
        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(Math.atan2(t.y, t.x));
        ctx.fillRect(0, 0, sq, sq);
        ctx.restore();
      }
    }
  }

  private drawDrs(now: number): void {
    const { ctx } = this;
    for (const d of this.drs) {
      const p = this.track[d];
      const { t } = frame(this.track, d);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(Math.atan2(t.y, t.x));
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(now / 150 - k));
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(-30 + k * 26, -36);
        ctx.lineTo(-6 + k * 26, 0);
        ctx.lineTo(-30 + k * 26, 36);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }

  private drawGates(now: number): void {
    const { ctx } = this;
    const doneNow = this.done();
    this.gates.forEach((g, i) => {
      const p = this.track[g.idx];
      const { n } = frame(this.track, g.idx);
      const col = doneNow[i] ? '#00d26a' : g.color;
      const pulse = doneNow[i] ? 0 : (Math.sin(now / 250) + 1) / 2;
      const a = { x: p.x + n.x * (HALF + 16), y: p.y + n.y * (HALF + 16) };
      const b = { x: p.x - n.x * (HALF + 16), y: p.y - n.y * (HALF + 16) };

      ctx.save();
      ctx.shadowColor = col;
      ctx.shadowBlur = 20 + pulse * 30;
      ctx.strokeStyle = col;
      ctx.globalAlpha = doneNow[i] ? 0.5 : 0.9;
      ctx.lineWidth = 6;
      ctx.setLineDash([14, 10]);
      ctx.lineDashOffset = -now / 30;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = col;
      for (const q of [a, b]) {
        ctx.beginPath();
        ctx.arc(q.x, q.y, 14 + pulse * 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!doneNow[i]) {
        ctx.globalAlpha = 0.25 * (1 - pulse);
        ctx.beginPath();
        ctx.arc(p.x, p.y, HALF + 20 + pulse * 40, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // label
      ctx.save();
      ctx.font = '900 30px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      const lx = p.x + n.x * (HALF + 70);
      const ly = p.y + n.y * (HALF + 70);
      const label = doneNow[i] ? `${g.code} ✓` : `${g.code} · ${g.title.toUpperCase()}`;
      const tw = ctx.measureText(label).width + 30;
      ctx.fillStyle = 'rgba(11,11,15,.85)';
      ctx.fillRect(lx - tw / 2, ly - 30, tw, 44);
      ctx.fillStyle = col;
      ctx.fillRect(lx - tw / 2, ly + 10, tw, 4);
      ctx.fillText(label, lx, ly + 2);
      ctx.restore();
    });
  }

  private drawCar(): void {
    const { ctx, car } = this;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.a);
    ctx.scale(1.35, 1.35);

    ctx.fillStyle = 'rgba(0,0,0,.45)';
    ctx.fillRect(-28, -14, 64, 32);

    // tyres (front ones turn with steering)
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(-26, -17, 14, 8);
    ctx.fillRect(-26, 9, 14, 8);
    for (const sy of [-16, 9]) {
      ctx.save();
      ctx.translate(18, sy + 3.5);
      ctx.rotate(car.steer * 0.45);
      ctx.fillRect(-6, -3.5, 12, 7);
      ctx.restore();
    }

    // body
    const g = ctx.createLinearGradient(0, -12, 0, 12);
    g.addColorStop(0, '#ff3b30');
    g.addColorStop(0.5, '#e10600');
    g.addColorStop(1, '#7a0000');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-24, -6);
    ctx.lineTo(-6, -11);
    ctx.lineTo(10, -9);
    ctx.lineTo(22, -4);
    ctx.lineTo(36, -2);
    ctx.lineTo(36, 2);
    ctx.lineTo(22, 4);
    ctx.lineTo(10, 9);
    ctx.lineTo(-6, 11);
    ctx.lineTo(-24, 6);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-20, -1, 54, 2);

    // wings
    ctx.fillStyle = '#e10600';
    ctx.fillRect(-32, -15, 7, 30);
    ctx.fillRect(33, -16, 5, 32);
    ctx.fillStyle = '#111';
    ctx.fillRect(-32, -15, 2, 30);

    // halo + helmet
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(-2, 0, 7, -1.2, 1.2);
    ctx.stroke();
    ctx.fillStyle = '#ffd400';
    ctx.beginPath();
    ctx.arc(-4, 0, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // rain light
    if (Math.floor(performance.now() / 160) % 2 === 0) {
      ctx.fillStyle = '#ff2a1f';
      ctx.shadowColor = '#ff2a1f';
      ctx.shadowBlur = 12;
      ctx.fillRect(-34, -2, 3, 4);
    }
    ctx.restore();
  }

  private drawMinimap(): void {
    const { ctx, dpr, w, track, bounds } = this;
    const mw = Math.min(190, w * 0.34);
    const scale = mw / (bounds.maxX - bounds.minX + 200);
    const mh = (bounds.maxY - bounds.minY + 200) * scale;
    const ox = w - mw - 16;
    const oy = 74;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = 'rgba(11,11,15,.75)';
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(ox, oy, mw, mh, 10);
    ctx.fill();
    ctx.stroke();

    const mx = (x: number) => ox + (x - bounds.minX + 100) * scale;
    const my = (y: number) => oy + (y - bounds.minY + 100) * scale;
    ctx.beginPath();
    ctx.moveTo(mx(track[0].x), my(track[0].y));
    for (const p of track) ctx.lineTo(mx(p.x), my(p.y));
    ctx.closePath();
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 4;
    ctx.stroke();

    const doneNow = this.done();
    this.gates.forEach((g, i) => {
      ctx.fillStyle = doneNow[i] ? '#00d26a' : g.color;
      ctx.beginPath();
      ctx.arc(mx(track[g.idx].x), my(track[g.idx].y), 4.5, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#fff';
    ctx.fillRect(mx(track[0].x) - 4, my(track[0].y) - 1.5, 8, 3);
    ctx.fillStyle = '#ff2a1f';
    ctx.shadowColor = '#ff2a1f';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(mx(this.car.x), my(this.car.y), 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
