#!/usr/bin/env python3
"""Seam 3 of docs/spec-stock-from-orders.md: the built page in headless Chromium, offline (embedded seed) mode.

Builds the page to a temp file and embeds t/fixture as the seed. Checks the published order-driven
Stock view with entry OFF and the restored manual controls with entry ON, audit failure recovery,
and order/import agreement on the newest active deal. Elements are found by visible text and roles,
and screens are reached through the page's own menu buttons.

Run from the repo root:  python3 t/page_test.py      (exit code 0 = all passed)
Optional environment: JULPHAR_TEST_BROWSER (Chrome executable), JULPHAR_TEST_FILTER (test-name regex),
JULPHAR_TEST_SCREENSHOT (offline Stock settings screenshot path, saved after successful tests).
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
CUSTOMERS_STOCK = re.compile(r"Customers?['’]?\s*stock", re.I)


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
        search = self.visible(self.main.get_by_label('Search customer or item', exact=True))
        if search:
            search[0].fill(account)
            self.pg.wait_for_timeout(250)
            return
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
def stock_preserves_prepare_and_customer_stock_without_own_stock_numbers(s):
    s.go('Stock')
    t = s.text()
    assert 'what to prepare' in ci(t) and 'customer stock' in ci(t), 'published stock sections missing'
    assert re.search(r'stock entry\s+off', ci(t)), 'stock-entry state missing'
    totals = s.main.locator('#osTotals').inner_text()
    assert '11 items' in totals and '1,873 units' in totals, 'prepare totals changed: ' + totals
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
def customers_stock_table_preserves_published_columns(s):
    s.open_customers_stock('Dallah Clinics')
    t = ci(s.main.locator('#osCust thead').inner_text())
    for col in ('customer', 'item', 'last order', 'likely left', 'days left', 'reorder by', 'status'):
        assert col in t, 'column "%s" missing' % col


@test('off')
def stopped_ordering_shows_al_falah_3v_inj_last_qty_300_and_0_left(s):
    # Last order 300 on 2026-02-16, usual gap 69 -> ran out 2026-04-26 (Expected order lapsed)
    s.open_customers_stock('Al-Falah')
    assert not s.visible(s.main.locator('#osCust tbody tr').filter(has_text='3V INJ')), 'lapsed item appears before Stopped ordering is selected'
    s.buttons(re.compile(r'^Stopped ordering'))[0].click()
    cells = [c.inner_text().strip() for c in s.item_row('3V INJ').get_by_role('cell').all()]
    assert any(re.search(r'\b300\b', c) for c in cells), 'Last qty 300 not in row %s' % cells
    assert '0' in cells, 'Est. left now 0 not in row %s' % cells
    assert any(('2026' in c) and re.search(r'(26|Apr|04)', c) for c in cells), 'run-out / expected 2026-04-26 not in row %s' % cells


@test('off')
def customers_stock_dallah_butalin_neb_shows_266_left_of_1000(s):
    # 1000 on 2026-09-08, gap 45 -> floor(1000 - 1000/45 x 33) = 266, runs out 2026-10-23
    s.open_customers_stock('Dallah Clinics')
    cells = [c.inner_text().strip() for c in s.item_row('BUTALIN 0.5% SOL NEB').get_by_role('cell').all()]
    assert any('1,000' in c for c in cells), 'Last qty 1,000 not in row %s' % cells
    assert '266' in cells, 'Est. left now 266 not in row %s' % cells


@test('off')
def customers_without_ordering_rhythm_have_no_invented_stock_rows(s):
    # Dawaak has only opening snapshot lines: no Expected orders, so no estimates
    s.open_customers_stock('Dawaak')
    t = s.text()
    assert 'No customers match' in t, 'missing empty result for opening-snapshot-only account'
    assert not s.visible(s.main.locator('#osCust tbody tr')), 'invented estimate for Dawaak'


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
def today_has_prepare_totals_and_no_manual_stock_or_count_alerts(s):
    s.go('Today')
    t = ci(s.text())
    tile = s.main.locator('#tdStk').inner_text()
    assert 'to prepare (30 days)' in ci(tile) and '11 items' in ci(tile) and '1,873 units' in ci(tile), 'prepare tile changed: ' + tile
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
def how_it_works_explains_order_based_prepare_and_customer_stock(s):
    s.go('How it works')
    t = ci(s.text())
    assert 'last order' in t and 'usual gap' in t, 'guide does not explain stock as last order + usual gap'
    assert 'what to prepare' in t and 'likely left' in t and 'only from your orders' in t, 'guide does not explain published stock calculation'
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



# ---- Switching stock entry from the Stock screen (owner request 11 Oct 2026) ----
SE_BUTTON = 'Stock entry settings'


def open_stock_entry_dialog(s):
    s.go('Stock')
    btn = s.buttons(SE_BUTTON, exact=True)
    assert btn, '"%s" button missing on the Stock screen' % SE_BUTTON
    btn[0].click()
    dlg = s.pg.get_by_role('dialog')
    dlg.wait_for(timeout=SHORT)
    return dlg


def stored_settings_and_audit(s):
    raw = s.stored_writes()
    docs = json.loads(raw) if raw else {}
    settings = docs.get('master/settings') or {}
    audit = [r for k, v in docs.items() if k.startswith('audit/') for r in (v.get('rows') or [])]
    return settings, audit


@test('off')
def stock_entry_button_explains_what_turning_it_on_adds(s):
    dlg = open_stock_entry_dialog(s)
    t = ci(dlg.inner_text())
    assert 'switched off' in t, 'dialog does not say stock entry is off'
    for words in ('count', 'receive', 'import', 'nothing is deleted'):
        assert words in t, 'dialog does not mention "%s"' % words
    assert dlg.get_by_role('button', name='Turn stock entry on', exact=True).count() == 1


@test('off')
def cancelling_the_stock_entry_dialog_writes_nothing(s):
    dlg = open_stock_entry_dialog(s)
    dlg.get_by_role('button', name='Cancel', exact=True).click()
    s.pg.wait_for_timeout(300)
    assert s.stored_writes() in (None, '{}'), 'cancel wrote data: %s' % (s.stored_writes() or '')[:200]
    assert not s.visible(s.main.get_by_role('spinbutton')), 'stock entry appeared after Cancel'


@test('off')
def turning_stock_entry_on_shows_entry_saves_the_setting_and_an_audit_row(s):
    dlg = open_stock_entry_dialog(s)
    dlg.get_by_role('button', name='Turn stock entry on', exact=True).click()
    s.pg.get_by_role('dialog').wait_for(state='hidden', timeout=SHORT)
    s.pg.wait_for_timeout(400)
    s.go('Stock')
    assert s.visible(s.main.get_by_role('spinbutton')), 'no count boxes after turning stock entry on'
    settings, audit = stored_settings_and_audit(s)
    assert settings.get('stockEntry') is True, 'settings.stockEntry not saved as true: %s' % settings
    rows = [r for r in audit if r.get('field') == 'stockEntry']
    assert rows and str(rows[-1].get('new')) in ('true', 'True', 'on', 'On'), 'no audit row for the switch: %s' % audit[-3:]
    s.go('Import Excel')
    assert 'stock counts' in ci(s.text()), 'Import does not offer Stock counts after turning entry on'


@test('on')
def turning_stock_entry_off_hides_entry_again_and_keeps_counts(s):
    dlg = open_stock_entry_dialog(s)
    assert 'switched on' in ci(dlg.inner_text()), 'dialog does not say stock entry is on'
    dlg.get_by_role('button', name='Turn stock entry off', exact=True).click()
    s.pg.get_by_role('dialog').wait_for(state='hidden', timeout=SHORT)
    s.pg.wait_for_timeout(400)
    s.go('Stock')
    assert 'what to prepare' in ci(s.text()) and 'customer stock' in ci(s.text()), 'published stock view not restored after turning entry off'
    assert not s.visible(s.main.get_by_role('spinbutton')), 'count boxes still shown after turning entry off'
    settings, audit = stored_settings_and_audit(s)
    assert settings.get('stockEntry') is False, 'settings.stockEntry not saved as false: %s' % settings
    docs = json.loads(s.stored_writes())
    assert not any(k.startswith('stock/') for k in docs), 'turning entry off wrote stock documents'


@test('narrow')
def stock_entry_button_fits_a_phone_screen(s):
    s.go('Stock')
    btn = s.buttons(SE_BUTTON, exact=True)
    assert btn, 'button missing at 390 px'
    box = btn[0].bounding_box()
    assert box and box['x'] >= 0 and box['x'] + box['width'] <= 390, 'button off screen: %s' % box
    assert s.pg.evaluate('document.documentElement.scrollWidth <= window.innerWidth'), 'page scrolls sideways'


@test('off')
def switch_roundtrip_preserves_settings_counts_and_one_audit_per_change(s):
    original = fixture_docs()['master/settings']
    for label, expected in [('Turn stock entry on', True), ('Turn stock entry off', False)]:
        dlg = open_stock_entry_dialog(s)
        dlg.get_by_role('button', name=label, exact=True).click()
        dlg.wait_for(state='hidden', timeout=SHORT)
        settings, audit = stored_settings_and_audit(s)
        assert settings['stockEntry'] is expected
        for key, value in original.items():
            if key not in ('updatedAt', 'stockEntry'):
                assert settings.get(key) == value, 'unrelated setting changed: ' + key
    rows = [r for r in audit if r.get('field') == 'stockEntry']
    assert [(r['old'], r['new']) for r in rows] == [('false', 'true'), ('true', 'false')], rows
    assert not any(k.startswith('stock/') for k in json.loads(s.stored_writes())), 'switch wrote stock data'
    s.go('Stock')
    assert 'what to prepare' in ci(s.text()) and not s.visible(s.main.get_by_role('spinbutton'))
    # Reload checks persistence, not merely the transient screen.
    s.pg.reload()
    s.pg.wait_for_function("!document.body.classList.contains('is-loading')")
    s.go('Stock')
    assert not s.visible(s.main.get_by_role('spinbutton'))
    s.go('Dashboard')
    assert '721,249.04' in s.text() and '499 order lines' in s.text()


@test('off')
def failed_audit_stays_visible_and_retry_only_saves_missing_history(s):
    # Fail one audit storage write after settings succeeded, as a full local disk would.
    # Instrument the public storage boundary, not application internals.
    s.pg.evaluate("""() => {
      const original = Storage.prototype.setItem;
      window.testWrites = [];
      let failed = false;
      Storage.prototype.setItem = function(key, value) {
        if (key === 'jsp40-local-docs') {
          const body = JSON.parse(value);
          const hasAudit = Object.keys(body).some(k => k.startsWith('audit/'));
          window.testWrites.push({hasAudit, settings: body['master/settings']});
          if (hasAudit && !failed) {
            failed = true;
            throw new DOMException('Audit storage is full', 'QuotaExceededError');
          }
        }
        return original.call(this, key, value);
      };
    }""")
    dlg = open_stock_entry_dialog(s)
    dlg.get_by_role('button', name='Turn stock entry on', exact=True).click()
    retry = dlg.get_by_role('button', name='Retry saving history', exact=True)
    retry.wait_for(timeout=SHORT)
    assert 'history could not be saved' in dlg.inner_text()
    assert 'setting will not be changed again' in dlg.inner_text()
    settings, audit = stored_settings_and_audit(s)
    assert settings['stockEntry'] is True and not audit
    saved_timestamp = settings['updatedAt']
    assert not s.pg.locator('#toast.good').is_visible(), 'partial save reported success'
    retry.click()
    dlg.wait_for(state='hidden', timeout=SHORT)
    settings, audit = stored_settings_and_audit(s)
    rows = [r for r in audit if r.get('field') == 'stockEntry']
    assert len(rows) == 1 and rows[0]['old'] == 'false' and rows[0]['new'] == 'true', rows
    assert settings['updatedAt'] == saved_timestamp, 'retry rewrote settings'
    writes = s.pg.evaluate('window.testWrites')
    assert sum(not w['hasAudit'] for w in writes) == 1, 'more than one settings-only write'
    assert len(writes) == 3, 'expected settings, rejected audit, successful retry: %s' % writes
    assert not s.errors, '\n'.join(s.errors)


@test('pricing')
def newest_active_deal_prices_order_and_import_identically_without_writes(s):
    # Newest 50% deal is first; an older 20% deal occurs last. RSP 5.05 × 10 × 50% = 25.25.
    s.go('New order')
    s.order_line('Adwaa Nimar', OWN_ITEM, 10)
    net = s.visible(s.main.locator('.ro-net .ro-val'))[0].inner_text()
    assert net == '25.25', 'newest-deal builder net should be 25.25, got ' + net
    rate = s.visible(s.main.locator('.li-disc'))[0].get_attribute('placeholder')
    assert rate == '50.00', 'newest-deal builder discount should be 50.00, got ' + str(rate)
    s.go('Import Excel')
    s.main.get_by_role('group', name='What are you importing?').get_by_role('button', name=re.compile(r'^Orders')).click()
    csv = 'Date,Account,Item,Qty\n2026-10-11,Adwaa Nimar,' + OWN_ITEM + ',10\n'
    s.main.get_by_label('Excel (.xlsx) or CSV file').set_input_files(
        {'name': 'pricing-consistency.csv', 'mimeType': 'text/csv', 'buffer': csv.encode()})
    s.buttons('Next: check the rows', exact=True)[0].click()
    row = s.main.locator('#impTable tbody tr')
    row.wait_for(timeout=SHORT)
    text = row.inner_text()
    assert '50%' in text and '25.25 SAR' in text and 'Account deal' in text, text
    assert s.stored_writes() in (None, '{}'), 'pricing preview wrote data'
    s.go('Data')
    check = s.main.get_by_role('heading', name=re.compile(r'^Data check')).locator('..')
    assert 'ALL CHECKS PASSED' in check.inner_text(), 'valid overlapping deals block Data check'
    assert 'Additional Active deals (advisory)' in check.inner_text()
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
    pricing = copy.deepcopy(off)
    deal_doc = pricing['deals/ACC03']
    deal_doc['rows'] = [row for row in deal_doc['rows'] if row.get('itemId') != 'ITM004']
    for ident, start, pct in [('TEST_NEW', '2026-10-01', 0.5), ('TEST_OLD', '2026-01-01', 0.2)]:
        deal_doc['rows'].append({'id': ident, 'account': 'Adwaa Nimar', 'item': OWN_ITEM,
                                 'itemId': 'ITM004', 'status': 'Active', 'pct': pct,
                                 'from': start, 'updated': start, 'to': None})

    failures = 0
    selected = [(scenario, fn) for scenario, fn in TESTS
                if not os.environ.get('JULPHAR_TEST_FILTER') or re.search(os.environ['JULPHAR_TEST_FILTER'], fn.__name__)]
    if not selected:
        raise ValueError('JULPHAR_TEST_FILTER matched no tests')
    with tempfile.TemporaryDirectory() as tmp:
        html = build_page(tmp)
        paths = {'off': seeded(html, off, tmp, 'off'), 'on': seeded(html, on, tmp, 'on'),
                 'off_string': seeded(html, off_string, tmp, 'off_string'), 'narrow': seeded(html, base, tmp, 'narrow'),
                 'pricing': seeded(html, pricing, tmp, 'pricing')}
        browser = None
        with sync_playwright() as p:
            try:
                executable = os.environ.get('JULPHAR_TEST_BROWSER')
                browser = p.chromium.launch(**({'executable_path': executable} if executable else {}))
            except Exception:
                if executable:
                    raise
                os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
                browser = p.chromium.launch()
            for scenario, fn in selected:
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
            screenshot = os.environ.get('JULPHAR_TEST_SCREENSHOT')
            if screenshot and not failures:
                s = Session(browser, paths['off'])
                open_stock_entry_dialog(s)
                os.makedirs(os.path.dirname(os.path.abspath(screenshot)), exist_ok=True)
                s.pg.screenshot(path=screenshot, full_page=False)
                s.close()
            browser.close()
    print('page tests: %d passed, %d failed, %d total' % (len(selected) - failures, failures, len(selected)))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
