export interface Skill {
  part: string;
  icon: string;
  name: string;
  detail: string;
  level: number; // 0-100, shown as a telemetry gauge
  tags: string[];
}

export interface Lap {
  lap: string;
  title: string;
  period: string;
  points: string[];
}

export interface Project {
  id: string;
  icon: string;
  title: string;
  team: string;
  summary: string;
  problem: string;
  built: string[];
  result: string;
  stack: string[];
  gradient: string;
  link?: string;
}

export const PROFILE = {
  name: 'Dammu Jagadeesh',
  role: 'Full Stack Developer',
  tagline: 'Angular · Java · Spring Boot',
  intro:
    'SDE III at Knowvo, Bengaluru. I build School ERP and EdTech products end to end: ' +
    'fast Angular front ends, Spring Boot APIs and reliable payment flows.',
  location: 'Bengaluru, India',
  email: 'jagadeeshdammu2002@gmail.com',
  github: 'https://github.com/jagadeeshdammu',
  linkedin: 'https://www.linkedin.com/in/jagadeesh-dammu-254260252/',
  openTo: 'Full Stack · Angular + Java roles · Bengaluru, Hyderabad, Pune, Chennai or remote',
};

export const STATS = [
  { value: 3.9, suffix: ' yrs', label: 'Race experience' },
  { value: 4, suffix: '', label: 'Roles held' },
  { value: 750, suffix: '+', label: 'Commits this season' },
  { value: 10, suffix: '+', label: 'Modules shipped' },
];

export const SKILLS: Skill[] = [
  {
    part: 'Engine', icon: '🏎️', name: 'Angular', level: 92,
    detail: 'Angular 2+ to 21: standalone components, signals, new control flow, lazy routes, SSR/PWA.',
    tags: ['Signals', 'Standalone', '@if / @for', 'Lazy loading'],
  },
  {
    part: 'Gearbox', icon: '⚙️', name: 'TypeScript & RxJS', level: 85,
    detail: 'Reactive data flow with RxJS operators, typed models and clean services.',
    tags: ['switchMap', 'BehaviorSubject', 'debounceTime'],
  },
  {
    part: 'Power Unit', icon: '☕', name: 'Java & Spring Boot', level: 78,
    detail: 'REST APIs, Spring Data JPA, validation and exception handling for ERP modules.',
    tags: ['REST', 'JPA', '@Transactional'],
  },
  {
    part: 'Fuel System', icon: '🛢️', name: 'MySQL & MongoDB', level: 75,
    detail: 'Schema design, joins and aggregation for fees, admissions and reporting.',
    tags: ['Joins', 'Indexes', 'Aggregation'],
  },
  {
    part: 'Pit Wall', icon: '💳', name: 'Payment Gateways', level: 82,
    detail: 'EMI and UPI integrations, webhooks and fee-head to bank-account settlement.',
    tags: ['GrayQuest', 'PayU', 'PhonePe UPI', 'Webhooks'],
  },
  {
    part: 'Chassis', icon: '🎨', name: 'HTML, SCSS & Bootstrap', level: 88,
    detail: 'Responsive, accessible layouts that work from phone to desktop.',
    tags: ['Responsive', 'SCSS', 'Bootstrap'],
  },
  {
    part: 'Telemetry', icon: '🧪', name: 'Testing & Tools', level: 65,
    detail: 'Jasmine/Karma unit tests, Git workflows, Postman and AWS basics.',
    tags: ['Jasmine', 'Git', 'Postman', 'AWS'],
  },
  {
    part: 'Race Engineer', icon: '🤖', name: 'AI-assisted Dev', level: 70,
    detail: 'Using AI coding assistants to move faster, then reviewing and testing every line.',
    tags: ['Copilot', 'Claude', 'Code review'],
  },
];

export const LAPS: Lap[] = [
  {
    lap: 'LAP 4', title: 'SDE III · Full Stack', period: 'Aug 2026 – Now',
    points: ['Own modules end to end across Angular and Spring Boot', 'Lead releases for School ERP and the B2B portal'],
  },
  {
    lap: 'LAP 3', title: 'SDE II', period: 'Aug 2025 – Jul 2026',
    points: ['Built the payments module: EMI, UPI and webhooks', 'Fixed a fee-allocation bug that routed money to the wrong accounts'],
  },
  {
    lap: 'LAP 2', title: 'SDE I', period: 'Sep 2023 – Jul 2025',
    points: ['Admissions and fee modules for a multi-school ERP', 'Responsive migration of the Knowvo web app (PWA)'],
  },
  {
    lap: 'LAP 1', title: 'Intern', period: 'Feb 2023 – Aug 2023',
    points: ['Started on Angular UI work and shipped to production in month one'],
  },
];

export const PROJECTS: Project[] = [
  {
    id: 'payments', icon: '💳', title: 'Payments Module', team: 'Knowvo · School ERP',
    summary: 'Online fee payments with EMI and UPI, settled to the right school bank accounts.',
    problem: 'Schools collect many fee heads, and each one has to reach a specific trust or school account.',
    built: ['Integrated GrayQuest EMI, PayU and PhonePe UPI', 'Webhook handling with idempotent status updates', 'Fee-head to bank-account mapping and reconciliation views'],
    result: 'Parents pay online in one flow; finance teams see each payment land in the correct account.',
    stack: ['Angular', 'Spring Boot', 'MySQL', 'Webhooks'],
    gradient: 'linear-gradient(135deg,#e10600,#7a0000)',
  },
  {
    id: 'erp', icon: '🏫', title: 'School ERP: Admissions & Fees', team: 'Knowvo',
    summary: 'Admissions and fee management for a multi-school ERP, from form to receipt.',
    problem: 'Admissions and fee collection were spread across manual steps and spreadsheets.',
    built: ['Admission workflows with role-based access', 'Fee structures, due dates and receipts', 'Production fix for wrong due dates in fee allocation'],
    result: 'One place for schools to admit students and track every rupee.',
    stack: ['Angular', 'Spring Boot', 'MongoDB', 'MySQL'],
    gradient: 'linear-gradient(135deg,#00a19c,#004d4a)',
  },
  {
    id: 'b2b', icon: '🛰️', title: 'B2B Portal', team: 'Knowvo',
    summary: 'Partner portal built on Angular 21 with standalone components and signals.',
    problem: 'Partners needed a fast, modern portal to manage orders and accounts.',
    built: ['Standalone components and signal-based state', 'New control flow (@if / @for) and lazy-loaded routes', 'Reusable UI kit for forms and tables'],
    result: 'A modern codebase the team can extend quickly.',
    stack: ['Angular 21', 'Signals', 'TypeScript'],
    gradient: 'linear-gradient(135deg,#1e5bc6,#2b1a7a)',
  },
  {
    id: 'ecommerce', icon: '🛒', title: 'E-Commerce for Schools', team: 'Knowvo',
    summary: 'Vendor management with payment integration and inventory tracking.',
    problem: 'Schools needed to sell books and uniforms online without manual tracking.',
    built: ['Vendor and catalogue management', 'Cart and checkout with payment gateway', 'Stock tracking per school'],
    result: 'Online store for school supplies with live inventory.',
    stack: ['Angular', 'Payment Gateway', 'REST APIs'],
    gradient: 'linear-gradient(135deg,#ff8700,#a83c00)',
  },
  {
    id: 'lms', icon: '📚', title: 'LMS + CMDS', team: 'Knowvo',
    summary: 'Learning and content management with user roles and analytics.',
    problem: 'Teachers and admins needed one place to publish content and track usage.',
    built: ['Role-based content publishing', 'Usage dashboards and PDF reports', 'Client builds for test-prep platforms'],
    result: 'Content reaches students faster, with clear usage data for schools.',
    stack: ['Angular', 'REST APIs', 'Dashboards'],
    gradient: 'linear-gradient(135deg,#00d26a,#0a5a33)',
  },
  {
    id: 'students', icon: '🧑‍🎓', title: 'Student Management System', team: 'Open source',
    summary: 'Angular CRUD app to add, edit, delete and search student records.',
    problem: 'A practice project to master Angular forms, routing and services.',
    built: ['Reactive forms with validation', 'Service-based state and routing', 'Clean, responsive UI'],
    result: 'Public code you can read on GitHub.',
    stack: ['Angular', 'TypeScript'],
    gradient: 'linear-gradient(135deg,#6b6b6b,#232323)',
    link: 'https://github.com/jagadeeshdammu/angular-student-management-system',
  },
];
