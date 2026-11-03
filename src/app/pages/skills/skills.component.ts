import { Component, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SKILLS, Skill } from '../../data/profile.data';

@Component({
  selector: 'app-skills',
  standalone: true,
  imports: [RouterLink],
  template: `
    <section class="page container">
      <div class="page-head">
        <span class="kicker">SKILLS GARAGE</span>
        <h1>The <span>car</span> I bring to every race</h1>
        <p>Each part of the stack, tuned on real production work. Tap a part to see the setup.</p>
      </div>

      <div class="filters" role="tablist" aria-label="Filter skills">
        @for (f of filters; track f.key) {
          <button type="button" role="tab" [attr.aria-selected]="filter() === f.key"
                  [class.on]="filter() === f.key" (click)="filter.set(f.key)">{{ f.label }}</button>
        }
      </div>

      <div class="grid">
        @for (s of visible(); track s.name) {
          <button type="button" class="card" [class.sel]="selected()?.name === s.name" (click)="select(s)">
            <div class="top">
              <span class="part">{{ s.part }}</span>
              <span class="icon" aria-hidden="true">{{ s.icon }}</span>
            </div>
            <svg class="gauge" viewBox="0 0 120 70" aria-hidden="true">
              <path d="M10 62 A50 50 0 0 1 110 62" class="track" />
              <path d="M10 62 A50 50 0 0 1 110 62" class="fill"
                    [style.stroke-dasharray]="157" [style.stroke-dashoffset]="157 - (157 * (ready() ? s.level : 0)) / 100" />
            </svg>
            <div class="rpm">{{ ready() ? s.level : 0 }}<small>%</small></div>
            <h3>{{ s.name }}</h3>
          </button>
        }
      </div>

      @if (selected(); as s) {
        <div class="setup" aria-live="polite">
          <div class="setup-head">
            <span class="icon">{{ s.icon }}</span>
            <div>
              <div class="part">{{ s.part }} setup</div>
              <h2>{{ s.name }}</h2>
            </div>
          </div>
          <p>{{ s.detail }}</p>
          <div class="tags">@for (t of s.tags; track t) { <span class="chip">{{ t }}</span> }</div>
        </div>
      }

      <div class="next-lap"><a class="btn btn-red" routerLink="/pit-stop">Next lap: Projects Pit Stop →</a></div>
    </section>
  `,
  styleUrl: './skills.component.scss',
})
export class SkillsComponent implements OnInit, OnDestroy {
  readonly filters = [
    { key: 'all', label: 'All parts' },
    { key: 'front', label: 'Front end' },
    { key: 'back', label: 'Back end' },
    { key: 'tools', label: 'Tools' },
  ] as const;

  private readonly groups: Record<string, string[]> = {
    front: ['Angular', 'TypeScript & RxJS', 'HTML, SCSS & Bootstrap'],
    back: ['Java & Spring Boot', 'MySQL & MongoDB', 'Payment Gateways'],
    tools: ['Testing & Tools', 'AI-assisted Dev'],
  };

  readonly filter = signal<string>('all');
  readonly selected = signal<Skill | null>(SKILLS[0]);
  readonly ready = signal(false);
  readonly visible = computed(() => {
    const f = this.filter();
    return f === 'all' ? SKILLS : SKILLS.filter((s) => this.groups[f]?.includes(s.name));
  });

  private timer?: ReturnType<typeof setTimeout>;

  ngOnInit(): void {
    this.timer = setTimeout(() => this.ready.set(true), 150);
  }

  ngOnDestroy(): void {
    clearTimeout(this.timer);
  }

  select(s: Skill): void {
    this.selected.set(s);
  }
}
