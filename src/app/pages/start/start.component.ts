import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { LAPS, PROFILE, STATS } from '../../data/profile.data';

@Component({
  selector: 'app-start',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="hero">
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
          <p class="kicker">#{{ carNumber }} · {{ profile.location }}</p>
          <h1>{{ firstName }} <span>{{ lastName }}</span></h1>
          <p class="role">{{ profile.role }} <b>·</b> {{ profile.tagline }}</p>
          <p class="intro">{{ profile.intro }}</p>
          <div class="cta">
            <a class="btn btn-red" routerLink="/pit-stop">View projects</a>
            <a class="btn btn-ghost" routerLink="/finish-line">Contact me</a>
          </div>
        </div>
      </div>
      <div class="speed-lines" aria-hidden="true">
        @for (l of [1, 2, 3, 4, 5, 6]; track l) { <i [style.--d]="l"></i> }
      </div>
    </section>

    <section class="container stats">
      @for (s of stats; track s.label; let i = $index) {
        <div class="stat">
          <div class="val">{{ shown()[i] }}{{ s.suffix }}</div>
          <div class="lbl">{{ s.label }}</div>
        </div>
      }
    </section>

    <section class="container history">
      <div class="page-head">
        <span class="kicker">RACE HISTORY</span>
        <h1>Intern to <span>SDE III</span> in 3.5 years</h1>
        <p>Every lap at Knowvo: what I took on and what I shipped.</p>
      </div>
      <ol class="laps">
        @for (lap of laps; track lap.lap; let first = $first) {
          <li class="lap" [class.current]="first">
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
      <div class="open-to">
        <span class="dot"></span> Open to: {{ profile.openTo }}
      </div>
      <div class="next-lap"><a class="btn btn-red" routerLink="/garage">Next lap: Skills Garage →</a></div>
    </section>
  `,
  styleUrl: './start.component.scss',
})
export class StartComponent implements OnInit, OnDestroy {
  readonly profile = PROFILE;
  readonly laps = LAPS;
  readonly stats = STATS;
  readonly carNumber = 21;
  readonly firstName = PROFILE.name.split(' ')[0];
  readonly lastName = PROFILE.name.split(' ').slice(1).join(' ');

  readonly litCount = signal(0);
  readonly lightsOut = signal(false);
  readonly shown = signal<string[]>(STATS.map(() => '0'));
  readonly statusText = computed(() =>
    this.lightsOut() ? 'LIGHTS OUT AND AWAY WE GO' : this.litCount() === 0 ? 'FORMATION LAP' : 'START SEQUENCE',
  );

  private timers: ReturnType<typeof setTimeout>[] = [];
  private raf = 0;

  ngOnInit(): void {
    const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      this.litCount.set(5);
      this.lightsOut.set(true);
      this.shown.set(STATS.map((s) => this.format(s.value)));
      return;
    }
    for (let i = 1; i <= 5; i++) {
      this.timers.push(setTimeout(() => this.litCount.set(i), 250 + i * 420));
    }
    this.timers.push(setTimeout(() => { this.lightsOut.set(true); this.countUp(); }, 250 + 5 * 420 + 650));
  }

  ngOnDestroy(): void {
    this.timers.forEach(clearTimeout);
    cancelAnimationFrame(this.raf);
  }

  private countUp(): void {
    const start = performance.now();
    const duration = 1400;
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
