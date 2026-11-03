import { Directive, ElementRef, OnDestroy, OnInit, inject, input } from '@angular/core';

/**
 * Reveals an element when it scrolls into view.
 * Usage: <div appReveal="left" [revealDelay]="120">
 * Variants: up (default), left, right, zoom.
 */
@Directive({
  selector: '[appReveal]',
  standalone: true,
  host: { class: 'reveal-el' },
})
export class RevealDirective implements OnInit, OnDestroy {
  readonly appReveal = input<string>('');
  readonly revealDelay = input(0);

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private observer?: IntersectionObserver;

  ngOnInit(): void {
    const el = this.host.nativeElement;
    el.dataset['reveal'] = this.appReveal() || 'up';
    el.style.setProperty('--rd', `${this.revealDelay()}ms`);

    if (typeof IntersectionObserver === 'undefined') {
      el.classList.add('in');
      return;
    }
    this.observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add('in');
            this.observer?.disconnect();
          }
        }
      },
      { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
    );
    this.observer.observe(el);
  }

  ngOnDestroy(): void {
    this.observer?.disconnect();
  }
}
