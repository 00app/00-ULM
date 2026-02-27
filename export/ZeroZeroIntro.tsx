/**
 * ZERO ZERO INTRO — Export for use in another project
 *
 * Contains: (1) Animated glitch logo, (2) Rapid word cycle text.
 *
 * Usage:
 *   import ZeroZeroIntro from './ZeroZeroIntro'
 *   <ZeroZeroIntro onComplete={() => { ... }} />
 *
 * Assets (copy from this project's public/assets/ into your public folder):
 *   - /assets/00 brand mark.svg      (base logo)
 *   - /assets/00 brand mark pink.svg (glitch layer)
 *   - /assets/00 brand mark lime.svg (glitch layer)
 *
 * Or set logoBaseUrl, e.g. logoBaseUrl="/images" for /images/00 brand mark.svg etc.
 */

'use client'

import { useEffect, useState } from 'react'

const GLITCH_CSS = `
.zz-glitch-export {
  position: relative;
  width: 126px;
  height: 200px;
}
.zz-glitch-export img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: auto;
}
.zz-glitch-export .glitch-layer.base {
  z-index: 3;
  filter: none;
  animation: zzGlitchBase 2s linear forwards;
}
.zz-glitch-export .glitch-layer.pink {
  z-index: 2;
  filter: hue-rotate(320deg);
  animation: zzGlitchPink 2s linear forwards;
}
.zz-glitch-export .glitch-layer.cool {
  z-index: 1;
  filter: hue-rotate(200deg);
  animation: zzGlitchCool 2s linear forwards;
}
@keyframes zzGlitchPink {
  0%   { opacity: 0; transform: translate(0,0); }
  10%  { opacity: 1; transform: translate(5px,-5px); }
  20%  { transform: translate(-5px,3px); }
  30%  { transform: translate(4px,5px); }
  40%  { transform: translate(-4px,-3px); }
  60%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(0,0); }
}
@keyframes zzGlitchCool {
  0%   { opacity: 0; transform: translate(0,0); }
  15%  { opacity: 1; transform: translate(-5px,5px); }
  25%  { transform: translate(4px,-4px); }
  35%  { transform: translate(-3px,4px); }
  45%  { transform: translate(5px,-2px); }
  60%  { opacity: 0.8; }
  100% { opacity: 0; transform: translate(0,0); }
}
@keyframes zzGlitchBase {
  0%   { opacity: 0; }
  20%  { opacity: 1; }
  100% { opacity: 1; }
}
`

type Phase = 'logo' | 'words1' | 'words2'

interface ZeroZeroIntroProps {
  /** Called after logo + both word sequences finish. */
  onComplete?: () => void
  /** Base path for logo assets. Default "/assets" → /assets/00 brand mark.svg etc. */
  logoBaseUrl?: string
  /** Blue used for text. Default #000AFF */
  textColor?: string
}

export default function ZeroZeroIntro({
  onComplete,
  logoBaseUrl = '/assets',
  textColor = '#000AFF',
}: ZeroZeroIntroProps) {
  const [phase, setPhase] = useState<Phase>('logo')

  // Inject glitch CSS once
  useEffect(() => {
    const id = 'zero-zero-intro-glitch-css'
    if (document.getElementById(id)) return
    const style = document.createElement('style')
    style.id = id
    style.textContent = GLITCH_CSS
    document.head.appendChild(style)
    return () => {
      document.getElementById(id)?.remove()
    }
  }, [])

  // Phase 1: Logo for 2s then switch to words1
  useEffect(() => {
    if (phase !== 'logo') return
    const t = setTimeout(() => setPhase('words1'), 2000)
    return () => clearTimeout(t)
  }, [phase])

  const base = `${logoBaseUrl.replace(/\/$/, '')}/00 brand mark.svg`
  const pink = `${logoBaseUrl.replace(/\/$/, '')}/00 brand mark pink.svg`
  const lime = `${logoBaseUrl.replace(/\/$/, '')}/00 brand mark lime.svg`

  // ——— LOGO ———
  if (phase === 'logo') {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#FDFDFF',
        }}
      >
        <div className="zz-glitch-export">
          <img src={base} className="glitch-layer base" alt="Zero Zero" />
          <img src={pink} className="glitch-layer pink" alt="" aria-hidden />
          <img src={lime} className="glitch-layer cool" alt="" aria-hidden />
        </div>
      </div>
    )
  }

  // ——— RAPID TEXT: "save money cut carbon feel good" then "use less more" ———
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#FDFDFF',
      }}
    >
      <IntroWordCycleExport
        words={phase === 'words1' ? ['save', 'money', 'cut', 'carbon', 'feel', 'good'] : ['use', 'less', 'more']}
        textColor={textColor}
        onComplete={() => {
          if (phase === 'words1') {
            setTimeout(() => setPhase('words2'), 200)
          } else {
            onComplete?.()
          }
        }}
      />
    </div>
  )
}

/** Inline rapid word cycle: one word at a time, 120ms visible, 80ms gap. */
function IntroWordCycleExport({
  words,
  textColor,
  onComplete,
}: {
  words: string[]
  textColor: string
  onComplete?: () => void
}) {
  const [index, setIndex] = useState(0)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>
    setVisible(true)
    timeout = setTimeout(() => {
      setVisible(false)
      timeout = setTimeout(() => {
        if (index < words.length - 1) {
          setIndex(index + 1)
        } else {
          onComplete?.()
        }
      }, 80)
    }, 120)
    return () => clearTimeout(timeout)
  }, [index, words.length, onComplete])

  return (
    <h1
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 120ms linear',
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        pointerEvents: 'none',
        color: textColor,
        margin: 0,
        fontFamily: 'Roboto, sans-serif',
        fontSize: 'clamp(60px, 15vw, 100px)',
        lineHeight: 1,
        letterSpacing: '-2px',
        fontWeight: 900,
        textTransform: 'lowercase',
      }}
    >
      {words[index]}.
    </h1>
  )
}
