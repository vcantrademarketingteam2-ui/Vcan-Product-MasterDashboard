from convert_promo import parse_start_date, build_notification_schedule

def test_parse_start_date():
    assert parse_start_date('7/01-20/01/26') == '2026-01-07'
    assert parse_start_date('1/12-15/12/2026') == '2026-12-01'
    assert parse_start_date('Jan') is None
    assert parse_start_date('SP6') is None
    assert parse_start_date('') is None
    assert parse_start_date(None) is None

def test_build_schedule_filters_and_shapes():
    promo_meta = {'Tops': {'periods': [
        {'name': 'P1', 'dateRange': '7/01-20/01/26'},   # has activity -> kept
        {'name': 'P2', 'dateRange': '8/02-20/02/26'},   # no activity -> dropped
        {'name': 'P3', 'dateRange': 'Jan'},             # unparseable -> dropped
    ]}}
    products = [
        {'retailer': 'Tops', 'barcode': '111', 'brand': '',
         'periods': {'P1': {'activities': ['media']}, 'P2': {'activities': []}}},
    ]
    sched = build_notification_schedule(promo_meta, products, {'111': 'Sundae'})
    assert len(sched) == 1
    e = sched[0]
    assert e['retailer'] == 'Tops' and e['period'] == 'P1'
    assert e['startDate'] == '2026-01-07'
    assert e['activities'] == ['media'] and e['brands'] == ['Sundae']

if __name__ == '__main__':
    test_parse_start_date(); test_build_schedule_filters_and_shapes(); print('OK')
