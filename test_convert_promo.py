from convert_promo import (
    build_notification_schedule,
    merge_retailer_refresh,
    parse_start_date,
)

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


def test_selective_refresh_preserves_other_retailers():
    existing_products = [
        {'retailer': 'Tops', 'barcode': '111', 'periods': {'T1': {'salePrice': 99}}},
        {'retailer': 'Watsons', 'barcode': 'old', 'periods': {'W1': {'salePrice': 1}}},
    ]
    existing_meta = {
        'Tops': {'periods': [{'name': 'T1', 'dateRange': '7/01-20/01/26'}]},
        'Watsons': {'periods': [{'name': 'W1', 'dateRange': 'old'}]},
    }
    existing_retailers = ['Tops', 'Watsons']
    refreshed_products = [
        {'retailer': 'Watsons', 'barcode': 'new', 'periods': {'2647/48': {'saleLabel': '2 For 699-'}}},
    ]
    refreshed_periods = [{'name': '2647/48', 'dateRange': '22/10/26 - 18/11/26'}]

    products, meta, retailers = merge_retailer_refresh(
        existing_products, existing_meta, existing_retailers,
        'Watsons', refreshed_products, refreshed_periods,
    )

    assert products[0] is existing_products[0]
    assert products[0]['periods'] == {'T1': {'salePrice': 99}}
    assert [p['barcode'] for p in products if p['retailer'] == 'Watsons'] == ['new']
    assert meta['Tops'] is existing_meta['Tops']
    assert meta['Watsons'] == {'periods': refreshed_periods}
    assert retailers == ['Tops', 'Watsons']

if __name__ == '__main__':
    test_parse_start_date(); test_build_schedule_filters_and_shapes(); test_selective_refresh_preserves_other_retailers(); print('OK')
