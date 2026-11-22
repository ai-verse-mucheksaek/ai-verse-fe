const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require(process.env.AI_VERSE_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.preview');
// Synthetic credentials and API responses only. Every network request is intercepted.
const token = 'test-admin-token-for-browser-tests-only';
const picture = '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#eadbea"/></svg>';
const result = {
  season: 'summer', season_ko: '여름 쿨톤', confidence: 0.7, palette: ['#D98CA3', '#B39DDB'],
  recommendations: [
    { category: 'lip', name: '로즈', color: '#C85A7C' },
    { category: 'blush', name: '핑크', color: '#D9A0BB' },
    { category: 'eye', name: '모브', color: '#9A7F9D' },
  ],
};

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ headless: true, ...(process.env.AI_VERSE_BROWSER ? { executablePath: process.env.AI_VERSE_BROWSER } : { channel: 'chrome' }) });
  let context, page, state, calls;
  const errors = [], checks = [];
  const record = (name) => { checks.push(name); console.log('PASS ' + name); };
  const requests = (method, suffix) => calls.filter(call => call.method === method && call.path.endsWith(suffix));
  const waitCount = (text) => page.waitForFunction(value => document.querySelector('#usage-count')?.textContent === value, text);
  const waitReady = () => page.waitForFunction(() => !document.querySelector('#apply-makeup').disabled);
  const apply = async () => {
    await page.locator('#makeup-consent').check();
    await page.locator('#apply-makeup').click();
  };
  const authenticate = async (value = token) => {
    await page.locator('#admin-panel').evaluate(panel => { panel.open = true; });
    await page.locator('#admin-token').fill(value);
    await page.locator('#admin-login').click();
  };

  async function open(options = {}) {
    if (context) await context.close();
    const origin = options.origin || 'https://booth.test';
    const scenario = { used: 3, totalUsed: 3, totalLimit: 1800, limit: 20, usageError: 0, postError: null, ...options };
    const traffic = [];
    state = scenario; calls = traffic;
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    await context.addInitScript(() => {
      sessionStorage.setItem('ai-verse-analysis', 'usage-test');
      sessionStorage.setItem('ai-verse-analysis-expiry', new Date(Date.now() + 86400000).toISOString());
    });
    await context.route('**/*', async route => {
      const request = route.request(), url = new URL(request.url());
      const call = { method: request.method(), path: url.pathname, url: request.url(), headers: request.headers(), body: request.postDataJSON() };
      traffic.push(call);
      if (![origin, 'http://localhost:8000'].includes(url.origin)) return route.abort('blockedbyclient');
      if (url.pathname === '/health') return route.fulfill({ json: { vto_provider: 'perfectcorp' } });
      if (url.pathname.endsWith('/try-on-usage')) {
        if (scenario.usageWait) await scenario.usageWait;
        if (scenario.usageRedirect && call.headers['x-admin-token']) return route.fulfill({ status: 302, headers: { location: 'https://elsewhere.test/secret' } });
        if (scenario.usageError) return route.fulfill({ status: scenario.usageError, json: { detail: '조회 실패' } });
        if (scenario.malformed) return route.fulfill({ json: { is_admin: true, limit: 20, used: 'bad', remaining: -1 } });
        const admin = call.headers['x-admin-token'] === token && !scenario.rejectAdmin;
        const total = Math.max(0, scenario.totalLimit - scenario.totalUsed);
        return route.fulfill({ json: { is_admin: admin, limit: admin ? null : scenario.limit, used: scenario.used, remaining: admin ? total : Math.min(Math.max(0, scenario.limit - scenario.used), total) } });
      }
      if (url.pathname === '/api/v1/try-ons') {
        if (scenario.postWait) await scenario.postWait;
        if (scenario.postError) {
          if (scenario.postError.consume) { scenario.used++; scenario.totalUsed++; }
          if (scenario.postError.exhaust) { scenario.used = scenario.limit; }
          if (scenario.postError.refreshFails) scenario.usageError = 500;
          return route.fulfill({ status: scenario.postError.status, json: { detail: scenario.postError.detail } });
        }
        scenario.used++; scenario.totalUsed++;
        return route.fulfill({ status: 201, json: { status: 'completed', provider: 'perfectcorp', before_image_url: '/api/v1/analyses/usage-test/image', result_image_url: '/api/v1/try-ons/example/image' } });
      }
      if (url.pathname.endsWith('/image')) return route.fulfill({ contentType: 'image/svg+xml', body: picture });
      if (url.pathname.endsWith('/products')) return route.fulfill({ json: [{ id: 'romand-figfig', brand: 'rom&nd', name: '피그피그', category: 'lip', color_hex: '#A65B70' }] });
      if (url.pathname === '/api/v1/analyses/usage-test') return route.fulfill({ json: { id: 'usage-test', status: 'completed', expires_at: new Date(Date.now() + 86400000).toISOString(), result } });
      if (url.pathname.startsWith('/api/')) return route.fulfill({ status: 404, json: { detail: 'Not found' } });
      const file = path.resolve(root, '.' + decodeURIComponent(url.pathname));
      if (!file.startsWith(root + path.sep)) return route.abort('blockedbyclient');
      try {
        const body = fs.readFileSync(file);
        const contentType = ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.jpg': 'image/jpeg', '.png': 'image/png' })[path.extname(file)] || 'application/octet-stream';
        return route.fulfill({ body, contentType });
      } catch { return route.fulfill({ status: 404, body: '' }); }
    });
    page = await context.newPage();
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(origin + '/3.html');
    await page.locator('#result-content .tone').waitFor();
  }

  try {
    await open(); await waitCount('17 / 20회'); await waitReady();
    assert.equal(await page.locator('#usage-mode').textContent(), '일반 참가자');
    assert.equal(await page.locator('#usage-progress').getAttribute('value'), '17');
    assert(await page.locator('#usage-total').isHidden());
    assert.equal(requests('GET', '/try-on-usage').length, 1);
    await page.locator('#try-on-usage').screenshot({ path: path.join(output, 'usage-participant-card.png') });
    await apply(); await waitCount('16 / 20회'); await waitReady();
    assert.equal(requests('GET', '/try-on-usage').length, 2);
    assert.equal(requests('POST', '/try-ons').length, 1);
    assert(calls.findIndex(call => call.method === 'POST') < calls.findLastIndex(call => call.path.endsWith('/try-on-usage')));
    assert(calls.every(call => !call.headers['x-admin-token']));
    assert.equal(requests('POST', '/try-ons')[0].body.intensity, 15);
    assert.equal(requests('POST', '/try-ons')[0].body.lip_color, '#a65b70');
    record('참가자 잔여 17/20·진행 막대·요청 후 재조회, 립 초기값·강도 유지');

    await open({ used: 19 }); await waitCount('1 / 20회'); await waitReady();
    await apply(); await waitCount('0 / 20회');
    assert(await page.locator('#apply-makeup').isDisabled());
    await page.locator('#makeup-form').evaluate(form => form.requestSubmit());
    assert.equal(requests('POST', '/try-ons').length, 1);
    record('마지막 1회 적용 후 0회 버튼 비활성화 및 추가 제출 차단');

    await open({ used: 20 }); await waitCount('0 / 20회');
    await authenticate('invalid-test-token');
    await page.locator('#admin-error').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#usage-mode').textContent(), '일반 참가자');
    assert.equal(await page.evaluate(() => boothApi.hasAdminToken()), false);
    assert.equal(await page.locator('#admin-token').inputValue(), '');
    await authenticate(); await waitCount('무제한'); await waitReady();
    assert.equal(await page.locator('#usage-mode').textContent(), '관리자 모드');
    assert.match(await page.locator('#usage-total').textContent(), /1,797회/);
    assert(await page.locator('#usage-progress').isHidden());
    await page.locator('#try-on-usage').screenshot({ path: path.join(output, 'usage-admin-card.png') });
    await page.locator('#admin-panel').screenshot({ path: path.join(output, 'usage-admin-panel.png') });
    await apply(); await page.waitForFunction(() => document.querySelector('#usage-total').textContent.includes('1,796회')); await waitReady();
    assert.equal(requests('POST', '/try-ons')[0].headers['x-admin-token'], token);
    assert.equal(requests('GET', '/try-on-usage').at(-1).headers['x-admin-token'], token);
    assert(calls.filter(call => call.headers['x-admin-token']).every(call => call.url.startsWith('https:') && (call.path.endsWith('/try-on-usage') || call.path === '/api/v1/try-ons')));
    assert(calls.every(call => !call.url.includes(token)));
    const stored = await page.evaluate(() => JSON.stringify({ local: { ...localStorage }, session: { ...sessionStorage } }));
    assert(!stored.includes(token));
    assert.equal(await page.locator('#admin-token').inputValue(), '');
    for (const width of [1440, 390, 320]) {
      await page.setViewportSize({ width, height: 1000 });
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      if (width === 390) await page.screenshot({ path: path.join(output, 'usage-admin-mobile.png'), fullPage: true });
    }
    await page.locator('#admin-logout').click(); await waitCount('0 / 20회');
    assert(await page.locator('#apply-makeup').isDisabled());
    assert.equal(requests('GET', '/try-on-usage').at(-1).headers['x-admin-token'], undefined);
    record('서버 응답 기반 관리자 인증·잘못된 토큰 거부·개별 한도 우회·전체 잔여량·인증 해제·모바일 화면');

    await open(); await waitReady(); await authenticate(); await waitCount('무제한');
    await page.reload(); await waitCount('17 / 20회');
    assert.equal(await page.evaluate(() => boothApi.hasAdminToken()), false);
    await authenticate(); await waitCount('무제한');
    await page.goto('https://booth.test/1.html');
    await page.goto('https://booth.test/3.html'); await waitCount('17 / 20회');
    assert.equal(requests('GET', '/try-on-usage').at(-1).headers['x-admin-token'], undefined);
    record('새로고침·화면 이동 후 관리자 토큰 폐기');

    await open({ totalUsed: 1800 }); await waitCount('0 / 20회');
    await authenticate(); await waitCount('무제한');
    assert.match(await page.locator('#usage-total').textContent(), /0회/);
    assert(await page.locator('#apply-makeup').isDisabled());
    assert.match(await page.locator('#usage-status').textContent(), /행사 전체/);
    assert.equal(requests('POST', '/try-ons').length, 0);
    record('행사 전체 소진 시 관리자도 적용 버튼 차단');

    for (const detail of ['가상 메이크업은 최대 20회까지 체험할 수 있습니다.', '행사 전체 가상 메이크업 사용량이 초과되었습니다.', '']) {
      await open({ postError: { status: 429, detail, exhaust: Boolean(detail) } }); await waitReady();
      await apply(); await page.locator('#makeup-error').waitFor({ state: 'visible' });
      assert.equal(await page.locator('#makeup-error').textContent(), detail || '요청이 많아요. 잠시 뒤 다시 시도해 주세요.');
      await waitCount(detail ? '0 / 20회' : '17 / 20회');
      assert.equal(requests('GET', '/try-on-usage').length, 2);
      if (detail) assert(await page.locator('#apply-makeup').isDisabled());
    }
    record('HTTP 429의 BE detail 우선 표시·빈 detail 대체 문구·제한 후 재조회');

    await open({ postError: { status: 502, detail: 'internal error', consume: true } }); await waitReady();
    await apply(); await waitCount('16 / 20회'); await waitReady();
    assert.match(await page.locator('#makeup-error').textContent(), /적용할 수 없어요/);
    record('메이크업 실패 시에도 서버에서 차감한 실제 잔여량 재조회');

    await open({ usageError: 500 }); await waitCount('확인 필요');
    assert(await page.locator('#apply-makeup').isDisabled());
    state.usageError = 0;
    await page.locator('#retry-usage').click(); await waitCount('17 / 20회'); await waitReady();
    state.postError = { status: 502, detail: 'failed', consume: true, refreshFails: true };
    await apply(); await waitCount('확인 필요');
    assert(await page.locator('#apply-makeup').isDisabled());
    state.usageError = 0;
    await page.locator('#retry-usage').click(); await waitCount('16 / 20회'); await waitReady();
    record('최초·요청 후 횟수 조회 실패 시 적용 차단과 재조회 복구');

    await open({ malformed: true }); await waitCount('확인 필요');
    assert(await page.locator('#apply-makeup').isDisabled());
    assert.equal(await page.locator('#usage-mode').textContent(), '일반 참가자');
    state.malformed = false; await page.locator('#retry-usage').click(); await waitReady();
    record('잘못된 횟수 응답으로 관리자 인증·체험 허용하지 않음');

    let release;
    const wait = new Promise(resolve => { release = resolve; });
    await open({ usageWait: wait }); await waitCount('확인 중');
    assert(await page.locator('#apply-makeup').isDisabled());
    release(); await waitReady();
    const postWait = new Promise(resolve => { release = resolve; });
    state.postWait = postWait;
    await apply();
    await page.waitForFunction(() => document.querySelector('#apply-makeup').disabled);
    assert(await page.locator('#admin-login').isDisabled());
    await page.locator('#makeup-form').evaluate(form => form.requestSubmit());
    release(); await waitCount('16 / 20회'); await waitReady();
    assert.equal(requests('POST', '/try-ons').length, 1);
    record('횟수 조회 중·요청 처리 중 중복 제출과 관리자 전환 차단');

    for (const origin of ['http://booth.test', 'https://localhost:5173']) {
      await open({ origin }); await waitReady();
      await page.locator('#admin-panel').evaluate(panel => { panel.open = true; });
      assert(await page.locator('#admin-token').isDisabled());
      assert(await page.locator('#admin-login').isDisabled());
      const blocked = await page.evaluate(async testToken => {
        let setBlocked = false, sendBlocked = false;
        try { boothApi.setAdminToken(testToken); } catch { setBlocked = true; }
        try { await boothApi.api('/api/v1/analyses/usage-test/try-on-usage', { headers: { 'X-Admin-Token': testToken } }); } catch { sendBlocked = true; }
        return { setBlocked, sendBlocked };
      }, token);
      assert.deepEqual(blocked, { setBlocked: true, sendBlocked: true });
      assert(calls.every(call => !call.headers['x-admin-token']));
      await apply(); await waitCount('16 / 20회');
    }
    record('HTTP 페이지·HTTPS에서 HTTP API 연결 시 토큰 전송 금지, 참가자 이용 유지');

    await open(); await waitReady();
    state.usageRedirect = true;
    await authenticate(); await waitCount('확인 필요');
    assert.equal(await page.evaluate(() => boothApi.hasAdminToken()), false);
    assert(!calls.some(call => call.url.startsWith('https://elsewhere.test')));
    assert(await page.locator('#apply-makeup').isDisabled());
    record('관리자 토큰을 가진 요청의 외부 리다이렉트 차단');

    await open(); await waitReady();
    await page.goto('https://booth.test/3.html?demo=1');
    await waitCount('20 / 20회');
    const beforeDemo = requests('GET', '/try-on-usage').length;
    assert(await page.locator('#admin-panel').isHidden());
    await page.locator('#apply-makeup').click();
    await page.locator('#comparison').waitFor({ state: 'visible' });
    assert.equal(requests('GET', '/try-on-usage').length, beforeDemo);
    assert.equal(requests('POST', '/try-ons').length, 0);
    record('데모는 인증·실제 횟수 조회·외부 요청 없이 예시만 표시');

    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, 'usage-review.json'), JSON.stringify({ checks, errors }, null, 2));
    console.log(`Completed ${checks.length} usage checks; page errors: ${errors.length}`);
  } finally {
    if (context) await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
