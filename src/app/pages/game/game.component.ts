import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAPS, PROFILE, PROJECTS, SKILLS, STATS } from '../../data/profile.data';
import { IconComponent } from '../../shared/icon.component';
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
  imports: [RouterLink, IconComponent],
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
    this.buildWorld();
    this.buildCarSprite();
    // rebuild once web fonts arrive so the painted text uses Orbitron
    document.fonts?.ready.then(() => { this.buildWorld(); this.buildCarSprite(); });
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
      else if (Math.random() < 0.5) this.spark(bx, by, 'rgba(220,220,230,.55)', 1);
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
    // keep the camera inside the world so no empty space shows at the edges
    const hw = this.w / 2 / this.cam.zoom;
    const hh = this.h / 2 / this.cam.zoom;
    this.cam.x = hw * 2 >= WORLD.w ? WORLD.w / 2 : Math.max(hw, Math.min(WORLD.w - hw, this.cam.x));
    this.cam.y = hh * 2 >= WORLD.h ? WORLD.h / 2 : Math.max(hh, Math.min(WORLD.h - hh, this.cam.y));

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
      const soft = color.startsWith('rgba');
      this.particles.push({ x, y, vx: Math.cos(a) * s * (soft ? 0.3 : 1), vy: Math.sin(a) * s * (soft ? 0.3 : 1), life: 1, color, size: soft ? 8 + Math.random() * 8 : 2 + Math.random() * 4 });
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
  private world?: HTMLCanvasElement;
  private worldScale = 1;
  private carSprite?: HTMLCanvasElement;
  private vignette?: CanvasGradient;
  private static readonly CAR_W = 110;
  private static readonly CAR_H = 50;
  private static readonly CAR_K = 1.2; // sprite units -> world px

  private resize(): void {
    const c = this.cvRef.nativeElement;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    c.width = Math.round(this.w * this.dpr);
    c.height = Math.round(this.h * this.dpr);
    if (this.ctx) {
      const v = this.ctx.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
      v.addColorStop(0, 'rgba(0,0,0,0)');
      v.addColorStop(1, 'rgba(0,0,0,0.6)');
      this.vignette = v;
    }
  }

  /** Bakes everything that never moves (ground, run-off, kerbs, asphalt, lights, buildings, trees) into one canvas. */
  private buildWorld(): void {
    const big = window.innerWidth > 900 && (window.devicePixelRatio || 1) >= 1.5;
    const S = (this.worldScale = big ? 1.5 : 1);
    const c = document.createElement('canvas');
    c.width = WORLD.w * S;
    c.height = WORLD.h * S;
    const g = c.getContext('2d');
    if (!g) return;
    g.scale(S, S);
    const rnd = seeded(7);
    const track = this.track;

    // night grass with mowing stripes and grain
    g.fillStyle = '#08100b';
    g.fillRect(0, 0, WORLD.w, WORLD.h);
    g.fillStyle = '#0b1610';
    for (let x = 0; x < WORLD.w; x += 180) g.fillRect(x, 0, 90, WORLD.h);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = rnd() < 0.5 ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.25)';
      g.fillRect(rnd() * WORLD.w, rnd() * WORLD.h, 2, 2);
    }

    // floodlight pools (additive)
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < track.length; i += 26) {
      const p = track[i];
      const pool = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, 330);
      pool.addColorStop(0, 'rgba(255,236,200,0.16)');
      pool.addColorStop(0.5, 'rgba(255,220,170,0.06)');
      pool.addColorStop(1, 'rgba(255,220,170,0)');
      g.fillStyle = pool;
      g.fillRect(p.x - 330, p.y - 330, 660, 660);
    }
    g.globalCompositeOperation = 'source-over';

    // run-off tarmac, white edge, kerbs, asphalt
    const path = () => {
      g.beginPath();
      g.moveTo(track[0].x, track[0].y);
      for (let i = 1; i < track.length; i++) g.lineTo(track[i].x, track[i].y);
      g.closePath();
    };
    g.lineJoin = 'round';
    g.lineCap = 'round';
    path();
    g.strokeStyle = '#3a2f22'; // gravel trap edge
    g.lineWidth = TRACK_WIDTH + 210;
    g.stroke();
    g.strokeStyle = '#1a1c22';
    g.lineWidth = TRACK_WIDTH + 170;
    g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.08)';
    g.lineWidth = TRACK_WIDTH + 172;
    g.setLineDash([2, 18]);
    g.stroke();
    g.setLineDash([]);
    g.strokeStyle = '#f4f4f4';
    g.lineWidth = TRACK_WIDTH + 28;
    g.stroke();
    g.strokeStyle = '#d90a00';
    g.setLineDash([28, 28]);
    g.stroke();
    g.setLineDash([]);

    const tex = document.createElement('canvas');
    tex.width = tex.height = 128;
    const tg = tex.getContext('2d');
    if (tg) {
      tg.fillStyle = '#22232b';
      tg.fillRect(0, 0, 128, 128);
      for (let i = 0; i < 1400; i++) {
        const v = 25 + Math.floor(rnd() * 40);
        tg.fillStyle = `rgba(${v},${v},${v + 6},${0.35 + rnd() * 0.4})`;
        tg.fillRect(rnd() * 128, rnd() * 128, 1.5, 1.5);
      }
    }
    const pattern = g.createPattern(tex, 'repeat');
    g.strokeStyle = pattern ?? '#22232b';
    g.lineWidth = TRACK_WIDTH;
    g.stroke();

    // rubbered-in racing line
    g.strokeStyle = 'rgba(0,0,0,0.22)';
    g.lineWidth = 46;
    g.stroke();

    // white track-limit lines
    for (const side of [1, -1]) {
      g.beginPath();
      for (let i = 0; i <= track.length; i++) {
        const k = i % track.length;
        const { n } = frame(track, k);
        const x = track[k].x + n.x * side * (TRACK_WIDTH / 2 - 7);
        const y = track[k].y + n.y * side * (TRACK_WIDTH / 2 - 7);
        if (i === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 3;
      g.stroke();
    }

    // grid boxes behind the start line
    for (let k = 1; k <= 6; k++) {
      const i = (track.length - k * 9) % track.length;
      const { t, n } = frame(track, i);
      const side = k % 2 ? 1 : -1;
      const cx = track[i].x + n.x * side * 36;
      const cy = track[i].y + n.y * side * 36;
      g.save();
      g.translate(cx, cy);
      g.rotate(Math.atan2(t.y, t.x));
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(-14, -22);
      g.lineTo(10, -22);
      g.lineTo(10, 22);
      g.lineTo(-14, 22);
      g.stroke();
      g.restore();
    }

    // pit building + grandstand roof along the main straight
    const { t: t0, n: n0 } = frame(track, 0);
    const ang = Math.atan2(t0.y, t0.x);
    const block = (off: number, len: number, depth: number, fill: string) => {
      g.save();
      g.translate(track[0].x + n0.x * off, track[0].y + n0.y * off);
      g.rotate(ang);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.fillRect(-len / 2 + 10, -depth / 2 + 12, len, depth);
      g.fillStyle = fill;
      g.fillRect(-len / 2, -depth / 2, len, depth);
      g.restore();
    };
    block(HALF + 150, 640, 70, '#1d1f27');
    g.save();
    g.translate(track[0].x + n0.x * (HALF + 150), track[0].y + n0.y * (HALF + 150));
    g.rotate(ang);
    for (let i = 0; i < 12; i++) {
      const x = -300 + i * 52;
      const glow = g.createLinearGradient(0, -35, 0, -10);
      glow.addColorStop(0, 'rgba(255,240,210,0.95)');
      glow.addColorStop(1, 'rgba(255,240,210,0)');
      g.fillStyle = i % 4 === 1 ? '#e10600' : '#f0f0f0';
      g.fillRect(x, -35, 40, 6);
      g.fillStyle = glow;
      g.fillRect(x, -29, 40, 20);
    }
    g.fillStyle = '#e10600';
    g.font = '900 34px Orbitron, sans-serif';
    g.textAlign = 'center';
    g.fillText('DJ RACING · PIT LANE', 0, 22);
    g.restore();
    block(-(HALF + 128), 460, 92, 'rgba(30,32,40,0.55)');

    // light towers
    for (let i = 13; i < track.length; i += 26) {
      const { n } = frame(track, i);
      const side = (i / 26) % 2 < 1 ? 1 : -1;
      const x = track[i].x + n.x * side * (HALF + 100);
      const y = track[i].y + n.y * side * (HALF + 100);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.beginPath();
      g.arc(x + 6, y + 8, 12, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#9aa0ad';
      g.beginPath();
      g.arc(x, y, 10, 0, Math.PI * 2);
      g.fill();
      const lamp = g.createRadialGradient(x, y, 0, x, y, 40);
      lamp.addColorStop(0, 'rgba(255,250,235,0.95)');
      lamp.addColorStop(1, 'rgba(255,250,235,0)');
      g.fillStyle = lamp;
      g.fillRect(x - 40, y - 40, 80, 80);
    }

    // trees
    for (const t of this.trees) {
      g.fillStyle = 'rgba(0,0,0,0.45)';
      g.beginPath();
      g.arc(t.x + 10, t.y + 12, t.r, 0, Math.PI * 2);
      g.fill();
      const leaf = g.createRadialGradient(t.x - t.r * 0.35, t.y - t.r * 0.35, t.r * 0.1, t.x, t.y, t.r);
      leaf.addColorStop(0, '#2f7a4a');
      leaf.addColorStop(0.6, '#164a2c');
      leaf.addColorStop(1, '#0b2617');
      g.fillStyle = leaf;
      g.beginPath();
      g.arc(t.x, t.y, t.r, 0, Math.PI * 2);
      g.fill();
    }

    // tyre wall around the world
    g.lineWidth = 18;
    g.setLineDash([36, 36]);
    g.strokeStyle = '#d90a00';
    g.strokeRect(12, 12, WORLD.w - 24, WORLD.h - 24);
    g.lineDashOffset = 36;
    g.strokeStyle = '#e8e8e8';
    g.strokeRect(12, 12, WORLD.w - 24, WORLD.h - 24);
    g.setLineDash([]);

    this.world = c;
  }

  /** A 2026-spec F1 car, top-down, drawn once at 4x resolution and reused every frame. */
  private buildCarSprite(): void {
    const SS = 4;
    const W = GameComponent.CAR_W;
    const H = GameComponent.CAR_H;
    const c = document.createElement('canvas');
    c.width = W * SS;
    c.height = H * SS;
    const g = c.getContext('2d');
    if (!g) return;
    g.scale(SS, SS);
    g.translate(W / 2, H / 2);

    const sym = (pts: [number, number][]) => {
      g.beginPath();
      g.moveTo(pts[0][0], pts[0][1]);
      for (const [x, y] of pts.slice(1)) g.lineTo(x, y);
      for (const [x, y] of [...pts].reverse()) g.lineTo(x, -y);
      g.closePath();
    };
    const tyre = (x: number, y: number, w: number, h: number) => {
      const grd = g.createLinearGradient(0, y, 0, y + h);
      grd.addColorStop(0, '#2b2b2f');
      grd.addColorStop(0.5, '#08080a');
      grd.addColorStop(1, '#2b2b2f');
      g.fillStyle = grd;
      g.beginPath();
      g.roundRect(x, y, w, h, 2.5);
      g.fill();
      g.fillStyle = '#ffd400'; // medium compound band
      g.fillRect(x + 1.5, y + 0.6, w - 3, 0.9);
      g.fillRect(x + 1.5, y + h - 1.5, w - 3, 0.9);
    };

    // floor + diffuser
    g.fillStyle = '#121217';
    sym([[34, -5], [12, -15], [-30, -16.5], [-42, -12]]);
    g.fill();
    g.strokeStyle = '#2a2a33';
    g.lineWidth = 0.6;
    g.stroke();

    // suspension
    g.strokeStyle = '#3a3a44';
    g.lineWidth = 1.1;
    for (const s of [1, -1]) {
      g.beginPath();
      g.moveTo(16, 5 * s); g.lineTo(29, 16.5 * s);
      g.moveTo(24, 3.5 * s); g.lineTo(29, 16.5 * s);
      g.moveTo(-20, 9 * s); g.lineTo(-37, 18 * s);
      g.moveTo(-30, 6 * s); g.lineTo(-37, 18 * s);
      g.stroke();
    }

    // tyres (18-inch, wide rears)
    tyre(-47, 12.5, 19, 10.5);
    tyre(-47, -23, 19, 10.5);
    tyre(22, 12, 15, 9);
    tyre(22, -21, 15, 9);

    // rear wing with DRS flap
    const rw = g.createLinearGradient(-54, 0, -44, 0);
    rw.addColorStop(0, '#0d0d10');
    rw.addColorStop(1, '#e10600');
    g.fillStyle = rw;
    g.beginPath();
    g.roundRect(-54, -18, 9, 36, 1.5);
    g.fill();
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = 0.6;
    g.beginPath();
    g.moveTo(-49, -17); g.lineTo(-49, 17);
    g.stroke();
    g.fillStyle = '#0d0d10';
    g.fillRect(-55, -19.5, 11, 2.2);
    g.fillRect(-55, 17.3, 11, 2.2);

    // front wing: three elements + endplates
    const fwColors = ['#e10600', '#15151a', '#ff3b30'];
    fwColors.forEach((col, k) => {
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(39 + k * 2.6, -21);
      g.quadraticCurveTo(46 + k * 2.6, 0, 39 + k * 2.6, 21);
      g.lineTo(41.2 + k * 2.6, 21);
      g.quadraticCurveTo(48.2 + k * 2.6, 0, 41.2 + k * 2.6, -21);
      g.closePath();
      g.fill();
    });
    g.fillStyle = '#0d0d10';
    g.fillRect(37.5, -22.5, 10, 2.2);
    g.fillRect(37.5, 20.3, 10, 2.2);

    // main body: nose, cockpit, sidepods with undercut, tapered engine cover
    const body = g.createLinearGradient(0, -15, 0, 15);
    body.addColorStop(0, '#6e0000');
    body.addColorStop(0.28, '#ff3a2e');
    body.addColorStop(0.5, '#d40800');
    body.addColorStop(0.72, '#ff3a2e');
    body.addColorStop(1, '#6e0000');
    g.fillStyle = body;
    sym([[50, -1.4], [40, -2.8], [28, -4.4], [17, -5.6], [9, -7.6], [5, -12.6], [-6, -14], [-17, -12.6], [-26, -8], [-34, -5], [-44, -3.6]]);
    g.fill();

    // sidepod inlets + cooling louvres
    g.fillStyle = '#08080a';
    for (const s of [1, -1]) {
      g.beginPath();
      g.moveTo(5, 8 * s); g.lineTo(9, 8 * s); g.lineTo(6, 12.4 * s); g.lineTo(3, 12.4 * s);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.45)';
    g.lineWidth = 0.6;
    for (let x = -8; x > -20; x -= 2.4) {
      g.beginPath();
      g.moveTo(x, 6); g.lineTo(x - 1.2, 10.5);
      g.moveTo(x, -6); g.lineTo(x - 1.2, -10.5);
      g.stroke();
    }

    // livery: white pinstripes + yellow accent
    g.strokeStyle = '#ffffff';
    g.lineWidth = 0.9;
    for (const s of [1, -1]) {
      g.beginPath();
      g.moveTo(44, 1.9 * s);
      g.lineTo(26, 3.4 * s);
      g.lineTo(-4, 9.5 * s);
      g.lineTo(-24, 6.6 * s);
      g.stroke();
    }
    g.fillStyle = '#ffd400';
    g.fillRect(-36, -1, 10, 2);

    // engine cover spine + shark fin
    g.fillStyle = '#16161b';
    g.beginPath();
    g.moveTo(-6, -1.4); g.lineTo(-42, -0.9); g.lineTo(-42, 0.9); g.lineTo(-6, 1.4);
    g.closePath();
    g.fill();

    // number on the nose
    g.save();
    g.fillStyle = '#ffffff';
    g.font = 'italic 900 6px Orbitron, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.translate(31, 0);
    g.rotate(Math.PI / 2);
    g.fillText('21', 0, 0.3);
    g.restore();

    // cockpit, helmet, halo, mirrors
    g.fillStyle = '#060608';
    g.beginPath();
    g.ellipse(5, 0, 7.5, 4.6, 0, 0, Math.PI * 2);
    g.fill();
    const helm = g.createRadialGradient(3.4, -1.2, 0.3, 4, 0, 3.8);
    helm.addColorStop(0, '#fff6a8');
    helm.addColorStop(0.5, '#ffd400');
    helm.addColorStop(1, '#a37b00');
    g.fillStyle = helm;
    g.beginPath();
    g.arc(4, 0, 3.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#111';
    g.beginPath();
    g.ellipse(6.2, 0, 1.1, 2.4, 0, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1c1c22';
    g.lineWidth = 2;
    g.beginPath();
    g.ellipse(4.5, 0, 8.4, 6.1, 0, -Math.PI * 0.62, Math.PI * 0.62);
    g.stroke();
    g.beginPath();
    g.moveTo(12.6, 0); g.lineTo(17, 0);
    g.stroke();
    g.fillStyle = '#16161b';
    g.fillRect(12, 8.2, 3.6, 2.4);
    g.fillRect(12, -10.6, 3.6, 2.4);

    // gloss highlight
    const gloss = g.createLinearGradient(0, -14, 0, 2);
    gloss.addColorStop(0, 'rgba(255,255,255,0.32)');
    gloss.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gloss;
    sym([[50, -1.4], [40, -2.8], [28, -4.4], [17, -5.6], [9, -7.6], [5, -12.6], [-6, -14], [-17, -12.6], [-26, -8], [-34, -5], [-44, -3.6]]);
    g.globalCompositeOperation = 'source-atop';
    g.fillRect(-50, -15, 100, 15);
    g.globalCompositeOperation = 'source-over';

    this.carSprite = c;
  }

  private draw(now: number): void {
    const { ctx, w, h, dpr, cam } = this;
    const z = cam.zoom;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#08100b';
    ctx.fillRect(0, 0, w, h);

    ctx.setTransform(dpr * z, 0, 0, dpr * z, dpr * (w / 2 - cam.x * z), dpr * (h / 2 - cam.y * z));
    ctx.imageSmoothingQuality = 'high';

    // static world: copy only the visible part
    if (this.world) {
      const S = this.worldScale;
      const vx = Math.max(0, cam.x - w / 2 / z - 20);
      const vy = Math.max(0, cam.y - h / 2 / z - 20);
      const vw = Math.min(WORLD.w - vx, w / z + 40);
      const vh = Math.min(WORLD.h - vy, h / z + 40);
      if (vw > 0 && vh > 0) ctx.drawImage(this.world, vx * S, vy * S, vw * S, vh * S, vx, vy, vw, vh);
    }

    // skid marks
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    for (const s of this.skids) ctx.fillRect(s.x - 3, s.y - 3, 6, 6);

    this.drawStartLine();
    this.drawDrs(now);
    this.drawGates(now);

    // crowd (flickering phone lights)
    for (const p of this.crowd) {
      ctx.fillStyle = p.c;
      ctx.globalAlpha = 0.45 + 0.55 * Math.abs(Math.sin(now / 260 + p.x * 0.7));
      ctx.fillRect(p.x - 4, p.y - 4, 8, 8);
    }
    ctx.globalAlpha = 1;

    // particles: smoke is soft and grows, sparks glow
    for (const p of this.particles) {
      if (p.color.startsWith('rgba')) {
        ctx.globalAlpha = Math.max(0, p.life) * 0.5;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * (2.4 - p.life * 1.4), 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = Math.max(0, p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * 0.6, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
    }
    ctx.globalAlpha = 1;

    this.drawCar(now);

    // screen-space: vignette + minimap
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (this.vignette) {
      ctx.fillStyle = this.vignette;
      ctx.fillRect(0, 0, w, h);
    }
    this.drawMinimap();
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
        ctx.save();
        ctx.translate(p.x + n.x * off + t.x * r * sq, p.y + n.y * off + t.y * r * sq);
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
      ctx.shadowColor = '#00d2ff';
      ctx.shadowBlur = 16;
      for (let k = 0; k < 3; k++) {
        ctx.globalAlpha = 0.3 + 0.7 * Math.max(0, Math.sin(now / 140 - k));
        ctx.strokeStyle = '#00d2ff';
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
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
      // light curtain across the track
      if (!doneNow[i]) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = 0.12 + pulse * 0.12;
        ctx.strokeStyle = col;
        ctx.lineWidth = 46;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
      }
      ctx.globalAlpha = doneNow[i] ? 0.55 : 1;
      ctx.shadowColor = col;
      ctx.shadowBlur = 24 + pulse * 30;
      ctx.strokeStyle = col;
      ctx.lineWidth = 5;
      ctx.setLineDash([16, 10]);
      ctx.lineDashOffset = -now / 25;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      for (const q of [a, b]) {
        ctx.fillStyle = '#0b0b0f';
        ctx.beginPath();
        ctx.arc(q.x, q.y, 17 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.arc(q.x, q.y, 11 + pulse * 3, 0, Math.PI * 2);
        ctx.fill();
      }
      if (!doneNow[i]) {
        ctx.globalAlpha = 0.35 * (1 - pulse);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, HALF + 20 + pulse * 50, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // label board
      ctx.save();
      ctx.font = '900 28px Orbitron, sans-serif';
      ctx.textAlign = 'center';
      const lx = p.x + n.x * (HALF + 76);
      const ly = p.y + n.y * (HALF + 76);
      const label = doneNow[i] ? `${g.code}  CLEARED` : `${g.code} · ${g.title.toUpperCase()}`;
      const tw = ctx.measureText(label).width + 34;
      ctx.fillStyle = 'rgba(8,8,12,0.88)';
      ctx.beginPath();
      ctx.roundRect(lx - tw / 2, ly - 32, tw, 48, 8);
      ctx.fill();
      ctx.fillStyle = col;
      ctx.fillRect(lx - tw / 2, ly + 12, tw, 4);
      ctx.shadowColor = col;
      ctx.shadowBlur = 12;
      ctx.fillText(label, lx, ly + 2);
      ctx.restore();
    });
  }

  private drawCar(now: number): void {
    const { ctx, car } = this;
    const K = GameComponent.CAR_K;
    const W = GameComponent.CAR_W * K;
    const H = GameComponent.CAR_H * K;
    const speed = Math.abs(car.v);
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.a);

    // speed trails off the rear wing tips
    if (speed > 8) {
      const len = (speed - 8) * 9;
      ctx.globalCompositeOperation = 'lighter';
      for (const s of [-1, 1]) {
        const tr = ctx.createLinearGradient(-W / 2, 0, -W / 2 - len, 0);
        tr.addColorStop(0, this.boostT > 0 ? 'rgba(0,210,255,0.55)' : 'rgba(255,255,255,0.35)');
        tr.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.strokeStyle = tr;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-W / 2 + 4, s * 20 * K);
        ctx.lineTo(-W / 2 - len, s * 20 * K);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    if (this.carSprite) {
      ctx.shadowColor = 'rgba(0,0,0,0.7)';
      ctx.shadowBlur = 14;
      ctx.shadowOffsetX = 6;
      ctx.shadowOffsetY = 9;
      ctx.drawImage(this.carSprite, -W / 2, -H / 2, W, H);
      ctx.shadowColor = 'transparent';
    }

    // flashing rain light
    if (Math.floor(now / 160) % 2 === 0) {
      ctx.globalCompositeOperation = 'lighter';
      const rl = ctx.createRadialGradient(-W / 2 + 2, 0, 0, -W / 2 + 2, 0, 18);
      rl.addColorStop(0, 'rgba(255,40,30,0.95)');
      rl.addColorStop(1, 'rgba(255,40,30,0)');
      ctx.fillStyle = rl;
      ctx.fillRect(-W / 2 - 18, -18, 36, 36);
      ctx.globalCompositeOperation = 'source-over';
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
