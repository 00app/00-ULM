'use client'

/**
 * Zero Zero front door.
 * Motion: Framer Motion. Masked line reveals, scroll-linked statement, count-up figures,
 * sticky process rail, accordion FAQ. MotionConfig reducedMotion="user" turns transforms off
 * for people who ask their OS for less motion; counters then show their final value.
 */
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AnimatePresence,
  MotionConfig,
  motion,
  useMotionValueEvent,
  useScroll,
  useSpring,
  useTransform,
} from 'framer-motion'
import {
  CountUp,
  EASE,
  InkWord,
  Rise,
  RevealLines as BrandRevealLines,
  RevealOnView as BrandRevealOnView,
} from '@/lib/motion/brand'
import { checkUkPostcode } from '@/lib/geocode/ukPostcode'
import {
  hasPartialStoredProfile,
  isStoredProfileOnboardingComplete,
  PROFILE_STORAGE_KEYS,
  readStoredProfileGoal,
} from '@/lib/profile/onboardingComplete'
import { trackFunnelEvent } from '@/lib/analytics/trackFunnelEvent'
import { ROUTES } from '@/lib/routes'
import { FACTS, FAQS, RULES, STEPS, WINS } from './content'


/* ------------------------------------------------------------------ logo */

/** The Zero Zero mark (app/icon.svg), drawn in currentColor. */
function LogoMark({ size = 28, animated = false }: { size?: number; animated?: boolean }) {
  const paths = [
    'M32.146 135.623C34.9864 130.775 38.0841 125.476 41.4176 119.79C39.4346 111.584 38.5664 102.134 38.5664 92.265C38.5664 63.7742 45.5228 38.0188 67.6674 38.0188C74.9131 38.0188 80.4975 40.8936 84.7957 45.6886C85.8997 43.8006 87.0037 41.9234 88.1077 40.0355C81.773 37.5361 74.8917 36.1201 67.6781 36.1201C36.6799 36.1201 11.577 61.4465 11.577 92.265C11.577 109.771 19.616 125.336 32.146 135.623Z',
    'M93.0511 43.083L37.0465 139.69C37.2501 139.829 37.4538 139.969 37.6574 140.055C46.779 146.48 57.8834 150.288 69.8989 150.288C100.897 150.288 126 125.176 126 94.1433C126 71.5416 112.473 51.9435 93.0511 43.0723M69.9096 148.4C57.8084 148.4 50.2732 140.752 45.8893 129.156C57.4975 109.601 81.893 67.9695 90.8216 52.7265C96.7383 62.9279 99.0106 78.1065 99.0106 94.1647C99.0106 122.87 91.8399 148.411 69.9096 148.411',
  ]
  const slash = 'M0 197.167C0 197.167 116.049 2.82119 117.721 0L119.361 1.36232L3.47311 200L0 197.167Z'
  return (
    <svg
      width={size * 0.63}
      height={size}
      viewBox="0 0 126 200"
      fill="currentColor"
      aria-hidden="true"
      style={{ display: 'block', overflow: 'visible' }}
    >
      {paths.map((d, i) => (
        <motion.path
          key={d}
          d={d}
          initial={animated ? { opacity: 0, scale: 0.85 } : false}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.1 + i * 0.12, ease: EASE }}
          style={{ transformOrigin: '63px 93px' }}
        />
      ))}
      <motion.path
        d={slash}
        initial={animated ? { clipPath: 'inset(100% 0 0 0)' } : false}
        animate={{ clipPath: 'inset(0% 0 0 0)' }}
        transition={{ duration: 0.9, delay: 0.35, ease: EASE }}
      />
    </svg>
  )
}

function Wordmark() {
  return (
    <Link href={ROUTES.FRONT_DOOR} className="zzfd-wordmark" aria-label="Zero Zero home">
      <LogoMark size={30} animated />
      <motion.span
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.7, delay: 0.5, ease: EASE }}
      >
        Zero Zero
      </motion.span>
    </Link>
  )
}

/* ------------------------------------------------------------------ primitives */

/** Brand reveals, scoped to the front door's mask classes. */
function RevealLines(props: { lines: ReactNode[]; className?: string; delay?: number }) {
  return <BrandRevealLines {...props} maskClassName="zzfd-mask" innerClassName="zzfd-mask__inner" />
}
function RevealOnView({ children }: { children: ReactNode }) {
  return (
    <BrandRevealOnView maskClassName="zzfd-mask" innerClassName="zzfd-mask__inner">
      {children}
    </BrandRevealOnView>
  )
}

function Eyebrow({ index, children, light = false }: { index: string; children: ReactNode; light?: boolean }) {
  return (
    <p className={`zzfd-eyebrow${light ? ' zzfd-eyebrow--light' : ''}`} data-keep-case>
      <span>({index})</span>
      <span>{children}</span>
    </p>
  )
}

function Arrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/* ------------------------------------------------------------------ sections */

function Header() {
  const { scrollY } = useScroll()
  const [scrolled, setScrolled] = useState(false)
  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24))

  return (
    <header className={`zzfd-header${scrolled ? ' is-scrolled' : ''}`}>
      <div className="zzfd-container zzfd-header__inner">
        <Wordmark />
        <nav aria-label="Main" className="zzfd-nav">
          <a href="#facts">Facts</a>
          <a href="#wins">Quick wins</a>
          <a href="#how">How it works</a>
          <a href="#faq">FAQ</a>
        </nav>
        <Link href={ROUTES.START} className="zzfd-btn zzfd-btn--dark zzfd-btn--sm">
          Open workspace <Arrow />
        </Link>
      </div>
    </header>
  )
}

function PostcodeForm() {
  const router = useRouter()
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)

  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const check = checkUkPostcode(value)
    if (!check.valid) {
      setError(true)
      return
    }
    try {
      localStorage.setItem(PROFILE_STORAGE_KEYS.postcode, check.normalized)
    } catch {
      /* storage blocked: the result page also reads the postcode from the URL */
    }
    router.push(`${ROUTES.START_RESULT}?postcode=${encodeURIComponent(check.normalized)}`)
  }

  return (
    <form className="zzfd-form" action={ROUTES.START_RESULT} method="get" onSubmit={onSubmit} noValidate>
      <label htmlFor="zzfd-postcode" className="zzfd-sr">
        Your postcode
      </label>
      <input
        id="zzfd-postcode"
        name="postcode"
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          if (error) setError(false)
        }}
        placeholder="Your postcode"
        autoComplete="postal-code"
        aria-invalid={error}
        aria-describedby={error ? 'zzfd-postcode-error' : undefined}
        className="zzfd-form__input"
      />
      <button type="submit" className="zzfd-btn zzfd-btn--blue">
        Find my first win <Arrow />
      </button>
      <AnimatePresence>
        {error ? (
          <motion.p
            id="zzfd-postcode-error"
            role="alert"
            className="zzfd-form__error"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            That doesn&apos;t look like a UK postcode.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  )
}

/** Straight, quiet product preview: what the Workspace opens on. */
function WorkspacePreview() {
  const rows = [
    { title: 'Broadband out of contract', meta: 'Average premium £9 a month', tag: 'Approve' },
    { title: 'Unused streaming service', meta: '1 tap to cancel', tag: 'One tap' },
    { title: 'Heat pump grant', meta: 'Boiler Upgrade Scheme', tag: 'Check' },
  ]
  return (
    <div className="zzfd-preview" aria-hidden="true">
      <div className="zzfd-preview__bar">
        <span />
        <span />
        <span />
        <em>Zero Zero Workspace</em>
      </div>
      <div className="zzfd-preview__body">
        <motion.div
          className="zzfd-preview__hero"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.7, ease: EASE }}
        >
          <span className="zzfd-preview__label">Needs you now</span>
          <span className="zzfd-preview__headline">Your broadband deal ended 4 months ago.</span>
          <span className="zzfd-preview__source">Source: your bill, 12 Oct 2026 · Confidence: high</span>
          <span className="zzfd-preview__actions">
            <span className="zzfd-preview__primary">Review and approve</span>
            <span className="zzfd-preview__ghost">Why?</span>
          </span>
        </motion.div>
        <span className="zzfd-preview__label zzfd-preview__label--dark">Action centre · 3 to review</span>
        <ul className="zzfd-preview__list">
          {rows.map((r, i) => (
            <motion.li
              key={r.title}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.95 + i * 0.1, ease: EASE }}
            >
              <span>
                <strong>{r.title}</strong>
                <small>{r.meta}</small>
              </span>
              <em>{r.tag}</em>
            </motion.li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function Hero() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] })
  const previewY = useTransform(scrollYProgress, [0, 1], [0, -90])
  const textY = useTransform(scrollYProgress, [0, 1], [0, 40])

  return (
    <section ref={ref} className="zzfd-hero" id="top">
      <div className="zzfd-container zzfd-hero__grid">
        <motion.div className="zzfd-hero__copy" style={{ y: textY }}>
          <motion.p
            className="zzfd-pill"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE }}
          >
            <span className="zzfd-pill__dot" />
            Price cap figures for October to December 2026
          </motion.p>
          <h1 className="zzfd-display" data-field-quiet>
            <RevealLines
              delay={0.15}
              lines={['Stop overpaying', <span key="b" className="zzfd-blue">for your home.</span>]}
            />
          </h1>
          <motion.p
            className="zzfd-lede"
            data-field-quiet
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.45, ease: EASE }}
          >
            Your bills, subscriptions and contracts in one workspace. We find what you are overpaying for, show you why
            and prepare the fix. You approve every step.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.6, ease: EASE }}
          >
            <PostcodeForm />
            <ul className="zzfd-trust" data-field-quiet>
              <li>Free to use</li>
              <li>No bank login to start</li>
              <li>Every figure sourced</li>
            </ul>
          </motion.div>
        </motion.div>
        <motion.div
          className="zzfd-hero__visual"
          style={{ y: previewY }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.1, delay: 0.35, ease: EASE }}
        >
          <WorkspacePreview />
        </motion.div>
      </div>
    </section>
  )
}

function Statement() {
  const ref = useRef<HTMLParagraphElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 85%', 'end 45%'] })
  const text =
    'Your home has ten bills in ten places. Deals end quietly and prices drift up. Nobody joins it up. Zero Zero does, and shows its working.'
  const words = text.split(' ')

  return (
    <section className="zzfd-section">
      <div className="zzfd-container">
        <Eyebrow index="01">The problem</Eyebrow>
        <p ref={ref} className="zzfd-statement" data-keep-case data-field-quiet>
          {words.map((w, i) => (
            <InkWord
              key={i}
              word={w}
              progress={scrollYProgress}
              range={[i / words.length, (i + 1) / words.length]}
              className="zzfd-statement__word"
            />
          ))}
        </p>
      </div>
    </section>
  )
}

function Facts() {
  return (
    <section id="facts" className="zzfd-section zzfd-section--navy">
      <div className="zzfd-container">
        <div className="zzfd-section__head">
          <div>
            <Eyebrow index="02" light>
              This quarter
            </Eyebrow>
            <h2 className="zzfd-h2" data-field-quiet>
              <RevealOnView>The numbers, straight.</RevealOnView>
            </h2>
          </div>
          <p className="zzfd-section__note" data-field-quiet>
            Regulator and published figures. Each one links to its source and shows its date.
          </p>
        </div>
        <div className="zzfd-stats" data-field-quiet>
          {FACTS.map((f, i) => (
            <Rise key={f.id} delay={i * 0.08} className="zzfd-stat">
              <span className="zzfd-stat__index">00{i + 1}</span>
              <CountUp value={f.value} prefix={f.prefix} suffix={f.suffix} className="zzfd-stat__value" />
              <p className="zzfd-stat__label">{f.label}</p>
              <a className="zzfd-stat__source" href={f.url} target="_blank" rel="noopener noreferrer">
                {f.source}, {f.date}
              </a>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  )
}

function Wins() {
  return (
    <section id="wins" className="zzfd-section">
      <div className="zzfd-container">
        <div className="zzfd-section__head">
          <div>
            <Eyebrow index="03">Start today</Eyebrow>
            <h2 className="zzfd-h2" data-field-quiet>
              <RevealOnView>Three wins, no sign-up.</RevealOnView>
            </h2>
          </div>
          <p className="zzfd-section__note" data-field-quiet>Savings are for an average household in Great Britain.</p>
        </div>
        <ol className="zzfd-cards">
          {WINS.map((w, i) => (
            <Rise key={w.n} as="li" delay={i * 0.1} className="zzfd-card">
              <motion.div className="zzfd-card__inner" whileHover={{ y: -6 }} transition={{ duration: 0.4, ease: EASE }}>
                <div className="zzfd-card__top">
                  <span>{w.n}</span>
                  <span className="zzfd-chip">{w.effort}</span>
                </div>
                <h3 className="zzfd-h3">{w.title}</h3>
                <p className="zzfd-body">{w.body}</p>
                <div className="zzfd-card__foot">
                  <strong>{w.saving}</strong>
                  <a href={w.url} target="_blank" rel="noopener noreferrer">
                    Source: {w.source}
                  </a>
                </div>
              </motion.div>
            </Rise>
          ))}
        </ol>
      </div>
    </section>
  )
}

function How() {
  const ref = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start 70%', 'end 60%'] })
  const fill = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.4 })

  return (
    <section id="how" className="zzfd-section zzfd-section--tint">
      <div className="zzfd-container zzfd-how">
        <div className="zzfd-how__aside">
          <Eyebrow index="04">The workspace</Eyebrow>
          <h2 className="zzfd-h2" data-field-quiet>
            <RevealOnView>Find. Explain.</RevealOnView>
            <RevealOnView>
              <span className="zzfd-blue">Act.</span>
            </RevealOnView>
          </h2>
          <p className="zzfd-section__note zzfd-section__note--dark" data-field-quiet>
            The workspace opens on the one thing that needs you first. Everything else waits in order.
          </p>
        </div>
        <div ref={ref} className="zzfd-how__steps" data-field-quiet>
          <div className="zzfd-how__rail" aria-hidden="true">
            <motion.div className="zzfd-how__rail-fill" style={{ scaleY: fill }} />
          </div>
          <ol>
            {STEPS.map((s, i) => (
              <Rise key={s.n} as="li" delay={i * 0.05} className="zzfd-step">
                <span className="zzfd-step__n">{s.n}</span>
                <div>
                  <h3 className="zzfd-h3">{s.title}</h3>
                  <p className="zzfd-body">{s.body}</p>
                </div>
              </Rise>
            ))}
          </ol>
        </div>
      </div>
    </section>
  )
}

function Rules() {
  return (
    <section className="zzfd-section">
      <div className="zzfd-container">
        <div className="zzfd-section__head">
          <div>
            <Eyebrow index="05">Our rules</Eyebrow>
            <h2 className="zzfd-h2" data-field-quiet>
              <RevealOnView>Built on trust,</RevealOnView>
              <RevealOnView>not commission.</RevealOnView>
            </h2>
          </div>
        </div>
        <div className="zzfd-rules" data-field-quiet>
          {RULES.map((r, i) => (
            <Rise key={r.n} delay={i * 0.08} className="zzfd-rule">
              <span className="zzfd-rule__n">{r.n}</span>
              <h3 className="zzfd-h4">{r.title}</h3>
              <p className="zzfd-body">{r.body}</p>
            </Rise>
          ))}
        </div>
      </div>
    </section>
  )
}

function Faq() {
  const [open, setOpen] = useState<number | null>(0)
  return (
    <section id="faq" className="zzfd-section zzfd-section--flush">
      <div className="zzfd-container zzfd-faq">
        <div>
          <Eyebrow index="06">Questions</Eyebrow>
          <h2 className="zzfd-h2" data-field-quiet>
            <RevealOnView>Fair questions.</RevealOnView>
          </h2>
        </div>
        <ul className="zzfd-faq__list" data-field-quiet>
          {FAQS.map((f, i) => {
            const isOpen = open === i
            return (
              <li key={f.q} className="zzfd-faq__item">
                <button
                  type="button"
                  className="zzfd-faq__q"
                  aria-expanded={isOpen}
                  aria-controls={`zzfd-faq-${i}`}
                  onClick={() => setOpen(isOpen ? null : i)}
                >
                  <span className="zzfd-faq__n">0{i + 1}</span>
                  <span className="zzfd-faq__text">{f.q}</span>
                  <motion.span
                    className="zzfd-faq__icon"
                    animate={{ rotate: isOpen ? 45 : 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    aria-hidden="true"
                  >
                    +
                  </motion.span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen ? (
                    <motion.div
                      id={`zzfd-faq-${i}`}
                      key="a"
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.45, ease: EASE }}
                      style={{ overflow: 'hidden' }}
                    >
                      <p className="zzfd-faq__a">{f.a}</p>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function Closing() {
  const ref = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const markY = useTransform(scrollYProgress, [0, 1], [120, 0])
  const markRotate = useTransform(scrollYProgress, [0, 1], [-8, 0])

  return (
    <section ref={ref} className="zzfd-closing">
      <motion.div className="zzfd-closing__mark" style={{ y: markY, rotate: markRotate }} aria-hidden="true">
        <LogoMark size={520} />
      </motion.div>
      <div className="zzfd-container zzfd-closing__inner">
        <Eyebrow index="07" light>
          Zero Zero Workspace
        </Eyebrow>
        <h2 className="zzfd-display zzfd-display--light" data-field-quiet>
          <RevealOnView>Find your</RevealOnView>
          <RevealOnView>first win.</RevealOnView>
        </h2>
        <Rise delay={0.15}>
          <Link href={ROUTES.START} className="zzfd-btn zzfd-btn--white zzfd-btn--lg">
            Open Zero Zero Workspace <Arrow />
          </Link>
        </Rise>
      </div>
    </section>
  )
}

function SiteFooter() {
  return (
    <footer className="zzfd-footer">
      <div className="zzfd-container zzfd-footer__inner">
        <span className="zzfd-wordmark zzfd-wordmark--light">
          <LogoMark size={24} />
          <span>Zero Zero</span>
        </span>
        <span>© 2026 Zero Zero · Lomi Lomi Design Ltd</span>
        <nav aria-label="Footer" className="zzfd-footer__nav">
          <Link href={ROUTES.PRIVACY}>Privacy and data</Link>
          <Link href={ROUTES.START}>Workspace</Link>
        </nav>
      </div>
    </footer>
  )
}

/* ------------------------------------------------------------------ page */

export default function FrontDoor() {
  const router = useRouter()

  // Returning users with a finished (or partial) profile are redirected on to the app; everyone
  // else (including SSG/crawlers, who never run this effect) sees the full page immediately —
  // content must render on the server, not wait on a client check, or static generation ships
  // a blank page.
  useEffect(() => {
    if (isStoredProfileOnboardingComplete()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.ZAI })
      router.replace(ROUTES.ZAI)
      return
    }
    if (readStoredProfileGoal() && hasPartialStoredProfile()) {
      trackFunnelEvent('intro_complete', { skipped: true, page: ROUTES.PROFILE })
      router.replace(ROUTES.PROFILE)
    }
  }, [router])

  return (
    <MotionConfig reducedMotion="user">
      <div className="zzfd">
        <Header />
        <main>
          <Hero />
          <Statement />
          <Facts />
          <Wins />
          <How />
          <Rules />
          <Faq />
          <Closing />
        </main>
        <SiteFooter />
      </div>
    </MotionConfig>
  )
}
