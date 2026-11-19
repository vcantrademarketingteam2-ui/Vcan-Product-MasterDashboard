// "What's new" popup (content lives in releaseNotes.js). Shown once per announced release.
import { useState, useEffect } from 'react'
import { RELEASES, LANG_KEY, store } from './releaseNotes.js'

export default function WhatsNew({ onClose, t, dark, isMobile }) {
  const [lang, setLang] = useState(() => store.get(LANG_KEY) || 'th')
  const pick = l => { setLang(l); store.set(LANG_KEY, l) }
  const rel = RELEASES[0], c = rel[lang]

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const accentTx = dark ? '#d4a86a' : '#7d5530'
  const segBtn = on => ({
    border: 0, cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 700,
    minWidth: 44, height: 32, borderRadius: 7, padding: '0 10px',
    background: on ? t.surface : 'transparent', color: on ? t.text : t.muted,
    boxShadow: on ? `0 0 0 1px ${t.accent}88` : 'none',
  })

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 2500, background: 'rgba(0,0,0,.45)',
      display: 'flex', alignItems: isMobile ? 'flex-end' : 'center', justifyContent: 'center',
      padding: isMobile ? 0 : 20,
    }}>
      <div role="dialog" aria-modal="true" aria-labelledby="wn-title" onClick={e => e.stopPropagation()} style={{
        width: isMobile ? '100%' : 480, maxHeight: isMobile ? '88dvh' : '85vh', overflowY: 'auto',
        background: t.surface, color: t.text, border: `1px solid ${t.border}`,
        borderRadius: isMobile ? '16px 16px 0 0' : 16, boxShadow: '0 24px 60px rgba(0,0,0,.4)',
        padding: isMobile ? '18px 18px 24px' : '22px 24px 24px', boxSizing: 'border-box',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.1em', textTransform: 'uppercase', color: accentTx }}>v{rel.v}</div>
            <h2 id="wn-title" style={{ margin: '4px 0 0', fontSize: 20, fontWeight: 800 }}>{c.title}</h2>
          </div>
          <div role="group" aria-label="Language" style={{ display: 'flex', gap: 3, padding: 3, borderRadius: 10, background: t.surface2, border: `1px solid ${t.border}` }}>
            <button onClick={() => pick('th')} aria-pressed={lang === 'th'} style={segBtn(lang === 'th')}>TH</button>
            <button onClick={() => pick('en')} aria-pressed={lang === 'en'} style={segBtn(lang === 'en')}>EN</button>
          </div>
        </div>

        <ol style={{ listStyle: 'none', margin: '18px 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
          {c.items.map(([head, body], i) => (
            <li key={i} style={{ display: 'flex', gap: 12 }}>
              <span aria-hidden="true" style={{ flexShrink: 0, width: 24, height: 24, borderRadius: 99, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: accentTx, background: `${t.accent}22` }}>{i + 1}</span>
              <div>
                <div style={{ fontSize: 14.5, fontWeight: 700, lineHeight: 1.35 }}>{head}</div>
                <div style={{ fontSize: 13, color: t.muted, lineHeight: 1.5, marginTop: 2 }}>{body}</div>
              </div>
            </li>
          ))}
        </ol>

        <button onClick={onClose} autoFocus={!isMobile} style={{
          marginTop: 22, width: '100%', height: 44, border: 0, borderRadius: 10, cursor: 'pointer',
          fontFamily: 'inherit', fontSize: 14, fontWeight: 700, color: '#fff',
          background: 'linear-gradient(135deg,#d4a86a,#9c6b35)',
        }}>{c.close}</button>
      </div>
    </div>
  )
}
