import { Component, HostListener, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PROJECTS, Project } from '../../data/profile.data';
import { IconComponent } from '../../shared/icon.component';


@Component({
  selector: 'app-projects',
  standalone: true,
  imports: [RouterLink, IconComponent],
  template: `
    <section class="page container">
      <div class="page-head">
        <span class="kicker">PROJECTS PIT STOP</span>
        <h1>Builds that made it to <span>production</span></h1>
        <p>Work projects are described at a high level (the code is private). Open a car for the full pit-stop report.</p>
      </div>

      <div class="grid">
        @for (p of projects; track p.id; let i = $index) {
          <button type="button" class="card" (click)="open(p)" [style.animation-delay.ms]="i * 80">
            <div class="banner" [style.background]="p.gradient">
              <span class="pos">P{{ i + 1 }}</span>
              <span class="emoji"><app-icon [name]="p.icon" [size]="54" [stroke]="1.5" /></span>
            </div>
            <div class="body">
              <div class="team">{{ p.team }}</div>
              <h3>{{ p.title }}</h3>
              <p>{{ p.summary }}</p>
              <div class="stack">@for (s of p.stack; track s) { <span class="chip">{{ s }}</span> }</div>
              <span class="more">Pit-stop report →</span>
            </div>
          </button>
        }
      </div>

      <div class="next-lap"><a class="btn btn-red" routerLink="/finish-line">Final lap: Contact →</a></div>
    </section>

    @if (active(); as p) {
      <div class="overlay" (click)="close()">
        <div class="modal" role="dialog" aria-modal="true" [attr.aria-label]="p.title" (click)="$event.stopPropagation()">
          <div class="m-banner" [style.background]="p.gradient">
            <span class="emoji"><app-icon [name]="p.icon" [size]="64" [stroke]="1.5" /></span>
            <button type="button" class="x" aria-label="Close" (click)="close()"><app-icon name="close" [size]="18" /></button>
          </div>
          <div class="m-body">
            <div class="team">{{ p.team }}</div>
            <h2>{{ p.title }}</h2>
            <div class="sector"><span class="s1">S1</span><div><b>Problem</b><p>{{ p.problem }}</p></div></div>
            <div class="sector"><span class="s2">S2</span><div><b>What I built</b>
              <ul>@for (b of p.built; track b) { <li>{{ b }}</li> }</ul></div></div>
            <div class="sector"><span class="s3">S3</span><div><b>Result</b><p>{{ p.result }}</p></div></div>
            <div class="stack">@for (s of p.stack; track s) { <span class="chip">{{ s }}</span> }</div>
            @if (p.link) {
              <a class="btn btn-red code" [href]="p.link" target="_blank" rel="noopener">View code on GitHub</a>
            }
          </div>
        </div>
      </div>
    }
  `,
  styleUrl: './projects.component.scss',
})
export class ProjectsComponent {
  readonly projects = PROJECTS;
  readonly active = signal<Project | null>(null);

  open(p: Project): void {
    this.active.set(p);
    document.body.style.overflow = 'hidden';
  }

  @HostListener('document:keydown.escape')
  close(): void {
    this.active.set(null);
    document.body.style.overflow = '';
  }
}
