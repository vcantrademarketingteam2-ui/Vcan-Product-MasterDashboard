// "What's new" popup content + seen-tracking. Add a release by putting a new entry FIRST
// in RELEASES. Small fixes need no entry: without a new entry nobody sees the popup again.
// Each slide = a real screenshot (public/whatsnew/<v>/, 1128x705 crop, webp) + a bronze ring
// around the changed spot. ring = [left, top, width, height] in % of the image.
import { useState } from 'react'

export const UI = {
  th: { title: 'มีอะไรใหม่', back: 'ย้อนกลับ', next: 'ถัดไป', done: 'เข้าใจแล้ว' },
  en: { title: "What's new", back: 'Back', next: 'Next', done: 'Got it' },
}

export const RELEASES = [
  {
    v: '4.1',
    slides: [
      {
        img: '/whatsnew/4.1/products.webp', ring: [7.1, 8.2, 31.4, 89.6],
        th: ['หน้า Products รวมทุกอย่างไว้ที่เดียว', 'Packshot รวมเข้ามาแล้ว กรองสถานะ ห้าง และแบรนด์ได้จากแผงด้านซ้าย'],
        en: ['Products, all in one place', 'Packshot is now part of Products. Filter by status, store and brand from the left panel.'],
      },
      {
        img: '/whatsnew/4.1/png-export.webp', ring: [51.4, 82.2, 25.3, 16.5],
        th: ['PNG พื้นหลังโปร่งใส', 'ตอนนี้ดาวน์โหลดรูปเป็นไฟล์ PNG พื้นหลังโปร่งใสได้แล้ว'],
        en: ['Transparent PNG', 'Now you can download the picture as a PNG with a transparent background.'],
      },
      {
        img: '/whatsnew/4.1/the-mall.webp', ring: [75.9, 62.1, 23.0, 6.8],
        th: ['The Mall ใน Promotion Plan', 'มีช่วง M Price ทุก 2 สัปดาห์ แสดงคู่กับแต่ละเดือน'],
        en: ['The Mall in Promotion Plan', 'Including the 2-week M Price periods next to each month.'],
      },
      {
        img: '/whatsnew/4.1/now-column.webp', ring: [37.9, 62.1, 16.0, 37.9],
        th: ['นำ Spotlight ออก', 'ดูโปรโมชั่นที่กำลังเล่น ณ ปัจจุบันได้ที่ไฮไลท์เหลือง คอลัมน์ NOW'],
        en: ['Spotlight removed', 'Look at the current promotions in play in the highlighted NOW line.'],
      },
    ],
  },
]

const SEEN_KEY = 'vc-whatsnew-seen'
export const LANG_KEY = 'vc-whatsnew-lang'
export const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch { /* private mode: popup just shows again */ } },
}

// open = auto-open on first visit to a new release; reopen() for the version badge
export function useWhatsNew() {
  const [open, setOpen] = useState(() => !!RELEASES[0] && store.get(SEEN_KEY) !== RELEASES[0].v)
  const close = () => { store.set(SEEN_KEY, RELEASES[0].v); setOpen(false) }
  return { open, close, reopen: () => setOpen(true) }
}
