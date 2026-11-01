import type { Transition } from 'framer-motion'

/** Slow-out curve used across the app — soft arrival, no overshoot. */
export const SOFT_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1]
export const SOFT_EASE_OUT: [number, number, number, number] = [0.16, 1, 0.3, 1]

export const softTransition: Transition = {
  duration: 0.55,
  ease: SOFT_EASE,
}

export const softQuick: Transition = {
  duration: 0.28,
  ease: SOFT_EASE,
}

/** Gentle spring for panels and dialogs — settles without a bounce. */
export const softSpring: Transition = {
  type: 'spring',
  stiffness: 240,
  damping: 28,
  mass: 0.9,
}
