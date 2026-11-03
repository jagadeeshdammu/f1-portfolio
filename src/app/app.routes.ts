import { Routes } from '@angular/router';

// Every page is lazy loaded: each one is its own JS chunk.
export const routes: Routes = [
  {
    path: '',
    title: 'Dammu Jagadeesh · Start Line',
    loadComponent: () => import('./pages/start/start.component').then((m) => m.StartComponent),
  },
  {
    path: 'garage',
    title: 'Skills Garage · Dammu Jagadeesh',
    loadComponent: () => import('./pages/skills/skills.component').then((m) => m.SkillsComponent),
  },
  {
    path: 'pit-stop',
    title: 'Projects Pit Stop · Dammu Jagadeesh',
    loadComponent: () => import('./pages/projects/projects.component').then((m) => m.ProjectsComponent),
  },
  {
    path: 'finish-line',
    title: 'Contact · Dammu Jagadeesh',
    loadComponent: () => import('./pages/contact/contact.component').then((m) => m.ContactComponent),
  },
  { path: '**', redirectTo: '' },
];
