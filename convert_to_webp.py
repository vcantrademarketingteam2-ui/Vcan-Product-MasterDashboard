"""
convert_to_webp.py — แปลงรูปใน public/packshots/ เป็น WebP
รัน: py convert_to_webp.py
"""
from PIL import Image
from pathlib import Path
import os

PACKSHOTS_DIR = Path(__file__).parent / "public" / "packshots"
QUALITY = 82   # 82% = คุณภาพดี, ขนาดเล็ก

def convert_all():
    src_files = sorted([
        f for f in PACKSHOTS_DIR.iterdir()
        if f.suffix.lower() in {'.jpg', '.jpeg', '.png'}
    ])

    if not src_files:
        print("[!] No jpg/png files found in", PACKSHOTS_DIR)
        return

    print(f"[1/2] Found {len(src_files)} files -- converting to WebP quality={QUALITY}%\n")

    converted, skipped, errors = 0, 0, 0
    orig_total, webp_total = 0, 0

    for f in src_files:
        out = f.with_suffix('.webp')
        orig_kb = f.stat().st_size // 1024

        # Skip ถ้ามี webp แล้วและใหม่กว่า
        if out.exists() and out.stat().st_mtime >= f.stat().st_mtime:
            skipped += 1
            continue

        try:
            img = Image.open(f).convert('RGBA')
            img.save(out, 'webp', quality=QUALITY, method=4)
            webp_kb = out.stat().st_size // 1024
            orig_total += orig_kb
            webp_total += webp_kb
            pct = round((1 - webp_kb / max(orig_kb, 1)) * 100)
            print(f"  OK {f.name:50s}  {orig_kb:5d} KB -> {webp_kb:5d} KB  (-{pct}%)")
            converted += 1
        except Exception as e:
            print(f"  !! {f.name} -- ERROR: {e}")
            errors += 1

    print(f"\n[2/2] Done!")
    print(f"  Converted : {converted} files")
    print(f"  Skipped   : {skipped} files (webp already up-to-date)")
    print(f"  Errors    : {errors} files")
    if orig_total:
        saved = orig_total - webp_total
        print(f"\n  Original  : {orig_total/1024:.1f} MB")
        print(f"  WebP      : {webp_total/1024:.1f} MB")
        print(f"  Saved     : {saved/1024:.1f} MB  ({round(saved/orig_total*100)}%)")

if __name__ == "__main__":
    convert_all()
    input("\nกด Enter เพื่อปิด...")
