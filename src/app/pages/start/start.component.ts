import { AfterViewInit, Component, ElementRef, NgZone, OnDestroy, OnInit, ViewChild, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAPS, PROFILE, STATS } from '../../data/profile.data';
import { RevealDirective } from '../../shared/reveal.directive';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [RouterLink, RevealDirective],
  template: `
    <section class="hero" #hero [class.go]="lightsOut()">
      <div class="floor" aria-hidden="true">
        <div class="road"><span class="lane"></span><span class="kerb l"></span><span class="kerb r"></span></div>
      </div>
      <div class="glow" aria-hidden="true"></div>

      <div class="container hero-inner">
        <div class="lights" [class.out]="lightsOut()" aria-hidden="true">
          @for (i of [0, 1, 2, 3, 4]; track i) {
            <div class="light-col">
              <span class="bulb" [class.on]="litCount() > i"></span>
              <span class="bulb" [class.on]="litCount() > i"></span>
            </div>
          }
        </div>
        <p class="status" aria-live="polite">{{ statusText() }}</p>

        <div class="reveal" [class.show]="lightsOut()">
          <div class="parallax">
            <p class="kicker">#{{ carNumber }} · {{ profile.location }}</p>
            <h1 [attr.aria-label]="profile.name">
              <span class="word" aria-hidden="true">
                @for (ch of firstChars; track $index) { <span class="ch" [style.--i]="$index">{{ ch }}</span> }
              </span>
              <span class="word red" aria-hidden="true">
                @for (ch of lastChars; track $index) { <span class="ch" [style.--i]="$index + firstChars.length + 1">{{ ch }}</span> }
              </span>
            </h1>
            <p class="role">{{ profile.role }} <b>·</b> {{ profile.tagline }}</p>
            <p class="intro">{{ profile.intro }}</p>
            <div class="cta">
              <a class="btn btn-red" routerLink="/pit-stop">View projects</a>
              <a class="btn btn-ghost" routerLink="/finish-line">Contact me</a>
            </div>
          </div>
        </div>
      </div>

      <div class="car" aria-hidden="true">
        <svg viewBox="0 0 420 110">
          <defs>
            <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ff3b30" />
              <stop offset=".55" stop-color="#e10600" />
              <stop offset="1" stop-color="#7a0000" />
            </linearGradient>
          </defs>
          <ellipse cx="205" cy="100" rx="190" ry="7" fill="rgba(0,0,0,.6)" />
          <!-- rear wing -->
          <rect x="8" y="16" width="44" height="10" rx="2" fill="url(#body)" />
          <rect x="8" y="27" width="44" height="4" fill="#111" />
          <rect x="27" y="30" width="7" height="34" fill="#1a1a1a" />
          <!-- body -->
          <path d="M40 78 L44 58 Q70 40 112 38 L150 36 Q170 22 196 36 L250 44 Q320 56 384 70 L388 80 Z" fill="url(#body)" />
          <path d="M110 60 L240 56 Q300 60 360 72 L110 76 Z" fill="#8a0000" opacity=".55" />
          <path d="M60 66 L380 74" stroke="#fff" stroke-width="2.5" opacity=".9" />
          <!-- halo and helmet -->
          <circle cx="176" cy="36" r="11" fill="#ffd400" />
          <rect x="168" y="31" width="14" height="5" rx="2" fill="#111" />
          <path d="M150 38 Q178 16 214 40" stroke="#222" stroke-width="5" fill="none" stroke-linecap="round" />
          <!-- number -->
          <text x="232" y="62" font-family="Orbitron, sans-serif" font-weight="900" font-size="20" fill="#fff" font-style="italic">21</text>
          <!-- front wing -->
          <path d="M340 82 L414 82 L414 90 L332 90 Z" fill="url(#body)" />
          <rect x="406" y="70" width="8" height="20" fill="#111" />
          <!-- wheels -->
          <g class="wheel" style="transform-origin: 92px 78px">
            <circle cx="92" cy="78" r="24" fill="#0d0d0d" />
            <circle cx="92" cy="78" r="17" fill="none" stroke="#ffd400" stroke-width="2" />
            <path d="M92 64 V92 M78 78 H106" stroke="#444" stroke-width="3" />
            <circle cx="92" cy="78" r="5" fill="#666" />
          </g>
          <g class="wheel" style="transform-origin: 318px 80px">
            <circle cx="318" cy="80" r="21" fill="#0d0d0d" />
            <circle cx="318" cy="80" r="14" fill="none" stroke="#ffd400" stroke-width="2" />
            <path d="M318 68 V92 M306 80 H330" stroke="#444" stroke-width="3" />
            <circle cx="318" cy="80" r="4" fill="#666" />
          </g>
        </svg>
      </div>
    </section>

    <div class="ticker" aria-hidden="true">
      <div class="ticker-track">
        @for (r of [0, 1]; track r) {
          @for (t of ticker; track t) { <span>{{ t }}</span><i>◆</i> }
        }
      </div>
    </div>

    <section class="container stats">
      @for (s of stats; track s.label; let i = $index) {
        <div class="stat" appReveal="zoom" [revealDelay]="i * 120">
          <div class="val">{{ shown()[i] }}{{ s.suffix }}</div>
          <div class="lbl">{{ s.label }}</div>
          <div class="bar"><span [style.--w]="(i + 1) * 25"></span></div>
        </div>
      }
    </section>

    <section class="container history">
      <div class="page-head" appReveal>
        <span class="kicker">RACE HISTORY</span>
        <h1>Intern to <span>SDE III</span> in 3.5 years</h1>
        <p>Every lap at Knowvo: what I took on and what I shipped.</p>
      </div>
      <ol class="laps">
        @for (lap of laps; track lap.lap; let first = $first; let i = $index) {
          <li class="lap" [class.current]="first" [appReveal]="i % 2 ? 'right' : 'left'" [revealDelay]="80">
            <div class="lap-no">{{ lap.lap }}</div>
            <div class="lap-body">
              <div class="lap-top">
                <h3>{{ lap.title }}</h3>
                <span class="period">{{ lap.period }}</span>
              </div>
              <ul>
                @for (p of lap.points; track p) { <li>{{ p }}</li> }
              </ul>
            </div>
          </li>
        }
      </ol>
      <div class="open-to" appReveal>
        <span class="dot"></span> Open to: {{ profile.openTo }}
      </div>
      <div class="next-lap" appReveal="zoom"><a class="btn btn-red" routerLink="/garage">Next lap: Skills Garage →</a></div>
    </section>
  `,
  styleUrl: './start.component.scss',
})
export class StartComponent implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('hero', { static: true }) private heroRef!: ElementRef<HTMLElement>;
  private readonly zone = inject(NgZone);

  readonly profile = PROFILE;
  readonly laps = LAPS;
  readonly stats = STATS;
  readonly carNumber = 21;
  readonly firstChars = [...PROFILE.name.split(' ')[0]];
  readonly lastChars = [...PROFILE.name.split(' ').slice(1).join(' ')];
  readonly ticker = [
    'LIVE TIMING', 'ANGULAR 19', 'SIGNALS', 'STANDALONE', 'RXJS', 'SPRING BOOT', 'REST APIS',
    'PAYMENTS · UPI · EMI', 'MYSQL', 'MONGODB', 'SCHOOL ERP', '750+ COMMITS', 'OPEN TO OFFERS',
  ];

  readonly litCount = signal(0);
  readonly lightsOut = signal(false);
  readonly shown = signal<string[]>(STATS.map(() => '0'));
  readonly statusText = computed(() =>
    this.lightsOut() ? 'LIGHTS OUT AND AWAY WE GO' : this.litCount() === 0 ? 'FORMATION LAP' : 'START SEQUENCE',
  );

  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;
  private readonly onMove = (e: MouseEvent) => {
    const el = this.heroRef.nativeElement;
    el.style.setProperty('--mx', (e.clientX / window.innerWidth - 0.5).toFixed(3));
    el.style.setProperty('--my', (e.clientY / window.innerHeight - 0.5).toFixed(3));
  };

  ngOnInit(): void {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.litCount.set(5);
      this.lightsOut.set(true);
      this.shown.set(STATS.map((s) => this.format(s.value)));
      return;
    }
    for (let i = 1; i <= 5; i++) {
      this.timers.push(setTimeout(() => this.litCount.set(i), 200 + i * 380));
    }
    this.timers.push(setTimeout(() => { this.lightsOut.set(true); this.countUp(); }, 200 + 5 * 380 + 600));
  }

  ngAfterViewInit(): void {
    // Mouse parallax runs outside Angular: it only sets CSS variables.
    this.zone.runOutsideAngular(() => this.heroRef.nativeElement.addEventListener('mousemove', this.onMove));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
    cancelAnimationFrame(this.raf);
    this.heroRef.nativeElement.removeEventListener('mousemove', this.onMove);
  }

  private countUp(): void {
    const start = performance.now();
    const duration = 1800;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      this.shown.set(STATS.map((s) => this.format(s.value * eased, s.value)));
      if (t < 1) this.raf = requestAnimationFrame(tick);
    };
    this.raf = requestAnimationFrame(tick);
  }

  private format(v: number, target = v): string {
    return Number.isInteger(target) ? Math.round(v).toString() : v.toFixed(1);
  }
}
