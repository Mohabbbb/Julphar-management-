#!/usr/bin/env python3
"""Seam 3 of docs/spec-stock-from-orders.md: the built page in headless Chromium, offline (embedded seed) mode.

Builds the page to a temp file, embeds t/fixture as the seed, and checks spec section 2 with stock entry
OFF (default) and ON (master/settings.stockEntry = true). Elements are found by visible text and roles,
and screens are reached through the page's own menu buttons.

Run from the repo root:  python3 t/page_test.py      (exit code 0 = all passed)
"""
import copy, datetime, glob, json, os, re, subprocess, sys, tempfile, traceback

from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FIXTURE = os.path.join(ROOT, 't', 'fixture')
SEED_TAG = '<script type="application/json" id="seed">{}</script>'
TODAY = datetime.datetime(2026, 10, 11, 9, 0, 0)
IGNORED_CONSOLE = ('ERR_TUNNEL_CONNECTION_FAILED', 'fonts.googleapis', 'fonts.gstatic')
SHORT = 4000  # ms: missing elements fail fast instead of hanging

# Which top-bar section holds each page (used only when the side menu is hidden, e.g. at 390 px)
SECTION_OF = {'Today': 'Today', 'New order': 'Sell', 'Orders': 'Sell', 'Reorder plan': 'Sell',
              'Stock': 'Stock', 'Import Excel': 'Stock', 'Accounts': 'Customers & prices',
              'Pricing': 'Customers & prices', 'Items': 'Customers & prices', 'Dashboard': 'Reports & data',
              'Targets': 'Reports & data', 'Data': 'Reports & data', 'How it works': 'Reports & data'}

OWN_ITEM = 'ADOL 500MG CAPL[2X12BL]SA-PVT'   # ITM004
# A leftover own-stock count from V43. With entry OFF nothing may show it; with entry ON V43 shows it.
LEFTOVER_COUNT = {'rows': [{'id': 'SM00001', 'type': 'COUNT', 'scope': 'own', 'itemId': 'ITM004', 'item': OWN_ITEM,
                            'qty': 40, 'date': '2026-10-05', 'ts': '2026-10-05T08:00:00.000Z',
                            'notes': 'counted before stock entry was hidden'}],
                  'schema': 1, 'updatedAt': '2026-10-05T08:00:00.000Z'}
OWN_STATUSES = ('Out', 'Short', 'Low', 'Will run short', 'Recount needed', 'Not tracked yet', 'OK')
CUSTOMERS_STOCK = re.compile(r"Customers['’]\s*stock", re.I)


# ---------------------------------------------------------------- data + build
def fixture_docs():
    docs = {}
    for f in sorted(glob.glob(os.path.join(FIXTURE, '*', '*.json'))):
        docs[os.path.basename(os.path.dirname(f)) + '/' + os.path.basename(f)[:-5]] = json.load(open(f, encoding='utf-8'))
    return docs


def build_page(tmpdir):
    out = os.path.join(tmpdir, 'built.html')
    subprocess.run([sys.executable, 'build.py', out], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)
    html = open(out, encoding='utf-8').read()
    assert html.count(SEED_TAG) == 1, 'built page must contain exactly one empty seed tag'
    return html


def seeded(html, docs, tmpdir, name):
    body = json.dumps(docs, ensure_ascii=False).replace('</', '<\\/')
    path = os.path.join(tmpdir, name + '.html')
    with open(path, 'w', encoding='utf-8') as f:
        f.write(html.replace(SEED_TAG, '<script type="application/json" id="seed">' + body + '</script>'))
    return path


# ---------------------------------------------------------------- page helpers
class Session:
    def __init__(self, browser, path, width=1280):
        self.ctx = browser.new_context(viewport={'width': width, 'height': 900})
        self.pg = self.ctx.new_page()
        self.pg.set_default_timeout(SHORT)
        self.errors = []
        self.pg.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        self.pg.on('console', lambda m: m.type == 'error' and not any(s in m.text for s in IGNORED_CONSOLE)
                   and self.errors.append('console: ' + m.text))
        self.pg.on('dialog', lambda d: d.dismiss())
        self.pg.clock.set_system_time(TODAY)
        self.pg.goto('file://' + path)
        self.pg.wait_for_function("!document.body.classList.contains('is-loading')", timeout=15000)
        self.pg.wait_for_timeout(300)

    @property
    def main(self):
        return self.pg.get_by_role('main')

    def text(self):
        """Rendered text of the current screen (innerText skips hidden views)."""
        return self.main.inner_text()

    def go(self, page_name):
        side = self.pg.get_by_role('navigation', name='Main menu').get_by_role('button', name=page_name, exact=True)
        if side.count() and side.first.is_visible():
            side.first.click()
        else:
            top = self.pg.get_by_role('navigation', name='Sections and pages')
            sec = SECTION_OF[page_name]
            top.get_by_role('group', name='Sections').get_by_role('button', name=sec, exact=True).click()
            top.get_by_role('group', name=sec + ' pages').get_by_role('button', name=page_name, exact=True).click()
        self.pg.wait_for_timeout(250)

    def visible(self, locator):
        return [locator.nth(i) for i in range(locator.count()) if locator.nth(i).is_visible()]

    def buttons(self, name, exact=False):
        return self.visible(self.main.get_by_role('button', name=name, exact=exact))

    def open_customers_stock(self, account):
        """Stock -> Customers' stock (a tab or button if there is one) -> pick the account."""
        self.go('Stock')
        for role in ('tab', 'button'):
            t = self.visible(self.main.get_by_role(role, name=CUSTOMERS_STOCK))
            if t:
                t[0].click()
                self.pg.wait_for_timeout(250)
                break
        pick = self.visible(self.main.get_by_label(re.compile(r'account', re.I)))
        pick = [p for p in pick if p.evaluate('e => e.tagName') == 'SELECT'] or self.visible(self.main.get_by_role('combobox'))
        assert pick, 'no account picker in the Stock section'
        pick[0].select_option(label=account)
        self.pg.wait_for_timeout(300)

    def item_row(self, item_text):
        rows = self.visible(self.main.get_by_role('row').filter(has_text=item_text))
        assert rows, 'no table row for ' + item_text
        return rows[0]

    def stock_tabs(self):
        """Click through every visible tab of the Stock screen, yielding after each (or once if no tabs)."""
        self.go('Stock')
        names = [t.inner_text().strip() for t in self.visible(self.main.get_by_role('tab'))]
        if not names:
            yield '(no tabs)'
            return
        for n in names:
            self.visible(self.main.get_by_role('tab', name=n, exact=True))[0].click()
            self.pg.wait_for_timeout(250)
            yield n

    def item_boxes(self):
        """Order line item inputs. They carry a suggestion list, so their role is combobox, not textbox."""
        return self.visible(self.main.get_by_label('Item name', exact=True))

    def order_line(self, account, item, qty):
        """New order screen: pick the account and fill the first line."""
        self.visible(self.main.get_by_label('Account', exact=True))[0].select_option(label=account)
        self.item_boxes()[0].fill(item)
        self.visible(self.main.get_by_role('spinbutton', name='Quantity'))[0].fill(str(qty))

    def stored_writes(self):
        return self.pg.evaluate("localStorage.getItem('jsp40-local-docs')")

    def close(self):
        self.ctx.close()


def ci(s):
    return s.lower().replace('’', "'")


# ---------------------------------------------------------------- tests
TESTS = []


def test(scenario):
    def deco(fn):
        TESTS.append((scenario, fn))
        return fn
    return deco


# ---- OFF (default): fixture + one leftover own count, no stockEntry flag ----
@test('off')
def dashboard_shows_executed_net_721_249_04_from_499_order_lines(s):
    s.go('Dashboard')
    t = s.text()
    assert '721,249.04' in t, 'executed net 721,249.04 not on Dashboard'
    assert re.search(r'\b499 order lines\b', t), '"499 order lines" not on Dashboard'


@test('off')
def stock_screen_has_nowhere_to_type_or_save_stock(s):
    for tab in s.stock_tabs():
        assert not s.visible(s.main.get_by_role('spinbutton')), 'number input on Stock tab ' + tab
        boxes = [b for b in s.visible(s.main.locator('input:not([type=search]):not([type=checkbox]):not([type=radio])'))
                 if b.get_attribute('type') not in ('search',)]
        assert not boxes, 'text/number input on Stock tab %s: %s' % (tab, [b.get_attribute('aria-label') for b in boxes])
        for name in ('Save', 'Save all changed', 'Count', 'Adjust'):
            assert not s.buttons(name, exact=True), '"%s" button on Stock tab %s' % (name, tab)
        t = ci(s.text())
        for words in ('receive a delivery', 'receive stock', 'record a count', 'set up', 'opening quantit', 'save all changed'):
            assert words not in t, '"%s" on Stock tab %s' % (words, tab)


@test('off')
def own_stock_is_one_plain_line_saying_it_is_not_tracked(s):
    s.go('Stock')
    t = s.text()
    assert "your own stock isn't tracked — stock entry is switched off." in ci(t), 'own-stock line missing'
    for words in ('you have', 'on hand', 'reserved', 'my stock'):
        assert words not in ci(t), '"%s" shown on the Stock screen' % words


@test('off')
def own_stock_shows_no_stock_statuses(s):
    # a stock status is a badge/cell whose whole text is the status word
    for tab in s.stock_tabs():
        for word in OWN_STATUSES:
            assert not s.visible(s.main.get_by_text(word, exact=True)), 'stock status "%s" on Stock tab %s' % (word, tab)
        assert not re.search(r'Needs attention|Will run short|Recount needed', s.text()), 'stock attention filter on Stock tab ' + tab


@test('off')
def customers_stock_table_has_the_spec_columns(s):
    s.open_customers_stock('Al-Falah')
    t = ci(s.text())
    for col in ('item', 'last order', 'last qty', 'usual gap', 'est. left now', 'runs out', 'expected order'):
        assert col in t, 'column "%s" missing' % col


@test('off')
def customers_stock_al_falah_3v_inj_shows_last_qty_300_gap_69_and_0_left(s):
    # Last order 300 on 2026-02-16, usual gap 69 -> ran out 2026-04-26 (Expected order lapsed)
    s.open_customers_stock('Al-Falah')
    cells = [c.inner_text().strip() for c in s.item_row('3V INJ').get_by_role('cell').all()]
    assert '300' in cells, 'Last qty 300 not in row %s' % cells
    assert any(re.fullmatch(r'69( days?)?', c) for c in cells), 'Usual gap 69 not in row %s' % cells
    assert '0' in cells, 'Est. left now 0 not in row %s' % cells
    assert any(('2026' in c) and re.search(r'(26|Apr|04)', c) for c in cells), 'run-out / expected 2026-04-26 not in row %s' % cells


@test('off')
def customers_stock_dallah_butalin_neb_shows_266_left_of_1000(s):
    # 1000 on 2026-09-08, gap 45 -> floor(1000 - 1000/45 x 33) = 266, runs out 2026-10-23
    s.open_customers_stock('Dallah Clinics')
    cells = [c.inner_text().strip() for c in s.item_row('BUTALIN 0.5% SOL NEB').get_by_role('cell').all()]
    assert any(c.replace(',', '') == '1000' for c in cells), 'Last qty 1,000 not in row %s' % cells
    assert '266' in cells, 'Est. left now 266 not in row %s' % cells


@test('off')
def customers_stock_items_without_an_estimate_show_a_dash_and_not_enough_orders_yet_never_0(s):
    # Dawaak has only opening snapshot lines: no Expected orders, so no estimates
    s.open_customers_stock('Dawaak')
    t = s.text()
    assert 'Not enough orders yet' in t, 'note "Not enough orders yet" missing'
    data = s.visible(s.main.locator('table tbody tr'))  # item rows only, not the column headings
    assert data, 'no item rows for Dawaak'
    for r in data:
        cells = [c.inner_text().strip() for c in r.get_by_role('cell').all()]
        assert '—' in cells or any('—' in c for c in cells), 'no "—" in row %s' % cells
        assert '0' not in cells, 'a 0 shown for an item with no estimate: %s' % cells


@test('off')
def import_offers_orders_items_and_deals_only(s):
    s.go('Import Excel')
    for name in ('Orders', 'Items & prices', 'Deals'):
        assert s.buttons(re.compile(r'^\s*' + re.escape(name))), 'import type "%s" missing' % name
    assert not s.buttons(re.compile(r'stock count', re.I)), '"Stock counts" import type is offered'
    assert 'stock count' not in ci(s.text()), '"Stock counts" text on the import screen'


@test('off')
def import_has_no_stock_count_template(s):
    s.go('Import Excel')
    assert s.buttons('Orders', exact=True), 'Orders template link missing (template list not found)'
    assert not s.buttons('Stock', exact=True), 'a "Stock" template is offered'
    assert not s.visible(s.main.get_by_role('link', name=re.compile(r'stock', re.I))), 'a stock template link is offered'


@test('off')
def today_has_no_stock_tile_and_no_stock_or_count_alerts(s):
    s.go('Today')
    t = ci(s.text())
    for words in ('stock alert', 'start tracking stock', 'receive stock', 'out of stock', 'will run short', 'recount'):
        assert words not in t, '"%s" on Today' % words
    for name in ('Receive stock', 'Count', 'Receive a delivery'):
        assert not s.buttons(name, exact=True), '"%s" button on Today' % name


@test('off')
def today_still_shows_expected_orders_and_draft_order_fills_a_new_order(s):
    s.go('Today')
    assert 'expected orders' in ci(s.text()), 'Expected orders missing on Today'
    drafts = s.buttons('Draft order', exact=True)
    assert drafts, 'no Draft order button on Today'
    drafts[0].click()
    s.pg.wait_for_timeout(400)
    items = [b.input_value() for b in s.item_boxes()]
    assert any(v.strip() for v in items), 'Draft order did not fill any order line'


@test('off')
def browsing_every_screen_writes_nothing(s):
    for p in ('Today', 'Stock', 'Import Excel', 'Dashboard', 'How it works', 'Reorder plan', 'Data'):
        s.go(p)
    assert s.stored_writes() in (None, '{}'), 'the page wrote data while browsing: %s' % (s.stored_writes() or '')[:200]


@test('off')
def order_builder_shows_no_stock_hint(s):
    s.go('New order')
    s.order_line('Adwaa Nimar', OWN_ITEM, 10)
    s.pg.wait_for_timeout(300)
    t = s.text()
    assert 'Stock:' not in t and 'left after this order' not in t, 'stock hint shown in the order builder'


@test('off')
def saved_order_card_shows_no_stock(s):
    s.go('New order')
    s.order_line('Adwaa Nimar', OWN_ITEM, 10)
    s.pg.wait_for_timeout(200)
    s.buttons('Save order', exact=True)[0].click()
    s.pg.get_by_text(re.compile(r'Order saved')).first.wait_for(timeout=SHORT)
    s.pg.wait_for_timeout(300)
    t = ci(s.text())
    assert 'stock after this order' not in t and 'on hand' not in t, 'stock shown on the saved-order card'


@test('off')
def how_it_works_says_stock_comes_from_orders_and_entry_is_switched_off(s):
    s.go('How it works')
    t = ci(s.text())
    assert 'last order' in t and 'usual gap' in t, 'guide does not explain stock as last order + usual gap'
    assert 'stock entry is switched off' in t, 'guide does not say stock entry is switched off'
    for old in ('type a count, press save', 'your last count', 'you have ='):
        assert old not in t, 'guide still describes typed stock: "%s"' % old


@test('off')
def no_page_errors_with_stock_entry_off(s):
    for p in ('Today', 'Stock', 'Import Excel', 'Dashboard', 'How it works', 'New order'):
        s.go(p)
    s.open_customers_stock('Al-Falah')
    assert not s.errors, '\n'.join(s.errors)


# ---- OFF when the flag is anything but true ----
@test('off_string')
def stock_entry_flag_other_than_true_keeps_entry_off(s):
    s.go('Stock')
    assert not s.buttons(re.compile(r'Receive a delivery|Save all changed')), 'stock entry shown with stockEntry: "true" (string)'
    s.go('Import Excel')
    assert not s.buttons(re.compile(r'stock count', re.I)), '"Stock counts" offered with stockEntry: "true" (string)'


# ---- 390 px ----
@test('narrow')
def stock_section_has_no_horizontal_scroll_at_390px(s):
    s.go('Stock')
    w = s.pg.evaluate('document.documentElement.scrollWidth')
    assert w <= 390, 'Stock screen scrollWidth %d > 390' % w
    s.open_customers_stock('Al-Falah')
    w = s.pg.evaluate('document.documentElement.scrollWidth')
    assert w <= 390, "Customers' stock table scrollWidth %d > 390" % w
    assert not s.errors, '\n'.join(s.errors)


# ---- ON: stockEntry true -> V43 behaviour ----
@test('on')
def on_stock_screen_has_count_inputs_and_entry_buttons(s):
    s.go('Stock')
    assert s.visible(s.main.get_by_role('spinbutton')), 'no count inputs with stock entry on'
    assert s.buttons('Receive a delivery', exact=True), 'no Receive a delivery'
    assert s.buttons('Save all changed', exact=True), 'no Save all changed'


@test('on')
def on_customers_stock_has_record_a_count(s):
    s.open_customers_stock('Al-Falah')
    assert s.buttons('Record a count', exact=True), 'no Record a count'


@test('on')
def on_import_offers_stock_counts_and_its_template(s):
    s.go('Import Excel')
    assert s.buttons(re.compile(r'Stock counts')), 'no "Stock counts" import type'
    assert s.buttons('Stock', exact=True), 'no Stock template'


@test('on')
def on_today_has_the_stock_tile(s):
    s.go('Today')
    assert 'stock alert' in ci(s.text()), 'no stock tile on Today'


@test('on')
def on_order_builder_shows_the_stock_hint(s):
    s.go('New order')
    s.order_line('Adwaa Nimar', OWN_ITEM, 10)
    s.pg.wait_for_timeout(300)
    assert 'Stock:' in s.text(), 'no stock hint with stock entry on'


@test('on')
def on_dashboard_and_no_page_errors(s):
    s.go('Dashboard')
    assert '721,249.04' in s.text()
    for p in ('Today', 'Stock', 'Import Excel', 'How it works'):
        s.go(p)
    assert not s.errors, '\n'.join(s.errors)


# ---------------------------------------------------------------- runner
def main():
    base = fixture_docs()
    off = copy.deepcopy(base)
    off['stock/2026-10'] = LEFTOVER_COUNT
    on = copy.deepcopy(off)
    on['master/settings']['stockEntry'] = True
    off_string = copy.deepcopy(off)
    off_string['master/settings']['stockEntry'] = 'true'

    failures = 0
    with tempfile.TemporaryDirectory() as tmp:
        html = build_page(tmp)
        paths = {'off': seeded(html, off, tmp, 'off'), 'on': seeded(html, on, tmp, 'on'),
                 'off_string': seeded(html, off_string, tmp, 'off_string'), 'narrow': seeded(html, base, tmp, 'narrow')}
        browser = None
        with sync_playwright() as p:
            try:
                browser = p.chromium.launch()
            except Exception:
                os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
                browser = p.chromium.launch()
            for scenario, fn in TESTS:
                s = None
                try:
                    s = Session(browser, paths[scenario], width=390 if scenario == 'narrow' else 1280)
                    fn(s)
                    print('ok     [%s] %s' % (scenario, fn.__name__))
                except Exception as e:
                    failures += 1
                    msg = str(e).strip().splitlines()[0] if str(e).strip() else type(e).__name__
                    print('FAIL   [%s] %s\n         %s' % (scenario, fn.__name__, msg[:300]))
                    if os.environ.get('VERBOSE'):
                        traceback.print_exc()
                finally:
                    if s:
                        s.close()
            browser.close()
    print('page tests: %d passed, %d failed, %d total' % (len(TESTS) - failures, failures, len(TESTS)))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
