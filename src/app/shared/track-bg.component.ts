import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, ViewChild, inject } from '@angular/core';

interface Streak {
  x: number;
  y: number;
  z: number;
  pz: number;
  red: boolean;
}

/**
 * Full-screen "warp speed" background drawn on a canvas.
 * Runs outside Angular's zone so it never triggers change detection.
 * Scrolling the page pushes the speed up, like hitting DRS.
 */
@Component({
  selector: 'app-track-bg',
  standalone: true,
  template: `<canvas #canvas aria-hidden="true"></canvas>`,
  styles: [`
    :host { position: fixed; inset: 0; z-index: 0; pointer-events: none; }
    canvas { width: 100%; height: 100%; display: block; opacity: .6; }
  `],
})
export class TrackBgComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas', { static: true }) private canvasRef!: ElementRef<HTMLCanvasElement>;
  private readonly zone = inject(NgZone);

  private ctx!: CanvasRenderingContext2D;
  private streaks: Streak[] = [];
  private w = 0;
  private h = 0;
  private raf = 0;
  private boost = 0;
  private lastScroll = 0;
  private readonly onResize = () => this.resize();
  private readonly onScroll = () => {
    const y = window.scrollY;
    this.boost = Math.min(30, this.boost + Math.abs(y - this.lastScroll) * 0.25);
    this.lastScroll = y;
  };

  ngAfterViewInit(): void {
    const ctx = this.canvasRef.nativeElement.getContext('2d');
    if (!ctx) return;
    this.ctx = ctx;
    this.resize();

    const count = window.innerWidth < 700 ? 70 : 160;
    for (let i = 0; i < count; i++) this.streaks.push(this.spawn(true));

    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.frame(0.2);
      return;
    }

    this.zone.runOutsideAngular(() => {
      window.addEventListener('resize', this.onResize);
      window.addEventListener('scroll', this.onScroll, { passive: true });
      const loop = () => {
        if (!document.hidden && !document.body.classList.contains('game-on')) this.frame(6 + this.boost);
        this.boost *= 0.93;
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    });
  }

  ngOnDestroy(): void {
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('scroll', this.onScroll);
  }

  private resize(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
    const c = this.canvasRef.nativeElement;
    this.w = window.innerWidth;
    this.h = window.innerHeight;
    c.width = this.w * dpr;
    c.height = this.h * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  private spawn(randomDepth = false): Streak {
    const z = randomDepth ? Math.random() * this.w : this.w;
    return {
      x: (Math.random() - 0.5) * this.w * 1.6,
      y: (Math.random() - 0.5) * this.h * 1.6,
      z,
      pz: z,
      red: Math.random() < 0.28,
    };
  }

  private frame(speed: number): void {
    const { ctx, w, h } = this;
    const cx = w / 2;
    const cy = h * 0.42;
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < this.streaks.length; i++) {
      const s = this.streaks[i];
      s.pz = s.z;
      s.z -= speed;
      if (s.z < 1) {
        this.streaks[i] = this.spawn();
        continue;
      }
      const f = w * 0.5;
      const x = cx + (s.x / s.z) * f;
      const y = cy + (s.y / s.z) * f;
      const px = cx + (s.x / s.pz) * f;
      const py = cy + (s.y / s.pz) * f;
      if (x < -50 || x > w + 50 || y < -50 || y > h + 50) {
        this.streaks[i] = this.spawn();
        continue;
      }
      const depth = 1 - s.z / w;
      ctx.strokeStyle = s.red ? `rgba(255,42,31,${0.25 + depth * 0.6})` : `rgba(255,255,255,${0.08 + depth * 0.45})`;
      ctx.lineWidth = 0.4 + depth * 2.2;
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(x, y);
      ctx.stroke();
    }
  }
}
