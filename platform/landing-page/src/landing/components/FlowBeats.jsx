import { Link } from 'react-router-dom';
import FlowArt, { FlowSection } from './ui/story-scroll.jsx';

/*
 * FLOW BEATS - "One pipeline. Three beats."
 * Story-scroll manner: full-screen panels pin and swing in over each other.
 * Full-bleed saturated colorways, one per beat:
 * crimson → electric → aqua → deep crimson.
 */

function Body({ dark = false, children }) {
  return (
    <p className={`max-w-[52ch] text-[clamp(1rem,2vw,1.5rem)] font-normal leading-relaxed ${dark ? 'text-black/80' : 'text-white/90'}`}>
      {children}
    </p>
  );
}

function Meta({ dark = false, items }) {
  return (
    <div className="mt-[2vw] flex flex-wrap gap-x-8 gap-y-2">
      {items.map((m) => (
        <span key={m} className={`font-mono-tech text-[10.5px] uppercase tracking-[0.2em] ${dark ? 'text-black/70' : 'text-white/75'}`}>
          {m}
        </span>
      ))}
    </div>
  );
}

const DISPLAY = 'font-display text-[clamp(3.2rem,11vw,12.5rem)] font-bold uppercase leading-[0.86] tracking-[-0.02em]';
const SERIF = 'font-serif-aesthetic font-normal normal-case italic tracking-[-0.01em]';

export default function FlowBeats() {
  return (
    // id="pipeline" restores the nav anchor (the parked Pipeline section's
    // "One pipeline. Three beats." content lives here now).
    <div id="pipeline" className="relative">
    <FlowArt aria-label="How the CIT Scheduler pipeline runs">
      {/* 00 - Intro on crimson */}
      <FlowSection aria-label="One pipeline, three beats" style={{ backgroundColor: '#C5003C', color: '#FFF8F0' }}>
        <div>
          <h2 className={`${DISPLAY} text-center`}>
            One pipeline.
            <br />
            <span className={`${SERIF} text-black`}>Three beats.</span>
          </h2>
        </div>
        <div>
          <hr className="mb-[2vw] border-none border-t border-white/50" />
          <Body>
            Import to timetable to export: one continuous run. Chilika
            Institute of Technology's week is checked by the same hard rules the
            official validator enforces.
          </Body>
          <Meta items={['Import', 'Solve', 'Validate', 'Export']} />
        </div>
      </FlowSection>

      {/* 01 - Read the data on electric */}
      <FlowSection aria-label="Beat one: read the data" style={{ backgroundColor: '#F3E600', color: '#000000' }}>
        <div>
          <h2 className={`${DISPLAY} text-black`}>
            Read
            <br />
            <span className={`${SERIF} text-deep-crimson`}>the data.</span>
          </h2>
        </div>
        <div>
          <hr className="mb-[2vw] border-none border-t border-black/50" />
          <Body dark>
            The official cit_public.json is parsed and counted: 27 rooms, 40
            faculty, 14 student groups, 189 sessions, 41 exams and 25 Spectra
            requests.
          </Body>
          <Meta dark items={['cit_public.json', '189 sessions', '7 counts']} />
        </div>
      </FlowSection>

      {/* 02 - Solve the week on aqua */}
      <FlowSection aria-label="Beat two: solve the week" style={{ backgroundColor: '#55EAD4', color: '#000000' }}>
        <div>
          <h2 className={`${DISPLAY} text-black`}>
            Solve
            <br />
            <span className={`${SERIF} text-deep-crimson`}>the week.</span>
          </h2>
        </div>
        <div>
          <hr className="mb-[2vw] border-none border-t border-black/50" />
          <Body dark>
            OR-Tools CP-SAT places every session exactly once, respects lunch,
            lab start periods and faculty limits, then seats 41 midsem exams at
            half room capacity.
          </Body>
          <Meta dark items={['CP-SAT', '0 hard violations', 'Soft penalty 3']} />
        </div>
      </FlowSection>

      {/* 03 - Explain the call on deep crimson */}
      <FlowSection aria-label="Beat three: explain the call" style={{ backgroundColor: '#880425', color: '#FFF8F0' }}>
        <div>
          <h2 className={DISPLAY}>
            Explain
            <br />
            <span className={`${SERIF} text-electric`}>the call.</span>
          </h2>
        </div>
        <div>
          <hr className="mb-[2vw] border-none border-t border-white/50" />
          <Body>
            Every approval, rejection and repair carries a reason: priority
            order, room capacity, department ownership and exactly how many
            sessions moved. Nothing changes without a signature.
          </Body>
          <div className="mt-[2vw] flex flex-wrap items-center gap-x-8 gap-y-2">
            <Meta items={['Reasons', 'Diff preview', 'Audit trail']} />
            <Link
              to="/login"
              className="group font-mono-tech text-[10.5px] uppercase tracking-[0.2em] text-white"
            >
              Open the scheduler
              <span aria-hidden="true" className="ml-2 inline-block text-electric transition-transform duration-300 group-hover:-translate-y-px group-hover:translate-x-px">↗</span>
            </Link>
          </div>
        </div>
      </FlowSection>
    </FlowArt>
    </div>
  );
}
