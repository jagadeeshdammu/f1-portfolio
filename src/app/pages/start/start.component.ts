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
        <svg viewBox="0 0 640 170">
          <defs>
            <linearGradient id="cb" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#ff4a3d" />
              <stop offset=".45" stop-color="#e10600" />
              <stop offset="1" stop-color="#6e0000" />
            </linearGradient>
            <linearGradient id="cf" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0" stop-color="#0c0c10" />
              <stop offset="1" stop-color="#26262e" />
            </linearGradient>
            <linearGradient id="gl" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="#fff" stop-opacity=".55" />
              <stop offset="1" stop-color="#fff" stop-opacity="0" />
            </linearGradient>
            <radialGradient id="hl" cx=".35" cy=".35" r=".7">
              <stop offset="0" stop-color="#fff7b0" />
              <stop offset=".5" stop-color="#ffd400" />
              <stop offset="1" stop-color="#8f6a00" />
            </radialGradient>
            <radialGradient id="rim" cx=".5" cy=".5" r=".5">
              <stop offset="0" stop-color="#3a3a44" />
              <stop offset=".7" stop-color="#15151b" />
              <stop offset="1" stop-color="#050507" />
            </radialGradient>
          </defs>
          <ellipse cx="320" cy="156" rx="300" ry="9" fill="rgba(0,0,0,.65)" />
          <!-- floor / plank -->
          <path d="M70 132 L560 132 L585 126 L80 124 Z" fill="#0d0d12" />
          <!-- rear wing: endplate, mainplane, DRS flap, beam wing -->
          <path d="M28 26 L62 26 L70 112 L40 112 Z" fill="url(#cf)" />
          <path d="M22 30 Q60 22 104 30 L104 40 Q60 33 22 41 Z" fill="url(#cb)" />
          <path d="M26 45 Q62 38 100 45 L100 52 Q62 46 26 53 Z" fill="#111" />
          <path d="M50 96 L104 92 L104 99 L50 103 Z" fill="#1a1a20" />
          <text x="38" y="38" font-family="Orbitron, sans-serif" font-weight="900" font-size="8" fill="#fff" opacity=".9">DJ</text>
          <!-- engine cover with fin and airbox -->
          <path d="M80 104 L96 62 Q180 48 262 40 L282 40 L290 58 L300 66 L250 108 Z" fill="url(#cb)" />
          <path d="M96 62 Q170 52 248 44 L252 54 Q175 60 104 74 Z" fill="#14141a" opacity=".85" />
          <path d="M248 34 Q266 30 282 40 L262 46 Z" fill="#111" />
          <!-- sidepod with undercut + louvres -->
          <path d="M150 112 Q160 74 220 72 L330 74 Q350 78 352 94 L345 116 L170 118 Z" fill="url(#cb)" />
          <path d="M180 108 Q200 96 330 98 L340 112 L180 116 Z" fill="#7a0000" opacity=".7" />
          <path d="M322 76 L350 80 L352 94 L330 92 Z" fill="#08080b" />
          <g stroke="rgba(0,0,0,.45)" stroke-width="2">
            <path d="M200 80 L196 92" /><path d="M212 79 L208 91" /><path d="M224 78 L220 90" /><path d="M236 78 L232 90" />
          </g>
          <!-- monocoque + nose -->
          <path d="M280 68 Q330 62 380 74 L520 98 Q570 106 600 112 L600 118 L520 118 L300 116 Z" fill="url(#cb)" />
          <!-- livery stripes -->
          <path d="M120 86 Q240 70 360 78 L600 114" stroke="#fff" stroke-width="3" fill="none" />
          <path d="M140 94 Q250 84 360 88 L560 114" stroke="#ffd400" stroke-width="1.6" fill="none" opacity=".9" />
          <text x="400" y="100" font-family="Orbitron, sans-serif" font-weight="900" font-size="22" font-style="italic" fill="#fff">21</text>
          <!-- cockpit, helmet, halo -->
          <path d="M282 66 L344 66 L338 74 L286 74 Z" fill="#050507" />
          <circle cx="308" cy="60" r="14" fill="url(#hl)" />
          <path d="M310 54 Q322 55 322 63 L310 64 Z" fill="#101014" />
          <path d="M268 64 Q300 34 350 60 L356 74 L350 74 Q302 48 276 70 Z" fill="#1b1b22" />
          <path d="M336 52 L346 50 L348 56 L338 58 Z" fill="#16161c" />
          <!-- front wing: three elements + endplate -->
          <path d="M488 122 Q550 114 628 118 L628 124 L486 128 Z" fill="url(#cb)" />
          <path d="M500 114 Q560 106 624 110 L624 115 L500 120 Z" fill="#111" />
          <path d="M512 106 Q566 100 620 103 L620 107 L512 112 Z" fill="#ff3b30" />
          <path d="M612 92 L632 92 L634 130 L612 130 Z" fill="url(#cf)" />
          <!-- gloss -->
          <path d="M100 62 Q200 46 280 44 L300 62 Q380 66 520 92 L520 96 Q380 72 300 70 Q200 60 110 72 Z" fill="url(#gl)" opacity=".5" />
          <!-- wheels: 18-inch with aero covers -->
          <g class="wheel" style="transform-origin: 140px 118px">
            <circle cx="140" cy="118" r="40" fill="#0a0a0c" />
            <circle cx="140" cy="118" r="38" fill="none" stroke="#ffd400" stroke-width="2.5" />
            <circle cx="140" cy="118" r="27" fill="url(#rim)" />
            <circle cx="140" cy="118" r="27" fill="none" stroke="#e10600" stroke-width="2" />
            <path d="M140 94 V142 M116 118 H164 M123 101 L157 135 M157 101 L123 135" stroke="#2b2b33" stroke-width="3" />
            <circle cx="140" cy="118" r="6" fill="#e10600" />
          </g>
          <g class="wheel" style="transform-origin: 480px 120px">
            <circle cx="480" cy="120" r="36" fill="#0a0a0c" />
            <circle cx="480" cy="120" r="34" fill="none" stroke="#ffd400" stroke-width="2.5" />
            <circle cx="480" cy="120" r="24" fill="url(#rim)" />
            <circle cx="480" cy="120" r="24" fill="none" stroke="#e10600" stroke-width="2" />
            <path d="M480 99 V141 M459 120 H501 M465 105 L495 135 M495 105 L465 135" stroke="#2b2b33" stroke-width="3" />
            <circle cx="480" cy="120" r="5.5" fill="#e10600" />
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
