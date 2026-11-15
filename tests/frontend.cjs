const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require(process.env.AI_VERSE_PLAYWRIGHT || 'playwright');
const root = path.resolve(__dirname, '..');
const output = path.join(root, '.preview');
const fixture = {
  season: 'summer', season_ko: '여름 쿨톤', undertone: 'cool', confidence: 0.72,
  measured_skin_color: { hex: '#E3C0A9', rgb: [227,192,169] }, metrics: {},
  palette: ['#D98CA3','#B39DDB'],
  recommendations: [
    {category:'lip',name:'로즈 핑크',color:'#C85A7C',description:'추천'},
    {category:'blush',name:'라벤더 핑크',color:'#D9A0BB',description:'추천'},
    {category:'eye',name:'소프트 모브',color:'#9A7F9D',description:'추천'},
  ],
  analyzer:'v2', reliability:'low',
  warning_messages:['기준 카드가 보이지 않아 조명 보정 없이 분석했어요.'],
  reasons:['밝기와 색상 특징을 비교한 백엔드 분석 근거입니다.'],
  season_scores:{spring:0.25,summer:0.62,autumn:0.08,winter:0.05},
  disclaimer:'조명과 카메라에 따라 달라지는 체험용 추천이며 전문 진단을 대체하지 않습니다.',
  content:{
    season:'summer',season_ko:'여름 쿨톤',summary:'서버에서 전달한 맞춤 스타일 요약',keywords:['청량함','부드러움'],
    palette:[{name:'로즈',hex:'#D98CA3'},{name:'라벤더',hex:'#B39DDB'},{name:'블루',hex:'#90CAF9'},
      {name:'그레이',hex:'#B0BEC5'},{name:'핑크',hex:'#E6A8C5'},{name:'아이보리',hex:'#FFF4DC'}],
    makeup:[{category:'lip',name:'서버 추천 립',hex:'#C85A7C'},{category:'blush',name:'라벤더 핑크',hex:'#D9A0BB'},{category:'eye',name:'소프트 모브',hex:'#9A7F9D'}],
    clothes:{best:['서버 추천 옷 색'],avoid:['서버 비교 옷 색']},hair:['서버 추천 머리색'],
    accessory:{metal:'silver',metal_ko:'실버',tip:'서버 추천 액세서리 안내'},booth_lip:'롬앤 피그피그',
    second_season:{season:'spring',season_ko:'봄 웜톤',score:0.25},
  },
};
const lipCatalog = [
 {id:'romand-bare-apricot',brand:'rom&nd',name:'베어 애프리콧',category:'lip',color_hex:'#D98C73',seasons:['spring'],tester_label:'봄 웜톤 추천'},
 {id:'romand-figfig',brand:'rom&nd',name:'피그피그',category:'lip',color_hex:'#A65B70',seasons:['summer'],tester_label:'여름 쿨톤 추천'},
 {id:'romand-acorn-brown',brand:'rom&nd',name:'도토리 밤',category:'lip',color_hex:'#8F4E3B',seasons:['autumn'],tester_label:'가을 웜톤 추천'},
 {id:'romand-plum-coke',brand:'rom&nd',name:'플럼 콕',category:'lip',color_hex:'#802D50',seasons:['winter'],tester_label:'겨울 쿨톤 추천'},
];
const oldTester = {id:'lip-summer-01',brand:'부스 테스터',name:'예전 예시 로즈 립',category:'lip',color_hex:'#C85A7C',seasons:['summer']};
const picture='<svg xmlns="http://www.w3.org/2000/svg" width="600" height="450"><rect width="600" height="450" fill="#eadbea"/><ellipse cx="300" cy="210" rx="100" ry="140" fill="#f0c1aa"/></svg>';
(async()=>{
 fs.mkdirSync(output,{recursive:true});
 const server=http.createServer((req,res)=>{
  const url=new URL(req.url,'http://localhost');
  const file=path.resolve(root,decodeURIComponent(url.pathname).replace(/^\//,''));
  if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}
  fs.readFile(file,(error,data)=>{
   if(error){res.writeHead(404);return res.end();}
   res.setHeader('Content-Type',({'.html':'text/html; charset=utf-8','.css':'text/css','.js':'text/javascript','.jpg':'image/jpeg'}[path.extname(file)]||'application/octet-stream'));
   res.end(data);
  });
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const base=`http://127.0.0.1:${server.address().port}/`;
 let browser;
 const checks=[];
 try{
  browser=await chromium.launch({headless:true,...(process.env.AI_VERSE_BROWSER?{executablePath:process.env.AI_VERSE_BROWSER}:{channel:'chrome'})});
  const context=await browser.newContext({viewport:{width:1440,height:1000},deviceScaleFactor:1});
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  let state;
  const fresh=()=>state={result:structuredClone(fixture),deleteStatus:204,deleted:false,calls:[],failAnalysis:false,catalogFails:false,expectedLip:'#a65b70'};
  fresh();
  await page.route('**/health',route=>{
   state.calls.push({method:'GET',path:'/health'});
   return route.fulfill({json:{status:'ok',vto_provider:'perfectcorp',try_on_queue:{active:0,waiting:0}}});
  });
  await page.route('**/api/v1/**',async route=>{
   const request=route.request(),url=new URL(request.url());
   state.calls.push({method:request.method(),path:url.pathname,body:request.postDataBuffer()});
   if(request.method()==='DELETE'){
    if(state.deleteStatus===0)return route.abort('failed');
    if([204,404].includes(state.deleteStatus))state.deleted=true;
    return route.fulfill(state.deleteStatus===204?{status:204,body:''}:{status:state.deleteStatus,json:{detail:'삭제 오류'}});
   }
   if(url.pathname.endsWith('/image'))return route.fulfill({contentType:'image/svg+xml',body:picture});
   if(url.pathname==='/api/v1/products')return route.fulfill(state.catalogFails?{status:500,json:{detail:'제품 오류'}}:{json:[oldTester,...lipCatalog,{...lipCatalog[0],id:'inactive',active:false}]});
   if(url.pathname.endsWith('/products'))return route.fulfill({json:[oldTester,lipCatalog.find(product=>product.seasons.includes(state.result.season))||lipCatalog[1]]});
   if(url.pathname.endsWith('/share'))return route.fulfill({status:201,json:{token:'test-share-token-abcdefghijk',expires_at:new Date(Date.now()+1800000).toISOString()}});
   if(url.pathname==='/api/v1/try-ons'){
    assert.equal(request.postDataJSON().analysis_id,'analysis-under-test');
    assert.equal(request.postDataJSON().lip_color,state.expectedLip);
    assert.equal(request.postDataJSON().blush_color,'#d9a0bb');
    assert.equal(request.postDataJSON().eye_color,'#9a7f9d');
    return route.fulfill({status:201,json:{status:'completed',provider:'perfectcorp',before_image_url:'/api/v1/analyses/analysis-under-test/image',result_image_url:'/api/v1/try-ons/example/image'}});
   }
   if(state.deleted)return route.fulfill({status:404,json:{detail:'결과가 없습니다.'}});
   if(url.pathname.includes('/public/results/')){
    const {season_scores,...publicResult}=state.result;
    return route.fulfill({json:{...publicResult,products:[oldTester,lipCatalog[1]]}});
   }
   if(state.failAnalysis)return route.fulfill({status:500,json:{detail:'오류'}});
   return route.fulfill({status:request.method()==='POST'?201:200,json:{id:'analysis-under-test',status:'completed',expires_at:new Date(Date.now()+86400000).toISOString(),result:state.result}});
  });
  await page.addInitScript(()=>{
   window.__cameraRequests=0;window.__lastStream=null;
   Object.defineProperty(navigator.mediaDevices,'getUserMedia',{value:async()=>{
    window.__cameraRequests++;
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=480;
    const ctx=canvas.getContext('2d');
    const paint=()=>{ctx.fillStyle='#e4cfdf';ctx.fillRect(0,0,640,480);ctx.fillStyle='#efbda8';ctx.beginPath();ctx.ellipse(320,220,100,140,0,0,7);ctx.fill();};
    paint();setInterval(paint,100);window.__lastStream=canvas.captureStream(10);return window.__lastStream;
   }});
  });
  const calls=(method,suffix)=>state.calls.filter(call=>call.method===method&&(!suffix||call.path.endsWith(suffix)));
  const session=async(file='3.html')=>{
   await page.goto(base+'1.html');
   await page.evaluate(()=>{sessionStorage.setItem('ai-verse-analysis','analysis-under-test');sessionStorage.setItem('ai-verse-analysis-expiry',new Date(Date.now()+86400000).toISOString());});
   await page.goto(base+file);
   await page.locator(file==='3.html'?'#result-content .tone':'#share-qr svg').waitFor();
  };
  const record=(name)=>{checks.push(name);console.log('PASS '+name);};

  await page.goto(base+'2.html');
  await page.locator('#open-camera').click();
  assert.match(await page.locator('#capture-error').textContent(),/동의/);
  assert.equal(await page.evaluate(()=>window.__cameraRequests),0);
  assert.equal(state.calls.length,0);
  await page.locator('#photo-consent').check();
  await page.locator('#open-camera').click();
  await page.locator('#take-photo').waitFor({state:'visible'});
  await page.locator('#take-photo').click();
  await page.locator('#analyze-photo').waitFor({state:'visible'});
  await page.locator('#photo-consent').uncheck();
  assert(await page.locator('#captured-photo').isHidden());
  assert(await page.evaluate(()=>window.__lastStream.getTracks().every(track=>track.readyState==='ended')));
  assert.equal(calls('POST').length,0);
  record('사진 동의 전 카메라·통신 차단 및 동의 철회 시 촬영본 폐기');

  await page.locator('#photo-consent').check();
  await page.locator('#open-camera').click();
  await page.locator('#take-photo').waitFor({state:'visible'});
  await page.locator('#take-photo').click();
  await page.locator('#analyze-photo').waitFor({state:'visible'});
  await page.locator('#analyze-photo').click();
  await page.waitForURL('**/3.html');
  await page.locator('#result-content .tone').waitFor();
  const upload=calls('POST','/analyses')[0].body.toString();
  assert.match(upload,/name="consent"\r\n\r\ntrue/);
  assert.match(upload,/name="image"; filename="capture.jpg"/);
  const resultText=await page.locator('#result-content').textContent();
  for(const text of ['서버에서 전달한 맞춤 스타일 요약','서버 추천 머리색','서버 추천 옷 색','서버 비교 옷 색','서버 추천 액세서리 안내','피그피그','기준 카드가 보이지 않아','백엔드 분석 근거','62점','재촬영·진단천 비교 권장'])assert(resultText.includes(text),text);
  assert.equal(await page.locator('.palette li').count(),6);
  assert.equal(await page.locator('.season-scores li').count(),4);
  assert.match(await page.locator('#session-controls').textContent(),/보관 만료 예정/);
  record('촬영 업로드와 v2 추천·점수·근거·경고·보관 시각 표시');

  await page.waitForFunction(()=>document.querySelector('[name="lip_color"]')?.value==='#a65b70');
  await page.locator('#apply-makeup').click();
  assert.match(await page.locator('#makeup-error').textContent(),/동의/);
  assert.equal(calls('POST','/try-ons').length,0);
  await page.locator('#makeup-consent').check();
  await page.locator('#apply-makeup').click();
  await page.locator('#comparison').waitFor({state:'visible'});
  assert.equal(calls('POST','/try-ons').length,1);
  await page.locator('#comparison-slider').fill('75');
  assert.equal(await page.locator('#comparison-frame').evaluate(element=>element.style.getPropertyValue('--split')),'75%');
  record('가상 메이크업 별도 동의와 전후 비교');

  await page.locator('#result-qr-link').click();
  await page.locator('#share-qr svg').waitFor();
  const publicLink=await page.locator('#open-card').getAttribute('href');
  await page.locator('#reset-booth').click();
  await page.waitForURL('**/1.html');
  assert.equal(calls('DELETE').length,0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ai-verse-analysis')),null);
  await page.goto(publicLink);
  await page.locator('#public-content .tone').waitFor();
  assert.match(await page.locator('#public-content').textContent(),/서버 추천 머리색/);
  assert(await page.locator('#booth-share').isHidden());
  record('다음 참가자 초기화는 서버 삭제 없이 QR 결과 유지');

  fresh();await session();
  await page.locator('#delete-analysis').click();
  await page.getByRole('button',{name:'취소',exact:true}).click();
  assert.equal(calls('DELETE').length,0);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ai-verse-analysis')),'analysis-under-test');
  await page.locator('#delete-analysis').click();
  assert.match(await page.locator('#delete-dialog-description').textContent(),/QR 공유 링크/);
  await page.locator('#confirm-delete').click();
  await page.waitForURL('**/1.html');
  assert.equal(calls('DELETE').length,1);
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ai-verse-analysis')),null);
  await page.goto(publicLink);
  await page.locator('#public-error').waitFor({state:'visible'});
  assert(await page.locator('#public-content').isHidden());
  record('삭제 취소·204 성공·세션 초기화 및 삭제 후 공유 결과 오류 처리');

  fresh();state.deleteStatus=500;await session('4.html');
  await page.locator('#delete-analysis').click();
  await page.locator('#confirm-delete').click();
  await page.locator('#delete-error').waitFor({state:'visible'});
  assert(page.url().endsWith('/4.html'));
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ai-verse-analysis')),'analysis-under-test');
  state.deleteStatus=204;
  await page.locator('#confirm-delete').click();
  await page.waitForURL('**/1.html');
  record('삭제 실패 시 결과 보존 및 재시도 성공');

  fresh();state.deleteStatus=404;await session();
  await page.locator('#delete-analysis').click();
  await page.locator('#confirm-delete').click();
  await page.waitForURL('**/1.html');
  record('이미 만료·삭제된 분석의 404 처리');

  fresh();state.deleteStatus=0;await session();
  await page.locator('#delete-analysis').click();
  await page.locator('#confirm-delete').click();
  await page.locator('#delete-error').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>sessionStorage.getItem('ai-verse-analysis')),'analysis-under-test');
  await page.getByRole('button',{name:'취소',exact:true}).click();
  record('네트워크 오류 시 삭제 완료로 처리하지 않고 세션 보존');

  fresh();state.failAnalysis=true;
  await page.goto(base+'1.html');
  await page.evaluate(()=>sessionStorage.setItem('ai-verse-analysis','analysis-under-test'));
  await page.goto(base+'3.html');
  await page.locator('#result-error').waitFor({state:'visible'});
  assert.match(await page.locator('#result-title').textContent(),/확인하지 못했어요/);
  state.failAnalysis=false;
  await page.locator('#retry-result').click();
  await page.locator('#result-content .tone').waitFor();
  assert.match(await page.locator('#result-title').textContent(),/발견했어요/);
  record('분석 조회 실패와 재시도 시 화면 상태');

  fresh();for(const key of ['content','reliability','warning_messages','reasons','season_scores'])delete state.result[key];
  await session();
  assert.equal(await page.locator('.season-scores').count(),0);
  assert.match(await page.locator('#result-content').textContent(),/애쉬 브라운/);
  record('기존 legacy 응답 호환');

  fresh();state.result.content.summary='<img src=x onerror=alert(1)>';
  await session();
  assert.equal(await page.locator('.result-summary img').count(),0);
  assert.equal(await page.locator('.result-summary').textContent(),'<img src=x onerror=alert(1)>');
  record('서버 문구는 HTML 실행 없이 텍스트로 표시');


  for(const product of lipCatalog){
   fresh();state.result.season=product.seasons[0];await session();
   await page.waitForFunction(color=>document.querySelector('[name="lip_color"]')?.value===color,product.color_hex.toLowerCase());
   assert.match(await page.locator('[name="lip_color"]').locator('..').textContent(),new RegExp(product.name));
   assert.equal(await page.locator('[name="blush_color"]').inputValue(),'#d9a0bb');
   assert.equal(await page.locator('[name="eye_color"]').inputValue(),'#9a7f9d');
   assert.equal(await page.locator('#lip-products').count(),0);
   assert.equal(await page.locator('#makeup-intensity').inputValue(),'55');
   assert.equal(await page.locator('#makeup-intensity').getAttribute('max'),'100');
   assert.equal(calls('POST','/try-ons').length,0);
   state.expectedLip=product.color_hex.toLowerCase();
   await page.locator('#makeup-consent').check();
   await page.locator('#apply-makeup').click();
   await page.locator('#comparison').waitFor({state:'visible'});
  }
  record('계절별 롬앤 립 초기값과 해당 HEX 전송, 블러셔·아이·강도 기존값 유지');

  fresh();await page.goto(base+'2.html');
  const pngBuffer=Buffer.from(await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=3200;canvas.height=2400;
   const ctx=canvas.getContext('2d');ctx.fillStyle='#e8b5a1';ctx.fillRect(0,0,canvas.width,canvas.height);
   return canvas.toDataURL('image/png').split(',')[1];
  }),'base64');
  const photoFile={name:'selfie.png',mimeType:'image/png',buffer:pngBuffer};
  await page.locator('#photo-file').setInputFiles(photoFile);
  assert.match(await page.locator('#capture-error').textContent(),/동의/);
  assert.equal(calls('POST').length,0);
  await page.locator('#photo-consent').check();
  await page.locator('#photo-file').setInputFiles(photoFile);
  await page.locator('#analyze-photo').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#analyze-photo').disabled);
  await page.locator('#captured-photo').evaluate(image=>image.decode());
  assert.equal(await page.locator('#captured-photo').evaluate(image=>image.naturalWidth),1600);
  assert.equal(await page.evaluate(()=>window.__cameraRequests),0);
  assert.equal(calls('POST').length,0);
  assert.match(await page.locator('#photo-source').textContent(),/기존 사진/);
  await page.locator('#analyze-photo').click();
  await page.waitForURL('**/3.html');
  const uploadedPhoto=calls('POST','/analyses')[0].body.toString();
  assert.match(uploadedPhoto,/filename="upload.jpg"/);
  assert.match(uploadedPhoto,/Content-Type: image\/jpeg/);
  record('기존 PNG 셀카 → 1600px JPEG 정규화 → 미리보기 → 웹캠 없이 분석 요청');

  fresh();await page.goto(base+'2.html');
  await page.locator('#photo-consent').check();
  for(const invalid of [
   {name:'photo.heic',mimeType:'image/heic',buffer:Buffer.from('invalid')},
   {name:'too-large.jpg',mimeType:'image/jpeg',buffer:Buffer.alloc(10*1024*1024+1)},
   {name:'damaged.png',mimeType:'image/png',buffer:Buffer.from('not an image')},
  ]){
   await page.locator('#photo-file').setInputFiles(invalid);
   await page.locator('#capture-error').waitFor({state:'visible'});
   assert(await page.locator('#analyze-photo').isHidden());
   assert.equal(calls('POST').length,0);
  }
  await page.locator('#photo-file').setInputFiles(photoFile);
  await page.locator('#analyze-photo').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#analyze-photo').disabled);
  await page.locator('#photo-consent').uncheck();
  assert(await page.locator('#captured-photo').isHidden());
  assert(await page.locator('#analyze-photo').isHidden());
  assert.equal(calls('POST').length,0);
  record('HEIC·용량 초과·손상 파일 거부 및 업로드 후 동의 철회');

  fresh();await page.goto(base+'2.html');
  await page.locator('#photo-consent').check();
  await page.locator('#open-camera').click();
  await page.locator('#take-photo').waitFor({state:'visible'});
  await page.locator('#take-photo').click();
  await page.locator('#photo-file').setInputFiles(photoFile);
  await page.locator('#analyze-photo').waitFor({state:'visible'});
  await page.waitForFunction(()=>!document.querySelector('#analyze-photo').disabled);
  assert(await page.evaluate(()=>window.__lastStream.getTracks().every(track=>track.readyState==='ended')));
  await page.locator('#retake-photo').click();
  await page.locator('#take-photo').waitFor({state:'visible'});
  assert(await page.locator('#captured-photo').isHidden());
  assert.equal(calls('POST').length,0);
  record('카운트다운 중 업로드로 전환 시 웹캠 중지, 다시 카메라로 전환');

  fresh();
  for(const [file,name] of [['1.html','start'],['2.html','capture'],['3.html','results'],['4.html','share'],['4.html#result=test-share-token-abcdefghijk','public']]){
   for(const width of [1440,768,390,320]){
    await page.setViewportSize({width,height:1000});
    if(file==='3.html'||file==='4.html') { await session(file); if(file==='3.html')await page.waitForFunction(()=>document.querySelector('[name="lip_color"]')?.value==='#a65b70'); }else { if(name==='public')await page.goto(base+'1.html'); await page.goto(base+file); }
    if(name==='public')await page.locator('#public-content .tone').waitFor();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${name} ${width}: overflow`);
    if(width===390&&name==='results'){
     await page.locator('#delete-analysis').click();
     assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
     await page.screenshot({path:path.join(output,'delete-confirmation-mobile.png')});
     await page.getByRole('button',{name:'취소',exact:true}).click();
    }
    if([1440,390].includes(width)){
     await page.evaluate(()=>{document.activeElement.blur();window.scrollTo({top:0,behavior:"instant"})});
     await page.screenshot({path:path.join(output,`${name}-${width}.png`),fullPage:true});
    }
   }
  }
  record('PC·태블릿·휴대폰·작은 휴대폰의 20개 화면과 삭제 대화상자 레이아웃');

  const beforeDemoDeletes=calls('DELETE').length;
  await page.goto(base+'3.html?demo=1');
  await page.locator('#result-content .tone').waitFor();
  assert(await page.locator('#makeup-consent-section').isHidden());
  await page.locator('#apply-makeup').click();
  await page.locator('#comparison').waitFor({state:'visible'});
  await page.locator('#delete-analysis').click();
  await page.locator('#confirm-delete').click();
  await page.waitForURL('**/1.html');
  assert.equal(calls('DELETE').length,beforeDemoDeletes);
  record('데모 모드는 서버 삭제·외부 전송 없이 동작');

  assert.equal(errors.length,0,errors.join('\n'));
  fs.writeFileSync(path.join(output,'frontend-review.json'),JSON.stringify({checks,errors},null,2));
  console.log(`Completed ${checks.length} checks; page errors: ${errors.length}`);
 }finally{
  if(browser)await browser.close();
  await new Promise(resolve=>server.close(resolve));
 }
})().catch(error=>{console.error(error);process.exitCode=1});
