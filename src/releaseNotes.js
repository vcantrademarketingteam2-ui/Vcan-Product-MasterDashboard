// "What's new" popup content + seen-tracking. Add a release by putting a new entry FIRST
// in RELEASES. Small fixes need no entry: without a new entry nobody sees the popup again.
import { useState } from 'react'

export const RELEASES = [
  {
    v: '4.1',
    th: {
      title: 'มีอะไรใหม่',
      items: [
        ['หน้า Products รวมทุกอย่างไว้ที่เดียว', 'รวมแท็บ Packshot เข้ามาแล้ว กรองตามสถานะ ห้าง และแบรนด์ได้ทางซ้าย สลับดูแบบการ์ดหรือตารางได้ บนมือถือกดปุ่ม Brand / Customer เพื่อเลือก'],
        ['ดาวน์โหลด PNG พื้นหลังโปร่งใส', 'รูป Packshot แบบ PNG ตัดพื้นขาวออกให้แล้ว นำไปทำอาร์ตเวิร์กได้ทันที'],
        ['เพิ่ม The Mall ใน Promotion Plan', 'รวมช่วง M Price (ทุก 2 สัปดาห์) แสดงคู่กับแต่ละเดือน เหมือนช่วง Bro ของ TWD'],
        ['นำ Spotlight ออก', 'คอลัมน์ NOW ในหน้า Plan แสดงโปรที่กำลังจัดอยู่วันนี้อยู่แล้ว'],
      ],
      close: 'เข้าใจแล้ว',
    },
    en: {
      title: "What's new",
      items: [
        ['Products page, all in one place', 'The Packshot tab is now part of Products. Filter by status, store and brand on the left, and switch between cards and table. On phone, tap Brand or Customer to pick.'],
        ['Transparent PNG downloads', 'Packshot PNGs now download with the white background removed, ready for artwork.'],
        ['The Mall in the Promotion Plan', "Including the 2-week M Price periods, shown next to each month like TWD's Bro periods."],
        ['Spotlight removed', "The Plan view's NOW column already shows what's running today."],
      ],
      close: 'Got it',
    },
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
