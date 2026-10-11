#!/usr/bin/env python3
"""Regression tests for the 2026-10-11 fixes (F1-F6): the built page in headless Chromium, offline (embedded seed) mode.
Failures are injected by wrapping Store.put / Store.status in the page.

Run from the repo root:  python3 t/fixes_test.py      (exit code 0 = all passed)
Optional environment: JULPHAR_TEST_FILTER (test-name regex), VERBOSE=1 (tracebacks)
"""
import copy, json, os, re, sys, tempfile, traceback
os.environ.setdefault('PLAYWRIGHT_BROWSERS_PATH', '/opt/pw-browsers')
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import page_test as T
from playwright.sync_api import sync_playwright

NET = 721249.04
TESTS = []


def test(fn):
    TESTS.append(fn)
    return fn


def exec_net(s):
    return round(s.pg.evaluate("""(function(){var n=0;Object.keys(Store.all()).forEach(function(p){if(/^orders\\//.test(p))(Store.all()[p].rows||[]).forEach(function(r){if(r.status==='Executed')n+=r.net||0;});});return n;})()"""), 2)


def rows_with_id(s, rid):
    return s.pg.evaluate("""(function(id){var out=[];Object.keys(Store.all()).forEach(function(p){if(/^orders\\//.test(p))(Store.all()[p].rows||[]).forEach(function(r){if(r.id===id)out.push(p);});});return out;})(%r)""" % rid)


def audit_count(s):
    return s.pg.evaluate("""(function(){var n=0;Object.keys(Store.all()).forEach(function(p){if(/^audit\\//.test(p))n+=(Store.all()[p].rows||[]).length;});return n;})()""")


def fail_puts(s, regex, times=1):
    """Make the next `times` Store.put calls whose path matches regex reject (nothing is written)."""
    s.pg.evaluate("""(function(a){if(!window.__origPut)window.__origPut=Store.put;window.__failLeft=a[1];
      Store.put=function(p,b,e){if(window.__failLeft>0&&new RegExp(a[0]).test(p)){window.__failLeft--;var x=new Error('boom');x.code='unavailable';return Promise.reject(x);}
        return window.__origPut.apply(Store,arguments);};})(%s)""" % ('[%r,%d]' % (regex, times)))


def open_edit(s, rid):
    s.go('Orders')
    s.pg.fill('#ovSearch', rid)
    s.pg.wait_for_timeout(300)
    if not s.pg.locator('[data-oedit=%s]' % rid).first.is_visible():
        s.pg.click('.og-row')
    s.pg.click('[data-oedit=%s]' % rid)
    s.pg.wait_for_selector('#dlgHost .md')


def msg(s):
    return s.pg.evaluate("document.getElementById('mdMsg')?document.getElementById('mdMsg').textContent:'(closed)'")


MOCK_DB = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mock_db.js'), encoding='utf-8').read()


class DbSession(T.Session):
    """Same page, but talking to the in-browser mock database (t/mock_db.js) seeded with the fixture.
    fail_cols = collections whose listener reports an error (a partly failed load)."""
    def __init__(self, browser, path, docs, fail_cols=(), width=1280):
        self.ctx = browser.new_context(viewport={'width': width, 'height': 900}, accept_downloads=True)
        self.ctx.add_init_script("window.__failCols=%s;try{localStorage.setItem('mockdb',%s)}catch(e){}" % (json.dumps(list(fail_cols)), json.dumps(json.dumps(docs))) + MOCK_DB)
        self.pg = self.ctx.new_page()
        self.pg.set_default_timeout(T.SHORT)
        self.errors = []
        self.pg.on('pageerror', lambda e: self.errors.append('pageerror: ' + str(e)))
        self.pg.on('console', lambda m: m.type == 'error' and not any(x in m.text for x in T.IGNORED_CONSOLE + ('ERR_TUNNEL', 'Failed to load resource'))
                   and self.errors.append('console: ' + m.text))
        self.pg.on('dialog', lambda d: d.dismiss())
        self.pg.clock.set_system_time(T.TODAY)
        self.pg.goto('file://' + path)
        self.pg.wait_for_function("window.Store&&(Store.status().mode==='db'||Store.status().mode==='empty')", timeout=15000)
        self.pg.wait_for_function("!document.body.classList.contains('is-loading')", timeout=15000)
        self.pg.wait_for_timeout(500)

    def writes(self):
        return self.pg.evaluate("window.__writes.map(function(w){return w.path;})")


def db_test(fail_cols=()):
    """Decorator: run the test in a DbSession (fixture in the mock db)."""
    def deco(fn):
        fn.db = tuple(fail_cols) if fail_cols else ()
        fn.is_db = True
        TESTS.append(fn)
        return fn
    return deco


@test
def f1_cross_month_edit_retry_is_idempotent(s):
    assert exec_net(s) == NET, exec_net(s)
    open_edit(s, 'TX0501')
    s.pg.fill('#eDate', '2026-09-30')
    fail_puts(s, '^orders/2026-10$', 1)             # step 3 (remove from the old month) fails
    s.pg.click('#mdOk'); s.pg.wait_for_timeout(1200)
    m = msg(s)
    assert m != '(closed)', 'dialog should stay open after a failed step'
    assert 'did not answer' not in m, 'misleading message: ' + m
    assert len(rows_with_id(s, 'TX0501')) == 2, rows_with_id(s, 'TX0501')   # half-done state, as injected
    s.pg.click('#mdOk'); s.pg.wait_for_timeout(1500)  # retry
    assert msg(s) == '(closed)', 'retry should finish: ' + msg(s)
    assert rows_with_id(s, 'TX0501') == ['orders/2026-09'], rows_with_id(s, 'TX0501')
    assert exec_net(s) == NET, exec_net(s)
    assert not s.errors, s.errors


@test
def f1_cross_month_edit_step2_failure_leaves_nothing_half_done(s):
    open_edit(s, 'TX0501')
    s.pg.fill('#eDate', '2026-09-30')
    fail_puts(s, '^orders/2026-09$', 1)             # step 2 fails: nothing copied
    s.pg.click('#mdOk'); s.pg.wait_for_timeout(1200)
    assert rows_with_id(s, 'TX0501') == ['orders/2026-10'], rows_with_id(s, 'TX0501')
    s.pg.click('#mdOk'); s.pg.wait_for_timeout(1500)
    assert rows_with_id(s, 'TX0501') == ['orders/2026-09'], rows_with_id(s, 'TX0501')
    assert exec_net(s) == NET


def docs_for_backup():
    return T.fixture_docs()


def save_one_order(s, status='Pending'):
    s.go('New order')
    s.order_line('Adwaa Nimar', T.OWN_ITEM, 3)
    s.pg.select_option('#obStatus', status)
    s.pg.fill('#obDate', '2026-11-03')
    s.pg.click('#btnReq'); s.pg.wait_for_timeout(1500)
    return s.pg.inner_text('#reqNote')


@db_test(fail_cols=['orders'])
def f2_order_save_is_blocked_when_orders_failed_to_load(s):
    t = save_one_order(s)
    assert 'Reload the page before saving' in t, t
    assert not s.writes(), s.writes()


@db_test(fail_cols=['orders'])
def f2_import_is_blocked_when_orders_failed_to_load(s):
    s.go('Import Excel')
    s.main.get_by_role('group', name='What are you importing?').get_by_role('button', name=re.compile(r'^Orders')).click()
    csv = 'Date,Account,Item,Qty\n2026-10-11,Adwaa Nimar,' + T.OWN_ITEM + ',10\n'
    s.main.get_by_label('Excel (.xlsx) or CSV file').set_input_files({'name': 'x.csv', 'mimeType': 'text/csv', 'buffer': csv.encode()})
    s.pg.get_by_role('button', name='Next: check the rows', exact=True).first.click()
    s.main.locator('#impTable tbody tr').wait_for()
    s.pg.click('#impGo'); s.pg.wait_for_timeout(800)
    t = s.pg.inner_text('#impMsg')
    if 'Reload the page' not in t:   # a confirmation box may come first
        s.pg.click('#mdOk'); s.pg.wait_for_timeout(1200); t = s.pg.inner_text('#impMsg')
    assert 'Reload the page before saving' in t, t
    assert not s.writes(), s.writes()


@db_test()
def f2_healthy_order_save_still_works_and_gets_a_new_id(s):
    t = save_one_order(s)
    assert 'Order saved' in t, t
    assert rows_with_id(s, 'TX0501') == ['orders/2026-10'], rows_with_id(s, 'TX0501')
    assert rows_with_id(s, 'TX0502') == ['orders/2026-11'], rows_with_id(s, 'TX0502')


@db_test(fail_cols=['master'])
def f2_restore_is_blocked_when_a_collection_failed_to_load(s):
    # master failed -> the page believes the database is empty, but orders/deals are live
    assert s.pg.evaluate("Store.status().mode") == 'empty'
    bk = json.loads(s.pg.evaluate("JSON.stringify({app:'x',schema:1,exportedAt:'2026-10-01T00:00:00.000Z',mode:'db',docs:Store.all()})"))
    bk['docs'].update(copy.deepcopy(docs_for_backup()))     # an older backup: every page of the fixture, with one line different
    bk['docs']['orders/2026-10']['rows'][0]['qty'] = 1
    backup = json.dumps(bk)
    s.go('Data')
    s.pg.set_input_files('#rsFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': backup.encode()})
    s.pg.wait_for_timeout(500)
    s.pg.fill('#rsType', 'RESTORE')
    s.pg.click('#rsGo'); s.pg.wait_for_timeout(1500)
    t = s.pg.inner_text('#rsMsg')
    assert 'Reload the page before restoring' in t, t
    assert not s.writes(), 'restore wrote while a collection had failed: %s' % s.writes()[:3]
    assert s.pg.evaluate("window.__downloads.length") == 0 or 'no safety copy was needed' not in t, t

def audit_rows_matching(s, pattern):
    return s.pg.evaluate("""(function(re){var out=[];Object.keys(Store.all()).forEach(function(p){if(/^audit\\//.test(p))(Store.all()[p].rows||[]).forEach(function(r){if(new RegExp(re).test(JSON.stringify(r)))out.push(r.type);});});return out;})(%r)""" % pattern)


def stop_failing(s):
    s.pg.evaluate("window.__failLeft=0")


@test
def f3_failed_history_write_after_order_save_stays_visible_and_can_be_retried(s):
    fail_puts(s, '^audit/', 99)
    s.go('New order')
    s.order_line('Adwaa Nimar', T.OWN_ITEM, 3)
    s.pg.select_option('#obStatus', 'Pending'); s.pg.fill('#obDate', '2026-11-03')
    s.pg.click('#btnReq'); s.pg.wait_for_timeout(1500)
    note = s.pg.inner_text('#reqNote'); toast = s.pg.inner_text('#toast')
    assert 'Order saved' in note and 'history' in note.lower() and 'Retry saving history' in note, note
    assert 'history' in toast.lower(), 'the warning was replaced by the success toast: ' + toast
    assert 'history' in s.pg.inner_text('#savedPanel').lower(), 'saved panel does not mention the missing history'
    assert audit_rows_matching(s, 'ADD_ORDER') == []
    stop_failing(s)
    for _ in range(2):   # a second click must not add a second row
        btn = s.pg.locator('#reqNote [data-hretry]')
        if btn.count():
            btn.first.click(); s.pg.wait_for_timeout(800)
    assert audit_rows_matching(s, 'ADD_ORDER') == ['ADD_ORDER'], audit_rows_matching(s, 'ADD_ORDER')
    assert 'could not be written' not in s.pg.inner_text('#reqNote') and s.pg.locator('#reqNote [data-hretry]').count() == 0, s.pg.inner_text('#reqNote')
    assert not s.errors, s.errors

@test
def f3_failed_history_write_after_a_line_edit_is_not_hidden_by_the_success_toast(s):
    open_edit(s, 'TX0501')
    s.pg.fill('#eQty', '400')
    fail_puts(s, '^audit/', 99)
    s.pg.click('#mdOk'); s.pg.wait_for_timeout(1200)
    toast = s.pg.inner_text('#toast')
    assert 'updated' in toast and 'history' in toast.lower(), toast


@test
def f3_stock_dialog_retry_no_longer_says_entry_is_switched_off(s):
    dlg = T.open_stock_entry_dialog(s)
    assert 'switched off' in dlg.inner_text()
    fail_puts(s, '^audit/', 1)
    dlg.get_by_role('button', name='Turn stock entry on').click(); s.pg.wait_for_timeout(1000)
    t = dlg.inner_text()
    assert 'Retry saving history' in t, t
    assert 'is switched off' not in t, 'dialog still says stock entry is switched off: ' + t

DEAL_ITEM = 'NEGAZOLE 500MG FC TAB[2X10BL]SA-PVT'   # ITM093: Adwaa Nimar has one Active 65% deal from 2026-10-01


def deals_of(s, acc='ACC03'):
    return s.pg.evaluate("(Store.peek('deals/%s')||{rows:[]}).rows.filter(function(r){return r.itemId==='ITM093';})" % acc)


def builder_discount(s):
    s.go('New order')
    s.order_line('Adwaa Nimar', DEAL_ITEM, 10)
    s.pg.wait_for_timeout(300)
    return s.visible(s.main.locator('.li-disc'))[0].get_attribute('placeholder')


@test
def f4_future_dated_deal_keeps_todays_price_until_it_starts(s):
    assert builder_discount(s) == '65.00'
    s.go('Pricing')
    s.pg.select_option('#prAccount', label='Adwaa Nimar'); s.pg.select_option('#dcItem', label=DEAL_ITEM)
    s.pg.fill('#dcRate', '10'); s.pg.fill('#dcEff', '2026-12-01')
    assert 'starts on 1 Dec 2026' in s.pg.inner_text('#dcPreview'), s.pg.inner_text('#dcPreview')
    s.pg.click('#dcBuild'); s.pg.wait_for_timeout(1200)
    assert 'starts on' in s.pg.inner_text('#dcNote'), s.pg.inner_text('#dcNote')
    ds = deals_of(s)
    old = [d for d in ds if d['id'] == 'ADW001'][0]
    new = [d for d in ds if d['id'] != 'ADW001' and d['status'] == 'Active']
    assert old['status'] == 'Active' and old['to'] == '2026-11-30', old
    assert len(new) == 1 and new[0]['from'] == '2026-12-01' and abs(new[0]['pct'] - 0.10) < 1e-9, new
    assert builder_discount(s) == '65.00', 'today must still use the old deal'
    # on the start date the new deal is the one that prices (same selection rule the order builder uses)
    got = s.pg.evaluate("Pricing.resolve({id:'ACC03',name:'Adwaa Nimar'},{id:'ITM093',name:%r,rsp:12.05,std:0.3,active:true},Store.peek('deals/ACC03').rows,'2026-12-01')" % DEAL_ITEM)
    assert abs(got['pct'] - 0.10) < 1e-9 and got['src'] == 'Account deal', got
    assert not s.errors, s.errors


@test
def f4_deal_starting_today_still_retires_the_old_deal_at_once(s):
    s.go('Pricing')
    s.pg.select_option('#prAccount', label='Adwaa Nimar'); s.pg.select_option('#dcItem', label=DEAL_ITEM)
    s.pg.fill('#dcRate', '10')
    s.pg.click('#dcBuild'); s.pg.wait_for_timeout(1200)
    old = [d for d in deals_of(s) if d['id'] == 'ADW001'][0]
    assert old['status'] == 'Inactive' and old['to'] == '2026-10-11', old
    assert builder_discount(s) == '10.00'


@test
def f4_future_dated_deals_import_keeps_the_old_deal_until_then(s):
    s.go('Import Excel')
    s.main.get_by_role('group', name='What are you importing?').get_by_role('button', name=re.compile(r'^Deals')).click()
    csv = 'Account,Item,Discount %%,From date\nAdwaa Nimar,%s,10,2026-12-01\n' % DEAL_ITEM
    s.main.get_by_label('Excel (.xlsx) or CSV file').set_input_files({'name': 'd.csv', 'mimeType': 'text/csv', 'buffer': csv.encode()})
    s.pg.get_by_role('button', name='Next: check the rows', exact=True).first.click()
    s.main.locator('#impTable tbody tr').wait_for()
    t = s.pg.inner_text('#impTable')
    assert 'old deal keeps pricing until then' in t and 'is retired' not in t, t
    s.pg.click('#impGo'); s.pg.wait_for_timeout(600)
    if s.pg.evaluate("!!document.getElementById('mdOk')"):
        s.pg.click('#mdOk')
    s.pg.wait_for_timeout(1500)
    ds = deals_of(s)
    old = [d for d in ds if d['id'] == 'ADW001'][0]
    assert old['status'] == 'Active' and old['to'] == '2026-11-30', old
    assert any(d['from'] == '2026-12-01' and d['status'] == 'Active' for d in ds), ds
    assert builder_discount(s) == '65.00'
def sched_docs():
    d = copy.deepcopy(T.fixture_docs())
    rows = d['deals/ACC03']['rows']
    rows[0]['to'] = '2026-11-30'           # ADW001: 65% from 2026-10-01, ends 30 Nov
    rows.append({'id': 'ADW002', 'account': 'Adwaa Nimar', 'item': DEAL_ITEM, 'itemId': 'ITM093', 'status': 'Active', 'pct': 0.10,
                 'rsp': 12.05, 'net': 10.845, 'from': '2026-12-01', 'to': None, 'source': 'Platform', 'updated': '2026-10-11', 'notes': None, 'type': 'Account deal'})
    return d


def builder_rate_on(s, day):
    s.go('New order')
    s.order_line('Adwaa Nimar', DEAL_ITEM, 10)
    s.pg.fill('#obDate', day); s.pg.wait_for_timeout(300)
    return s.visible(s.main.locator('.li-disc'))[0].get_attribute('placeholder'), s.visible(s.main.locator('.ro-src'))[0].inner_text().lower()


@test
def g1_new_order_is_priced_by_its_own_date(s):
    assert builder_rate_on(s, '2026-10-11')[1] == 'deal'                 # today: unchanged
    r, src = builder_rate_on(s, '2026-09-15')                            # before the 65% deal started
    assert src == 'std' and r != '65.00', (r, src)
    assert builder_rate_on(s, '2026-11-15') == ('65.00', 'deal')         # future-dated, first deal in force
    assert builder_rate_on(s, '2026-12-01') == ('10.00', 'deal')         # the scheduled deal from its start date
g1_new_order_is_priced_by_its_own_date.docs = sched_docs()


@test
def g1_saved_order_keeps_the_rate_of_its_date(s):
    builder_rate_on(s, '2026-09-15')
    s.pg.select_option('#obStatus', 'Executed')
    s.pg.click('#btnReq'); s.pg.wait_for_timeout(1500)
    row = s.pg.evaluate("Store.peek('orders/2026-09').rows.slice(-1)[0]")
    assert row['src'] == 'Standard rule' and row['pct'] != 0.65, row


@test
def g1_import_without_discount_column_is_priced_by_the_row_date(s):
    def preview(day):
        s.go('Import Excel')
        s.main.get_by_role('group', name='What are you importing?').get_by_role('button', name=re.compile(r'^Orders')).click()
        csv = 'Date,Account,Item,Qty\n%s,Adwaa Nimar,%s,10\n' % (day, DEAL_ITEM)
        s.main.get_by_label('Excel (.xlsx) or CSV file').set_input_files({'name': 'o%s.csv' % day, 'mimeType': 'text/csv', 'buffer': csv.encode()})
        s.pg.get_by_role('button', name='Next: check the rows', exact=True).first.click()
        s.main.locator('#impTable tbody tr').wait_for()
        return s.pg.inner_text('#impTable')
    assert 'Standard rule' in preview('2026-09-15')
    assert 'Account deal' in preview('2026-10-11')
g1_import_without_discount_column_is_priced_by_the_row_date.docs = sched_docs()

def save_executed(s, acc, item, qty):
    s.go('New order')
    s.order_line(acc, item, qty)
    s.pg.click('#btnReq'); s.pg.wait_for_timeout(1500)
    return s.pg.evaluate("Store.peek('orders/2026-10').rows.slice(-1)[0]")


@test
def g2_new_line_net_is_rounded_to_halalas_and_lines_add_up(s):
    r = save_executed(s, 'Adwaa Nimar', T.OWN_ITEM, 99)          # 99 x 2.525 = 249.975 (a half-cent tie)
    assert r['net'] == 249.98, r['net']
    assert abs(r['qty'] * r['rsp'] - r['net'] - r['discAmt']) < 1e-9 and round(r['discAmt'], 2) == r['discAmt'], r
    assert 'Order saved' in s.pg.inner_text('#reqNote')
    assert '249.98' in s.pg.inner_text('#savedPanel')


def money_docs():
    d = copy.deepcopy(T.fixture_docs())
    for it in d['master/items']['rows']:
        if it['id'] == 'ITM093':
            it['rsp'] = 8.6
    d['deals/ACC03']['rows'][0]['pct'] = 0.302326          # a "30.2326%" deal that is meant to give 6.00 per unit
    return d


@test
def g2_deal_quoted_at_6_00_saves_60_00_for_10_units(s):
    r = save_executed(s, 'Adwaa Nimar', DEAL_ITEM, 10)
    assert r['net'] == 60 and r['src'] == 'Account deal', r
g2_deal_quoted_at_6_00_saves_60_00_for_10_units.docs = money_docs()

@test
def g3_headline_label_follows_the_selected_period(s):
    s.go('Dashboard')
    lab = lambda: s.pg.inner_text('#kpiNet .k-label')
    assert 'YTD' not in s.main.inner_text() and 'year-to-date' not in s.main.inner_text().lower(), 'YTD wording on the all-periods dashboard'
    assert 'all periods' in lab().lower(), lab()
    assert s.pg.inner_text('#kpiNet .k-val').strip() != ''
    s.pg.select_option('#periodSel', '2026'); s.pg.wait_for_timeout(500)
    assert '2026' in lab() and 'year to date' in lab().lower(), lab()
    s.pg.select_option('#periodSel', '2025'); s.pg.wait_for_timeout(500)
    assert '2025' in lab() and 'YTD' not in lab() and 'year to date' not in lab().lower(), lab()
    assert '2025' in s.pg.inner_text('#kpiQty .k-label'), s.pg.inner_text('#kpiQty .k-label')
    s.pg.select_option('#periodSel', 'all'); s.pg.wait_for_timeout(500)
    assert 'all periods' in lab().lower()
    assert 'YTD' not in s.pg.inner_text('#footMeta')


@test
def g3_account_page_label_does_not_claim_ytd(s):
    s.go('Accounts')
    s.pg.click('#acctList [data-acct="Adwaa Nimar"]'); s.pg.wait_for_timeout(500)
    assert 'net sales · all periods' in s.pg.inner_text('#acctDetail').lower()
    t = s.main.inner_text()
    assert 'ytd' not in t.lower(), 'YTD labels on the account page'

def edit_qty(s, rid, qty):
    open_edit(s, rid)
    s.pg.fill('#eQty', str(qty)); s.pg.click('#mdOk'); s.pg.wait_for_timeout(900)


@test
def g4_restore_keeps_history_written_after_the_backup_and_warns_about_reverted_edits(s):
    edit_qty(s, 'TX0501', 400)                                   # audit row A, then take the backup
    backup = s.pg.evaluate("JSON.stringify({app:'x',schema:1,exportedAt:'2026-10-11T00:00:00.000Z',mode:'local',docs:Store.all()})")
    edit_qty(s, 'TX0501', 300)                                   # audit row B is written after the backup
    before = audit_rows_matching(s, 'EDIT_ORDER')
    assert len(before) == 2, before
    s.go('Data')
    s.pg.set_input_files('#rsFile', {'name': 'b.json', 'mimeType': 'application/json', 'buffer': backup.encode()})
    s.pg.wait_for_timeout(500)
    t = s.pg.inner_text('#restore') if s.pg.locator('#restore').count() else s.main.inner_text()
    assert 'Heads up' in t and re.search(r'\b1 record', t), 'no warning about the reverted edit: ' + t[:600]
    s.pg.fill('#rsType', 'RESTORE'); s.pg.click('#rsGo'); s.pg.wait_for_timeout(2500)
    assert s.pg.evaluate("Store.peek('orders/2026-10').rows.filter(function(r){return r.id==='TX0501';})[0].qty") == 400
    types = audit_rows_matching(s, '.')
    assert types.count('EDIT_ORDER') == 2, 'history written after the backup was lost: %s' % types
    assert types.count('RESTORE') == 1, types

NUMMSG = 'Please type a number like 12.5'


@test
def g5_ambiguous_deal_rates_are_rejected_not_guessed(s):
    s.go('Pricing')
    s.pg.select_option('#prAccount', label='Adwaa Nimar'); s.pg.select_option('#dcItem', label=DEAL_ITEM)
    before = s.pg.evaluate("JSON.stringify(Store.peek('deals/ACC03'))")
    for bad in ('12,5', '4 5', '0x1A', '1e1', '12abc'):
        s.pg.fill('#dcRate', bad); s.pg.click('#dcBuild'); s.pg.wait_for_timeout(300)
        assert NUMMSG in s.pg.inner_text('#dcNote'), (bad, s.pg.inner_text('#dcNote'))
    assert s.pg.evaluate("JSON.stringify(Store.peek('deals/ACC03'))") == before, 'a deal was saved from ambiguous text'
    s.pg.fill('#dcRate', '12.5'); s.pg.click('#dcBuild'); s.pg.wait_for_timeout(1000)
    assert [d for d in deals_of(s) if d['status'] == 'Active' and abs(d['pct'] - 0.125) < 1e-9], 'plain 12.5 should save'


@test
def g5_ambiguous_target_total_is_rejected(s):
    s.go('Targets')
    for bad, ok in (('300,5', False), ('4 5', False), ('0x1A', False), ('1,200', True), ('300000', True), ('1,20', False)):
        s.pg.fill('#tgTotal', bad)
        s.pg.evaluate("document.getElementById('tgBreak')&&document.getElementById('tgBreak').click()")
        s.pg.wait_for_timeout(300)
        m = s.pg.inner_text('#tgMsg')
        assert (NUMMSG in m) == (not ok), (bad, m)


@test
def f6_guide_calls_single_order_expectations_a_rough_guess(s):
    s.go('How it works')
    s.pg.wait_for_timeout(300)
    g = s.main.inner_text().lower()
    assert 'rough guess' in g and 'low confidence' not in g, 'guide wording'


def main():
    docs = T.fixture_docs()
    sel = [fn for fn in TESTS if not os.environ.get('JULPHAR_TEST_FILTER') or re.search(os.environ['JULPHAR_TEST_FILTER'], fn.__name__)]
    failures = 0
    with tempfile.TemporaryDirectory() as tmp, sync_playwright() as p:
        html = T.build_page(tmp)
        browser = p.chromium.launch()
        for fn in sel:
            path = T.seeded(html, getattr(fn, 'docs', None) or ({} if getattr(fn, 'is_db', False) else docs), tmp, fn.__name__)
            s = None
            try:
                s = DbSession(browser, path, docs, fn.db) if getattr(fn, 'is_db', False) else T.Session(browser, path)
                fn(s)
                print('ok     ' + fn.__name__)
            except Exception as e:
                failures += 1
                m = str(e).strip().splitlines()[0] if str(e).strip() else type(e).__name__
                print('FAIL   %s\n         %s' % (fn.__name__, m[:300]))
                if os.environ.get('VERBOSE'):
                    traceback.print_exc()
            finally:
                if s:
                    s.close()
        browser.close()
    print('fix tests: %d passed, %d failed, %d total' % (len(sel) - failures, failures, len(sel)))
    return 1 if failures else 0


if __name__ == '__main__':
    sys.exit(main())
