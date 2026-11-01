import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { useInViewReveal } from '../lib/anim.jsx'

/*
 * GATEWAY - closing CTA. Layout follows the classic centered-CTA pattern:
 * eyebrow, display headline, sub-copy, quiet "learn more" link, one primary
 * button - then a glowing horizon arc and a marquee of role and guarantee
 * cards that describe who CIT Scheduler serves and what it promises.
 */

const ROLES_A = [
  {
    title: 'Admin',
    body: 'Imports the official dataset, generates the weekly timetable, approves changes and exports validator-ready JSON.',
    tag: 'Full control',
  },
  {
    title: 'Department Coordinator',
    body: 'Reviews department bookings and lab requests, and cannot approve a request they submitted themselves.',
    tag: 'Department scope',
  },
  {
    title: 'Faculty',
    body: 'Sees their own timetable, marks unavailability and requests a moved or extra session in plain language.',
    tag: 'Own schedule',
  },
  {
    title: 'Club Representative',
    body: 'Describes a Spectra request in English or Hinglish, then tracks the approval, alternative or rejection reason.',
    tag: 'Spectra week',
  },
]

const ROLES_B = [
  {
    title: 'Zero hard violations',
    body: 'Every generated timetable passes the unmodified official validator: no double-booked room, group or faculty member.',
    tag: 'Correctness',
  },
  {
    title: 'Priority with reasons',
    body: 'All 25 Spectra requests are scored by role cap, category and submission time. Every rejection explains itself.',
    tag: 'Fairness',
  },
  {
    title: 'Minimal moves',
    body: 'A disruption repair moves only what it must. The preview counts moved sessions before Admin accepts.',
    tag: 'Stability',
  },
  {
    title: 'Every action audited',
    body: 'Approvals, cancellations and exports leave a durable trail. Nothing is hand-edited or silently rewritten.',
    tag: 'Trust',
  },
]

function RoleCard({ title, body, tag }) {
  return (
    <figure className="w-[19rem] shrink-0 rounded-2xl border border-white/10 bg-black/50 p-5 text-left backdrop-blur-md md:w-[23rem]">
      <div className="font-mono-tech text-[10px] uppercase tracking-[0.24em] text-amber-bright">
        {tag}
      </div>
      <p className="mt-3 text-[15px] font-semibold text-neutral-100">{title}</p>
      <blockquote className="mt-2 text-[14px] leading-relaxed text-neutral-300">
        {body}
      </blockquote>
    </figure>
  )
}

function CardRow({ cards, reverse = false, duration = '55s' }) {
  const row = (hidden) => (
    <div aria-hidden={hidden || undefined} className="flex shrink-0 items-stretch gap-5 pr-5">
      {cards.map((c) => (
        <RoleCard key={`${hidden ? 'b' : 'a'}-${c.title}`} {...c} />
      ))}
    </div>
  )
  return (
    <div className="overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_8%,black_92%,transparent)]">
      <div
        className={`manifesto-marquee hover:[animation-play-state:paused] ${reverse ? 'manifesto-marquee--reverse' : ''}`}
        style={{ animationDuration: duration }}
      >
        {row(false)}
        {row(true)}
      </div>
    </div>
  )
}

export default function Gateway() {
  const ref = useRef(null)
  useInViewReveal(ref, { y: 40 })

  return (
    <section id="translation" className="relative overflow-hidden" aria-label="Get started with CIT Scheduler">
      {/* Mesh-glow background - black crown melting into crimson, amber and aqua */}
      <div aria-hidden="true" className="cta-mesh absolute inset-0" />
      {/* Blend the top edge into the previous section */}
      <div aria-hidden="true" className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-obsidian via-obsidian/60 to-transparent" />

      <div ref={ref} className="relative mx-auto max-w-3xl px-6 pt-28 text-center md:pt-40">
        <p className="font-mono-tech text-[11px] uppercase tracking-[0.24em] text-neutral-300">
          Chilika Institute of Technology · CIT Scheduler
        </p>

        <h2 className="mt-5 font-display text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[1.04] tracking-tight text-white">
          One campus.
          <br />
          One timetable.
        </h2>

        <p className="mx-auto mt-5 max-w-[52ch] text-[15.5px] leading-relaxed text-neutral-300">
          Built for CIT: three years, five branches, fourteen student groups and
          twenty-seven rooms. Sign in with a demo role and run the whole week,
          from import to validator-ready export.
        </p>

        <div className="mt-9 flex flex-col items-center gap-5">
          <Link
            to="/how"
            className="group font-mono-tech text-[12px] uppercase tracking-[0.18em] text-neutral-200 transition-colors duration-300 hover:text-amber-bright"
          >
            Learn more
            <span aria-hidden="true" className="ml-2 inline-block transition-transform duration-300 group-hover:translate-y-0.5">↓</span>
          </Link>
          <Link
            to="/login"
            className="group flex items-center gap-3 rounded-full bg-gradient-to-r from-amber-bright to-bronze px-8 py-4 text-[15px] font-semibold text-black transition-transform duration-300 hover:scale-[1.03] active:scale-[0.98]"
          >
            Open the scheduler
            <span aria-hidden="true" className="transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px">↗</span>
          </Link>
          <span className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-neutral-400">
            /login · four demo roles · no setup
          </span>
        </div>
      </div>

      {/* Glowing horizon arc above the cards */}
      <div aria-hidden="true" className="pointer-events-none relative mx-auto mt-20 h-28 max-w-5xl overflow-visible md:mt-24">
        <div className="absolute left-1/2 top-0 h-[420px] w-[130%] -translate-x-1/2 rounded-[100%] border-t-2 border-fuchsia-100/25 blur-[1px]" />
        <div className="absolute left-1/2 top-0 h-[420px] w-[110%] -translate-x-1/2 rounded-[100%] border-t border-white/10" />
        <div className="absolute left-1/2 top-6 h-40 w-[80%] -translate-x-1/2 rounded-[100%] bg-fuchsia-400/10 blur-3xl" />
      </div>

      {/* Role and guarantee cards */}
      <div className="relative space-y-5 pb-24 md:pb-32">
        <p className="text-center font-mono-tech text-[10.5px] uppercase tracking-[0.24em] text-neutral-400">
          Four roles, four guarantees
        </p>
        <CardRow cards={ROLES_A} duration="58s" />
        <CardRow cards={ROLES_B} reverse duration="66s" />
      </div>
    </section>
  )
}
