#!/usr/bin/env python3
"""
convert_promo.py — Parse promotion plan xlsx files into src/promo_data.js
Usage: python convert_promo.py
Reads from Y:\\MARKETING\\Promotion Plan ทุกห้าง\\2026\\
Writes to src/promo_data.js
"""
import json
from datetime import datetime
from pathlib import Path
import openpyxl

BASE_DIR = Path(r'Y:\MARKETING\Promotion Plan ทุกห้าง\2026')
OUT = Path('src/promo_data.js')

# Activity fill-color detection (openpyxl returns ARGB format: AARRGGBB)
ACTIVITY_COLORS = {
    'FFFFFF00': 'media',    # bright yellow = ลงสื่อ (Tops, Villa, Big C)
    'FFFFC000': 'media',    # amber = ลงสื่อ
    'FF00B0F0': 'field',    # blue = ลงพื้นที่ (Big C)
    'FF00B050': 'field',    # green = ลงพื้นที่
    'FF92D050': 'field',    # lime green = ลงพื้นที่
    'FFFF0000': None,       # red = ยกเลิก (skip)
    'FFD9D9D9': None,       # gray = header/ignore
    'FFBDD7EE': None,       # light blue header = ignore
    'FFE2EFDA': None,       # light green header = ignore
}

LOOKS_KEYWORDS = ['looks', 'magazine']
SKIP_HEADER_KEYWORDS = {'total', 'remark', 'note', 'หมายเหตุ', 'grand total', 'sub total'}

# Per-retailer config: file name, sheets, and which row the header is on (1-indexed)
# Adjust header_row and column indices if the script misreads a file.
CONFIG = {
    'Tops': {
        'file': 'Tops - Activity Promotion 2026.xlsx',
        'sheets': ['VCAN', 'อาหารสัตว์'],
        'header_row': 9,
        'cols': {'barcode': 1, 'product': 2, 'pack': 3, 'cost': 4, 'rsp': 5, 'gp': 6, 'period_start': 7},
    },
    'Villa': {
        'file': 'Villa - Activity Promotion 2026.xlsx',
        'sheets': ['Plan Update', 'Moola'],
        'header_row': 8,
        # A=Barcode, B=Item code, C=Product, D=Pack, E=Cost, F=RSP, G=GP%, H+=periods
        'cols': {'barcode': 1, 'product': 3, 'pack': 4, 'cost': 5, 'rsp': 6, 'gp': 7, 'period_start': 8},
    },
    'Big C': {
        'file': 'Big C - Activity Promotion 2026.xlsx',
        'sheets': None,  # first sheet only
        'header_row': 8,
        'cols': {'barcode': 1, 'product': 2, 'pack': 3, 'cost': 4, 'rsp': 5, 'gp': 6, 'period_start': 7},
    },
    'Boots': {
        'file': 'Boots Plan promotion  2026.xlsx',
        'sheets': ['Sheet1'],
        'header_row': 3,
        # Col A empty, B=Barcode, C=Item code, D=Product, E=Pack, F=Cost, G=RSP, H=GP%, I+=periods
        'cols': {'barcode': 2, 'product': 4, 'pack': 5, 'cost': 6, 'rsp': 7, 'gp': 8, 'period_start': 9},
    },
    'Foodland': {
        'file': 'Foodland - Activity Promotion 2026.xlsx',
        'sheets': None,
        'header_row': 7,
        # A=Barcode, B=Code Foodland, C=Product, D=Pack, E=Cost, F=RSP, G=GP%, H+=periods
        'cols': {'barcode': 1, 'product': 3, 'pack': 4, 'cost': 5, 'rsp': 6, 'gp': 7, 'period_start': 8},
    },
    'Homepro': {
        'file': 'Homepro - Activity Promotion 2026.xlsx',
        'sheets': None,
        'header_row': 6,
        # A=Barcode, B=Article, C=Product, D=Pack, E=Cost, F=RSP, G=GP%, H+=periods
        'cols': {'barcode': 1, 'product': 3, 'pack': 4, 'cost': 5, 'rsp': 6, 'gp': 7, 'period_start': 8},
    },
    'Lotus': {
        'file': 'Lotus - Activity Promotion 2026.xlsx',
        'sheets': None,
        'header_row': 8,
        'cols': {'barcode': 1, 'product': 2, 'pack': 3, 'cost': 4, 'rsp': 5, 'gp': 6, 'period_start': 7},
    },
    'TWD': {
        'file': 'TWD - Activity Promotion 2026.xlsx',
        'sheets': ['TWD'],
        'header_row': 5,
        # A=Barcode, B=Item Code, C=Product, D=Pack, E=Cost, F=RSP, G=GP%, H+=periods
        'cols': {'barcode': 1, 'product': 3, 'pack': 4, 'cost': 5, 'rsp': 6, 'gp': 7, 'period_start': 8},
    },
    # Central: add path when available
    # 'Central Department': {
    #     'file': 'Central - Activity Promotion 2026.xlsx',
    #     'sheets': None,
    #     'header_row': 8,
    #     'cols': {'barcode': 1, 'product': 2, 'pack': 3, 'cost': 4, 'rsp': 5, 'gp': 6, 'period_start': 7},
    # },
}


def is_barcode(val):
    s = str(val or '').strip().split('.')[0]  # handle float barcodes
    return s.isdigit() and len(s) >= 8


def get_fill_color(cell):
    """Return ARGB hex string if cell has a solid fill, else None."""
    try:
        fill = cell.fill
        if fill and fill.fill_type == 'solid':
            c = fill.fgColor
            if c.type == 'rgb':
                rgb = c.rgb.upper()
                if rgb not in ('00000000', 'FFFFFFFF', 'FF000000'):
                    return rgb
    except Exception:
        pass
    return None


def map_activity(color_hex, cell_value=''):
    """Map fill color + cell value to activity key."""
    if color_hex and color_hex in ACTIVITY_COLORS:
        return ACTIVITY_COLORS[color_hex]
    val_str = str(cell_value or '').lower()
    if any(k in val_str for k in LOOKS_KEYWORDS):
        return 'looks'
    return None


def num(val):
    """Safely convert to float or None."""
    try:
        return float(val) if val is not None else None
    except (ValueError, TypeError):
        return None


def detect_header_row(rows, cfg_fallback):
    """Find the row index (0-based) containing 'Barcode' in the first few columns.
    Sheets in the same file can have headers on different rows (e.g. Tops VCAN row 9
    vs อาหารสัตว์ row 3), so we detect per-sheet instead of trusting one config value."""
    for ri, row in enumerate(rows[:20]):
        for ci in range(0, 4):
            if ci < len(row):
                v = row[ci].value
                if v is not None and str(v).strip().lower() == 'barcode':
                    return ri
    return cfg_fallback - 1  # fall back to config (1-indexed -> 0-indexed)


def looks_like_period(name, date_range):
    """Real periods are dates or month/cycle labels ('2603/04', 'Jan', 'SP6'). Junk
    columns from mis-structured sheets hold promo *values* ('75', 'buy 2 get 1',
    'Buy2 145') — reject pure numbers and promo-keyword strings."""
    n = str(name).strip().lower()
    if not n:
        return False
    # pure number (with optional decimal/comma) = a promo price, not a period
    if n.replace('.', '').replace(',', '').isdigit():
        return False
    # promo-deal wording leaked into a header
    if any(k in n for k in ('buy', 'get', 'free', 'แถม', 'ซื้อ')):
        return False
    return True


def parse_sheet(ws, cfg, retailer):
    """Parse one worksheet, return (products list, periods list)."""
    rows = list(ws.iter_rows(values_only=False))
    h = detect_header_row(rows, cfg['header_row'])
    if h >= len(rows):
        print(f'    (!)  Header row out of range (sheet has {len(rows)} rows)')
        return [], []

    header_row = rows[h]
    date_row = rows[h + 1] if h + 1 < len(rows) else []

    c = cfg['cols']
    ps = c['period_start'] - 1  # 0-indexed

    # Extract period column definitions from header row
    periods = []
    seen_names = set()
    for ci in range(ps, len(header_row)):
        cell = header_row[ci]
        val = cell.value
        if not val:
            continue
        name = str(val).strip()
        if not name or name.lower() in SKIP_HEADER_KEYWORDS:
            continue
        date_range = ''
        if ci < len(date_row) and date_row[ci].value:
            date_range = str(date_row[ci].value).strip()
        if not looks_like_period(name, date_range):
            continue  # skip junk columns (promo values, calc columns)
        if name in seen_names:
            name = f'{name}_{ci}'  # deduplicate
        seen_names.add(name)
        periods.append({'name': name, 'dateRange': date_range, 'colIdx': ci})

    # Parse product rows (skip header + date rows)
    products = []
    for row in rows[h + 2:]:
        if len(row) <= c['barcode'] - 1:
            continue
        bc_cell = row[c['barcode'] - 1]
        bc_val = bc_cell.value if bc_cell else None
        if not is_barcode(bc_val):
            continue

        # Normalize barcode
        barcode = str(int(float(str(bc_val).strip()))) if bc_val else ''
        if len(barcode) == 11:
            barcode = '0' + barcode
        if len(barcode) < 8:
            continue

        prod_cell = row[c['product'] - 1] if c['product'] - 1 < len(row) else None
        product = str(prod_cell.value or '').strip() if prod_cell else ''
        if not product or product.lower() in ('total', 'grand total'):
            continue

        pack_cell = row[c['pack'] - 1] if c['pack'] - 1 < len(row) else None
        pack = str(pack_cell.value or '').strip() if pack_cell else ''

        cost_cell = row[c['cost'] - 1] if c['cost'] - 1 < len(row) else None
        cost = num(cost_cell.value if cost_cell else None)

        rsp_cell = row[c['rsp'] - 1] if c['rsp'] - 1 < len(row) else None
        rsp_inc = num(rsp_cell.value if rsp_cell else None)
        rsp_ex = round(rsp_inc / 1.07, 4) if rsp_inc else None

        gp_cell = row[c['gp'] - 1] if c['gp'] - 1 < len(row) else None
        gp_raw = num(gp_cell.value if gp_cell else None)
        # GP stored as decimal (0.35) or percent (35) — normalize to decimal
        gp = gp_raw if gp_raw is not None and gp_raw <= 1.0 else (gp_raw / 100 if gp_raw else None)

        # Parse period cells
        period_data = {}
        for p in periods:
            ci = p['colIdx']
            if ci >= len(row):
                continue
            cell = row[ci]
            val = cell.value
            if val is None:
                continue
            if isinstance(val, str) and not val.strip():
                continue

            sale_price = None
            sale_label = None

            if isinstance(val, (int, float)):
                sale_price = float(val)
            elif isinstance(val, str):
                # Try numeric parse first
                v = num(val.replace(',', ''))
                if v is not None:
                    sale_price = v
                else:
                    sale_label = val.strip()  # e.g. "Buy2Get1", "3for499"

            color = get_fill_color(cell)
            act = map_activity(color, val)
            activities = [act] if act else []

            # Compensate = RSP_ex - (sale_price_inc / 1.07)
            compensate = None
            if sale_price is not None and rsp_ex is not None:
                compensate = round(rsp_ex - (sale_price / 1.07), 4)

            period_data[p['name']] = {
                'salePrice': sale_price,
                'saleLabel': sale_label,
                'activities': activities,
                'compensate': compensate,
            }

        if period_data:  # only include rows that have at least one promotional period
            products.append({
                'retailer': retailer,
                'barcode': barcode,
                'product': product,
                'brand': '',   # filled in by App.jsx via rawData barcode lookup
                'company': '',
                'packSize': pack,
                'rspExVat': rsp_ex,
                'rspIncVat': rsp_inc,
                'cost': cost,
                'gp': gp,
                'periods': period_data,
            })

    return products, periods


def main():
    all_products = []
    promo_meta = {}
    promo_retailers = []

    for retailer, cfg in CONFIG.items():
        fpath = BASE_DIR / cfg['file']
        if not fpath.exists():
            print(f'  (!)  Skipping {retailer}: not found at {fpath}')
            continue

        print(f'  Parsing {retailer}...')
        try:
            wb = openpyxl.load_workbook(fpath, read_only=False, data_only=True)
        except Exception as e:
            print(f'    FAIL Failed to open: {e}')
            continue

        sheets = cfg.get('sheets') or [wb.sheetnames[0]]
        retailer_periods = []
        retailer_products = []

        for sheet_name in sheets:
            if sheet_name not in wb.sheetnames:
                # Try first sheet as fallback
                print(f'    (!)  Sheet "{sheet_name}" not found — trying first sheet')
                sheet_name = wb.sheetnames[0]
            ws = wb[sheet_name]
            products, periods = parse_sheet(ws, cfg, retailer)
            retailer_products.extend(products)
            # Merge periods (union, preserve order)
            existing = {p['name'] for p in retailer_periods}
            for p in periods:
                if p['name'] not in existing:
                    retailer_periods.append({'name': p['name'], 'dateRange': p['dateRange']})
                    existing.add(p['name'])

        wb.close()

        if retailer_products:
            all_products.extend(retailer_products)
            promo_meta[retailer] = {'periods': retailer_periods}
            promo_retailers.append(retailer)
            print(f'    OK {len(retailer_products)} products, {len(retailer_periods)} periods')
        else:
            print(f'    (!)  No promo products found (check header_row in CONFIG)')

    # Write promo_data.js
    now = datetime.now().isoformat()
    js_lines = [
        '// Auto-generated by convert_promo.py — do not edit by hand.',
        f'// Generated: {now}',
        '',
        f'export const GENERATED_AT = {json.dumps(now)};',
        '',
        'export const PROMO_ACTIVITY = {',
        "  field: { label: 'ลงพื้นที่', color: '#06B6D4' },",
        "  media: { label: 'ลงสื่อ', color: '#A855F7' },",
        "  looks: { label: 'LOOKS Magazine', color: '#E879F9' },",
        '};',
        '',
        f'export const PROMO_RETAILERS = {json.dumps(promo_retailers)};',
        '',
        'export const PROMO_META = ' + json.dumps(promo_meta, ensure_ascii=False, indent=2) + ';',
        '',
        'const promoData = ' + json.dumps(all_products, ensure_ascii=False, indent=2) + ';',
        '',
        'export default promoData;',
    ]

    OUT.write_text('\n'.join(js_lines), encoding='utf-8')
    print(f'\nDone -- {len(all_products)} records across {len(promo_retailers)} retailers -> {OUT}')
    if not all_products:
        print('   Tip: If all retailers were skipped, check BASE_DIR path and CONFIG header_row values.')


if __name__ == '__main__':
    main()
