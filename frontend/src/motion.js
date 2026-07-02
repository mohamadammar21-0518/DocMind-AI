/**
 * motion.js — Shared Framer Motion animation variants for DocMind AI v2
 *
 * Premium animation system — consistent, performant, delightful.
 * Every component imports from here for unified motion language.
 */

/* ── Fade Variants ─────────────────────────────────────────────────────────── */
export const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
}

export const fadeDown = {
  hidden:  { opacity: 0, y: -16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 26 } },
}

export const fadeIn = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
}

export const fadeScale = {
  hidden:  { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 25 } },
}

/* ── Scale Variants ────────────────────────────────────────────────────────── */
export const scaleIn = {
  hidden:  { opacity: 0, scale: 0.92 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } },
}

export const scaleUp = {
  hidden:  { opacity: 0, scale: 0.85 },
  visible: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 22 } },
}

/* ── Slide Variants ────────────────────────────────────────────────────────── */
export const slideInLeft = {
  hidden:  { x: -280, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit:    { x: -280, opacity: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
}

export const slideInRight = {
  hidden:  { x: 320, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 30 } },
  exit:    { x: 320, opacity: 0, transition: { duration: 0.2, ease: [0.16, 1, 0.3, 1] } },
}

/* ── Stagger Containers ────────────────────────────────────────────────────── */
export const staggerContainer = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.06, delayChildren: 0.06 },
  },
}

export const staggerItem = {
  hidden:  { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
}

export const staggerSlow = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.08 },
  },
}

export const staggerFast = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.03, delayChildren: 0.02 },
  },
}

/* ── Page / Tab Transition ─────────────────────────────────────────────────── */
export const pageTransition = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 24 } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.15, ease: [0.16, 1, 0.3, 1] } },
}

/* ── Card Reveal ───────────────────────────────────────────────────────────── */
export const cardReveal = {
  hidden:  { opacity: 0, y: 20, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 350, damping: 26 } },
}

/* ── Chat Message Appear ───────────────────────────────────────────────────── */
export const messageAppear = {
  hidden:  { opacity: 0, y: 12, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 400, damping: 25 } },
}

/* ── Insights Panel Slide ──────────────────────────────────────────────────── */
export const insightsPanelSlide = {
  hidden:  { x: 320, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 280, damping: 28 } },
  exit:    { x: 320, opacity: 0, transition: { duration: 0.2 } },
}

/* ── Drawer Slide ──────────────────────────────────────────────────────────── */
export const drawerSlide = {
  hidden:  { x: -300, opacity: 0 },
  visible: { x: 0, opacity: 1, transition: { type: 'spring', stiffness: 320, damping: 30 } },
  exit:    { x: -300, opacity: 0, transition: { duration: 0.22 } },
}

/* ── Accordion ─────────────────────────────────────────────────────────────── */
export const accordion = {
  hidden:  { height: 0, opacity: 0, overflow: 'hidden' },
  visible: { height: 'auto', opacity: 1, transition: { type: 'spring', stiffness: 300, damping: 28, staggerChildren: 0.04 } },
  exit:    { height: 0, opacity: 0, transition: { duration: 0.2 } },
}

/* ── Hover & Tap ───────────────────────────────────────────────────────────── */
export const hoverLift = {
  y: -4,
  scale: 1.02,
  transition: { type: 'spring', stiffness: 400, damping: 20 },
}

export const tapScale = {
  scale: 0.96,
  transition: { type: 'spring', stiffness: 500, damping: 15 },
}

export const hoverGlow = {
  boxShadow: '0 0 30px rgba(120, 119, 255, 0.15)',
  borderColor: 'rgba(120, 119, 255, 0.4)',
  transition: { duration: 0.3 },
}

/* ── Word-by-word (Hero) ───────────────────────────────────────────────────── */
export const wordContainer = {
  hidden:  {},
  visible: {
    transition: { staggerChildren: 0.04 },
  },
}

export const wordChild = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 400, damping: 25 } },
}

/* ── List Item Stagger ─────────────────────────────────────────────────────── */
export const listItemStagger = {
  hidden:  { opacity: 0, x: -12 },
  visible: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 400, damping: 28 } },
}

/* ── Floating Particle ─────────────────────────────────────────────────────── */
export const floatingOrb = {
  animate: {
    y: [0, -15, 0, 10, 0],
    x: [0, 8, -5, 3, 0],
    scale: [1, 1.05, 0.98, 1.02, 1],
    transition: {
      duration: 8,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
}

/* ── Upload Success ────────────────────────────────────────────────────────── */
export const uploadSuccess = {
  hidden:  { scale: 0, opacity: 0, rotate: -90 },
  visible: { scale: 1, opacity: 1, rotate: 0, transition: { type: 'spring', stiffness: 300, damping: 15 } },
}

/* ── Notification Pop ──────────────────────────────────────────────────────── */
export const notifPop = {
  hidden:  { opacity: 0, scale: 0.8, y: -8 },
  visible: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 500, damping: 25 } },
  exit:    { opacity: 0, scale: 0.8, y: -8, transition: { duration: 0.15 } },
}
