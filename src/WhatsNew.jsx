// "What's new" popup (content lives in releaseNotes.js). Shown once per announced release.
// One slide per change: real screenshot + bronze ring on the changed spot + short TH/EN caption.
import { useState, useEffect } from 'react'
import { RELEASES, UI, LANG_KEY, store } from './releaseNotes.js'

const BRONZE = '#d4a86a'

export default function WhatsNew({ onClose, t, dark, isMobile }) {
  const [lang, setLang] = useState(() => store.get(LANG_KEY) || 'th')
  const [i, setI] = useState(0)
  const pick = l => { setLang(l); store.set(LANG_KEY, l) }
  const rel = RELEASES[0], ui = UI[lang], slides = rel.slides
  const s = slides[i], [head, body] = s[lang], last = i === slides.length - 1
  const go = n => setI(Math.max(0, Math.min(slides.length - 1, n)))

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') onClose()
      else if (e.key === 'ArrowRight') setI(n => Math.min(slides.length - 1, n + 1))
      else if (e.key === 'ArrowLeft') setI(n => Math.max(0, n - 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose, slides.length])

  const accentTx = dark ? BRONZE : '#7d5530'
  const segBtn = on => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
    minWidth: 44, height: 32, borderRadius: 7, padding: '0 10px',
    background: on ? t.surface : 'transparent', color: on ? t.text : t.muted,
    boxShadow: on ? `0 0 0 1px ${t.accent}88` : 'none',
  })
  const btn = primary => ({
    height: 44, minWidth: 96, padding: '0 18px', borderRadius: 10, cursor: 'pointer',
    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
    border: primary ? 0 : `1px solid ${t.border}`,
    background: primary ? 'linear-gradient(135deg,#d4a86a,#9c6b35)' : 'transparent',
    color: primary ? '#fff' : t.text,
  })
  const [rx, ry, rw, rh] = s.ring

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,.5)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 20,
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick={e => e.stopPropagation()} style={{
        width: isMobile ? '100%' : 680, maxHeight: isMobile ? '92dvh' : '90vh', overflowY: 'auto',
        background: t.surface, color: t.text, border: `1px solid ${t.border}`,
        borderRadius: isMobile ? '16px 16px 0 0' : 16, boxShadow: '0 24px 60px rgba(0,0,0,.4)',
        padding: isMobile ? '16px 14px 20px' : '20px 22px 22px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <h2 id="wn-title" style={{ flex: 1, margin: 0, fontSize: 18, fontWeight: 800 }}>
            {ui.title} <span style={{ fontSize: 12, fontWeight: 800, color: accentTx, marginLeft: 4 }}>v{rel.v}</span>
          </h2>
          <div role="group" aria-label="Language" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: t.surface2, border: `1px solid ${t.border}` }}>
            <button onClick={() => pick('th')} aria-pressed={lang === 'th'} style={segBtn(lang === 'th')}>TH</button>
            <button onClick={() => pick('en')} aria-pressed={lang === 'en'} style={segBtn(lang === 'en')}>EN</button>
          </div>
        </div>

        {/* screenshot + ring; overflow hidden clips the dimming shadow to the image */}
        <div style={{ position: 'relative', marginTop: 14, aspectRatio: '1128 / 705', borderRadius: 12, overflow: 'hidden', border: `1px solid ${t.border}`, background: '#0d1117' }}>
          <img key={s.img} src={s.img} alt={head} style={{ display: 'block', width: '100%', height: '100%', objectFit: 'cover' }} />
          <div aria-hidden="true" style={{
            position: 'absolute', left: `${rx}%`, top: `${ry}%`, width: `${rw}%`, height: `${rh}%`,
            border: `3px solid ${BRONZE}`, borderRadius: 10, boxSizing: 'border-box',
            boxShadow: `0 0 0 9999px rgba(0,0,0,.42), 0 0 18px ${BRONZE}`,
            transition: 'left .3s, top .3s, width .3s, height .3s',
          }} />
        </div>

        <div style={{ marginTop: 14, minHeight: 64 }}>
          <div style={{ fontSize: 16, fontWeight: 800, lineHeight: 1.35 }}>{head}</div>
          <div style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.5, marginTop: 3 }}>{body}</div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
          <div style={{ display: 'flex', gap: 2, flex: 1 }}>
            {slides.map((sl, k) => (
              <button key={k} onClick={() => go(k)} aria-label={`${k + 1} / ${slides.length}: ${sl[lang][0]}`} aria-current={k === i}
                style={{ width: 28, height: 28, padding: 0, border: 0, background: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ width: k === i ? 18 : 8, height: 8, borderRadius: 99, background: k === i ? BRONZE : t.border, transition: 'width .2s' }} />
              </button>
            ))}
          </div>
          {i > 0 && <button onClick={() => go(i - 1)} style={btn(false)}>{ui.back}</button>}
          <button onClick={last ? onClose : () => go(i + 1)} autoFocus={!isMobile} style={btn(true)}>
            {last ? ui.done : ui.next}
          </button>
        </div>
      </div>
    </div>
  )
}
