import { Component, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { PROFILE } from './data/profile.data';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  template: `
    <header class="nav" [class.open]="menuOpen()">
      <div class="container nav-inner">
        <a routerLink="/" class="brand" (click)="menuOpen.set(false)">
          <span class="num">DJ</span><span class="brand-text">Racing</span>
        </a>

        <button class="burger" type="button" aria-label="Toggle menu" [attr.aria-expanded]="menuOpen()"
                (click)="toggleMenu()">
          <span></span><span></span><span></span>
        </button>

        <nav class="links" aria-label="Main">
          @for (l of links; track l.path) {
            <a [routerLink]="l.path" routerLinkActive="active" [routerLinkActiveOptions]="{ exact: true }"
               (click)="menuOpen.set(false)">
              <span class="tag">{{ l.tag }}</span>{{ l.label }}
            </a>
          }
          <a class="cv" [href]="profile.linkedin" target="_blank" rel="noopener">Hire me</a>
        </nav>
      </div>
    </header>

    <main><router-outlet /></main>

    <footer>
      <div class="checkered"></div>
      <div class="container foot">
        <span>© {{ year }} {{ profile.name }} · Built with Angular, standalone components &amp; signals</span>
        <span class="foot-links">
          <a [href]="profile.github" target="_blank" rel="noopener">GitHub</a>
          <a [href]="profile.linkedin" target="_blank" rel="noopener">LinkedIn</a>
          <a [href]="'mailto:' + profile.email">Email</a>
        </span>
      </div>
    </footer>
  `,
  styles: [`
    .nav { position: fixed; inset: 0 0 auto 0; z-index: 50; backdrop-filter: blur(12px);
      background: rgba(11,11,15,0.78); border-bottom: 1px solid var(--line); }
    .nav-inner { display: flex; align-items: center; justify-content: space-between; height: 68px; }
    .brand { display: flex; align-items: center; gap: 10px; text-decoration: none; }
    .num { font-family: var(--display); font-weight: 900; font-size: 18px; background: var(--red); color: #fff;
      padding: 4px 10px; border-radius: 6px; transform: skewX(-12deg); display: inline-block; }
    .brand-text { font-family: var(--display); font-weight: 700; letter-spacing: .15em; font-size: 14px; }
    .links { display: flex; align-items: center; gap: 6px; }
    .links a { text-decoration: none; padding: 10px 14px; border-radius: 8px; font-weight: 600; color: var(--muted);
      transition: color .2s, background .2s; display: flex; align-items: center; gap: 8px; }
    .links a:hover { color: var(--text); background: rgba(255,255,255,0.04); }
    .links a.active { color: var(--text); box-shadow: inset 0 -2px 0 var(--red); }
    .tag { font-family: var(--display); font-size: 10px; color: var(--red-2); }
    .links .cv { color: #fff; background: var(--red); margin-left: 8px; }
    .links .cv:hover { background: var(--red-2); color: #fff; }
    .burger { display: none; background: none; border: 0; cursor: pointer; padding: 8px; }
    .burger span { display: block; width: 24px; height: 2px; background: var(--text); margin: 5px 0; transition: .25s; }
    footer { position: relative; z-index: 1; background: var(--bg-2); }
    .foot { display: flex; flex-wrap: wrap; gap: 12px; justify-content: space-between; padding: 22px 0;
      color: var(--muted); font-size: 15px; }
    .foot-links { display: flex; gap: 18px; }
    .foot-links a { text-decoration: none; }
    .foot-links a:hover { color: var(--red-2); }

    @media (max-width: 820px) {
      .burger { display: block; }
      .links { position: fixed; top: 68px; left: 0; right: 0; flex-direction: column; align-items: stretch;
        background: var(--bg-2); border-bottom: 1px solid var(--line); padding: 12px 16px 20px;
        transform: translateY(-120%); transition: transform .3s ease; }
      .nav.open .links { transform: translateY(0); }
      .nav.open .burger span:nth-child(1) { transform: translateY(7px) rotate(45deg); }
      .nav.open .burger span:nth-child(2) { opacity: 0; }
      .nav.open .burger span:nth-child(3) { transform: translateY(-7px) rotate(-45deg); }
      .links .cv { margin: 8px 0 0; justify-content: center; }
    }
  `],
})
export class AppComponent {
  readonly profile = PROFILE;
  readonly year = new Date().getFullYear();
  readonly menuOpen = signal(false);

  toggleMenu(): void {
    this.menuOpen.update((v) => !v);
  }
  readonly links = [
    { path: '/', tag: '01', label: 'Start' },
    { path: '/garage', tag: '02', label: 'Skills' },
    { path: '/pit-stop', tag: '03', label: 'Projects' },
    { path: '/finish-line', tag: '04', label: 'Contact' },
  ];
}
