import { Component, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { PROFILE } from '../../data/profile.data';

@Component({
  selector: 'app-contact',
  standalone: true,
  imports: [ReactiveFormsModule],
  template: `
    <section class="page container">
      <div class="page-head">
        <span class="kicker">FINISH LINE</span>
        <h1>Team radio: <span>let's talk</span></h1>
        <p>Hiring for a Full Stack or Angular + Java role? Send a message and I'll reply within a day.</p>
      </div>

      <div class="layout">
        <form class="radio" [formGroup]="form" (ngSubmit)="send()" novalidate>
          <div class="radio-head"><span class="rec"></span> TEAM RADIO · CHANNEL 21</div>

          <label for="name">Your name</label>
          <input id="name" formControlName="name" autocomplete="name" placeholder="e.g. Priya, Talent Partner">
          @if (showError('name')) { <small>Please enter your name.</small> }

          <label for="email">Your email</label>
          <input id="email" type="email" formControlName="email" autocomplete="email" placeholder="you@company.com">
          @if (showError('email')) { <small>Please enter a valid email.</small> }

          <label for="msg">Message</label>
          <textarea id="msg" rows="5" formControlName="message" placeholder="Role, team and location..."></textarea>
          @if (showError('message')) { <small>A few words (at least 10 characters), please.</small> }

          <button class="btn btn-red send" type="submit">Box, box: send message</button>
          @if (sent()) {
            <p class="ok">Your email app is opening with the message ready. Copy received!</p>
          }
        </form>

        <div class="side">
          <a class="chan" [href]="'mailto:' + profile.email">
            <span class="ic">📧</span><span><b>Email</b>{{ profile.email }}</span>
          </a>
          <a class="chan" [href]="profile.linkedin" target="_blank" rel="noopener">
            <span class="ic">🤝</span><span><b>LinkedIn</b>Dammu Jagadeesh</span>
          </a>
          <a class="chan" [href]="profile.github" target="_blank" rel="noopener">
            <span class="ic">💻</span><span><b>GitHub</b>github.com/jagadeeshdammu</span>
          </a>

          <div class="board">
            <div class="row"><span>Status</span><b class="green">● Open to offers</b></div>
            <div class="row"><span>Notice period</span><b>30 days</b></div>
            <div class="row"><span>Base</span><b>{{ profile.location }}</b></div>
            <div class="row"><span>Reply time</span><b>&lt; 24 hours</b></div>
          </div>
        </div>
      </div>
    </section>
  `,
  styleUrl: './contact.component.scss',
})
export class ContactComponent {
  readonly profile = PROFILE;
  readonly sent = signal(false);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    message: ['', [Validators.required, Validators.minLength(10)]],
  });

  showError(field: 'name' | 'email' | 'message'): boolean {
    const c = this.form.controls[field];
    return c.invalid && (c.touched || c.dirty);
  }

  send(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const { name, email, message } = this.form.getRawValue();
    const subject = encodeURIComponent(`Portfolio enquiry from ${name}`);
    const body = encodeURIComponent(`${message}\n\n- ${name} (${email})`);
    window.location.href = `mailto:${this.profile.email}?subject=${subject}&body=${body}`;
    this.sent.set(true);
  }
}
