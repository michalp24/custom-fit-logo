const assert = require('node:assert/strict');
const { chromium } = require(process.env.PLAYWRIGHT_PATH || 'playwright');
(async () => {
  const { createServer } = await import('vite');
  const server = process.env.TEST_URL ? null : await createServer({ server: { host: '127.0.0.1', port: 0 } });
  if (server) await server.listen();
  const testUrl = process.env.TEST_URL || `http://127.0.0.1:${server.httpServer.address().port}/?logo=partner`;
  const browser = await chromium.launch({ headless: true, channel: process.env.BROWSER_CHANNEL || 'chrome' });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(testUrl);
  await page.waitForSelector('[data-nvidia]');
  const result = await page.evaluate(async () => {
    const { useLogoStore } = await import('/src/store/logoStore.ts');
    const { exportLogo } = await import('/src/utils/renderLogo.ts');
    const { normalizeSVG, parseSVGBounds } = await import('/src/utils/logoProcessor.ts');
    const { getLayout } = await import('/src/utils/layout.ts');
    const store = () => useLogoStore.getState();
    const checks = [];
    function check(test, msg) { if (!test) throw new Error(msg); checks.push(msg); }
    check(store().logoOrder === 'nvidia-right', 'NVIDIA Right is the default');
    const styled = normalizeSVG(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><style>rect { fill: url('#paint'); }</style><defs><linearGradient id="paint"><stop stop-color="red"/><stop offset="1" stop-color="blue"/></linearGradient></defs><rect width="100" height="100"/></svg>`);
    check(!styled.includes('<style') && styled.includes('url(#paint)'), 'SVG styles isolated and internal gradients preserved');
    // ViewBox-only input, inherited fill, nested transform and asymmetrical decoration.
    const source = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="100 200 400 300" fill="#000000"><g transform="translate(100 200) scale(2)"><rect width="100" height="20"/><path fill="#ff9900" d="M10 22 Q50 60 90 22 L90 30 Q50 70 10 30Z"/></g></svg>';
    const bounds = parseSVGBounds(normalizeSVG(source));
    check(bounds.minX === 100 && bounds.minY === 200 && bounds.width === 200, 'Transformed SVG geometry measured');
    await store().loadLogo(new File([source], 'amazon-like.svg', { type: 'image/svg+xml' }));
    store().setUI({ lockupOrientation: 'horizontal' });
    let s = store();
    function contained() {
      const s = store(), b = s.bounds, guide = getLayout(s.isPartner, s.lockupOrientation, s.logoOrder).body;
      const x = s.anchor[0] + s.offsetX, y = s.anchor[1] + s.offsetY;
      return x - b.width*s.scale/2 >= guide.x-1e-6 && x+b.width*s.scale/2 <= guide.x+guide.width+1e-6 && y-b.height*s.scale/2 >= guide.y-1e-6 && y+b.height*s.scale/2 <= guide.y+guide.height+1e-6;
    }
    check(contained() && store().scaleFactor === 1, 'Upload fits full artwork at 100%');
    const initialScale = store().scale;
    store().setTransform({ scaleFactor: 2.5 });
    check(store().scale === initialScale * 2.5 && !contained(), 'Manual scaling reaches 250% beyond guide');
    const initialY = store().offsetY;
    // Position the mock wordmark (y=200..240) on the guide while its smile extends below.
    const letteringCenterY = 220;
    store().setTransform({ offsetY: initialY + (store().anchor[1] - letteringCenterY) * store().scale });
    check(store().offsetY !== initialY && store().scaleFactor === 2.5, 'Nudging remains free at 250%');
    s = store();
    const previewTransform = `translate(${s.offsetX} ${s.offsetY}) translate(${s.anchor[0]} ${s.anchor[1]}) scale(${s.scale}) translate(${-s.anchor[0]} ${-s.anchor[1]})`;
    const svg = await exportLogo(s, 'svg');
    const doc = new DOMParser().parseFromString(await svg.text(), 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error(doc.querySelector('parsererror').textContent);
    check(doc.querySelector('[data-partner]').getAttribute('transform') === previewTransform, 'Export preserves exact preview placement');
    check(doc.querySelectorAll('[data-main-guide], [data-body-guide]').length === 0, 'Guides excluded from export');
    check(doc.querySelector('[data-nvidia] path') && !doc.querySelector('[data-nvidia]').hasAttribute('href'), 'NVIDIA vector paths included directly in SVG export');
    async function pixels(blob) {
      const url = URL.createObjectURL(blob); const img = new Image();
      await new Promise((resolve,reject) => { img.onload = resolve; img.onerror = reject; img.src = url; });
      const c = document.createElement('canvas'); c.width=img.width; c.height=img.height;
      const ctx=c.getContext('2d');ctx.drawImage(img,0,0); URL.revokeObjectURL(url);
      return { c, ctx };
    }
    const png = await exportLogo(s, 'png');
    const {ctx,c} = await pixels(png);
    check(c.width === 1920 && c.height === 1080, 'PNG canvas dimensions');
    check(ctx.getImageData(0,0,1,1).data[3] === 0, 'Transparent PNG background');
    const p = ctx.getImageData(Math.round(s.anchor[0]+s.offsetX), Math.round(s.anchor[1]+s.offsetY+(220-s.anchor[1])*s.scale),1,1).data;
    check(p[3] === 255 && p[0] === 0 && p[1] === 0, 'Black rectangle artwork survives transparent export');
    const jpg = await exportLogo(s, 'jpg');
    check(jpg.type === 'image/jpeg', 'JPG uses actual JPEG encoding');
    const whiteSource = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#ffffff"/></svg>';
    await store().loadLogo(new File([whiteSource], 'white.svg', {type:'image/svg+xml'}));
    store().setUI({isDarkCanvas:true});
    const dark = await pixels(await exportLogo(store(), 'jpg'));
    check(dark.ctx.getImageData(0,0,1,1).data[0] < 5, 'Dark JPG keeps preview background');
    const white = await pixels(await exportLogo(store(), 'png'));
    const whitePixel = white.ctx.getImageData(Math.round(store().anchor[0]+store().offsetX), Math.round(store().anchor[1]+store().offsetY),1,1).data;
    check(whitePixel[0] === 255 && whitePixel[3] === 255, 'White logo artwork survives transparent export');
    store().setUI({isDarkCanvas:false});
    for (const orientation of ['horizontal','vertical']) for (const order of ['nvidia-left','nvidia-right']) {
      store().setUI({ lockupOrientation: orientation, logoOrder: order });
      check(contained(), `${orientation} ${order} fits`);
    }
    for (const lockupOrientation of ['vertical', 'horizontal']) {
      for (const logoOrder of ['nvidia-left', 'nvidia-right']) {
        for (const isDarkCanvas of [false, true]) {
          store().setUI({lockupOrientation, logoOrder, isDarkCanvas});
          const current = store();
          const box = getLayout(true, lockupOrientation, logoOrder).nvidia;
          for (const format of ['svg', 'png', 'png-bg', 'jpg']) {
            const exported = await exportLogo(current, format);
            const rendered = await pixels(exported);
            const data = rendered.ctx.getImageData(Math.ceil(box.x), Math.ceil(box.y), Math.floor(box.width), Math.floor(box.height)).data;
            let green = 0, wordmark = 0;
            const sampleWidth = Math.floor(box.width);
            for (let i = 0; i < data.length; i += 4) {
              const x = (i/4) % sampleWidth, y = Math.floor(i/4/sampleWidth);
              if (data[i+3] < 240) continue;
              if (data[i] > 60 && data[i] < 180 && data[i+1] > 130 && data[i+1] > data[i]+25 && data[i+2] < 80) green++;
              const inWordmark = lockupOrientation === 'horizontal' ? x > box.width*0.35 : y > box.height*0.75;
              if (inWordmark && (isDarkCanvas ? data[i]>230 && data[i+1]>230 && data[i+2]>230 : data[i]<25 && data[i+1]<25 && data[i+2]<25)) wordmark++;
            }
            check(green > 1000 && wordmark > 1000, `NVIDIA eye and wordmark visible: ${format}, ${lockupOrientation}, ${logoOrder}, ${isDarkCanvas?'dark':'light'}`);
          }
        }
      }
    }
    store().setUI({isDarkCanvas:false});
    store().setMode(false); store().refit();
    check(contained(), 'Single-logo refit works without require');
    const { TEMPLATE_PATH } = await import('/src/utils/templateFit.ts');
    const templatePath = new Path2D(TEMPLATE_PATH);
    for (const [name, artwork] of [
      ['wide', '<rect width="900" height="200"/>'],
      ['tall', '<rect width="120" height="900"/>'],
      ['square', '<rect width="400" height="400"/>'],
      ['stroke', '<rect x="20" y="20" width="80" height="80" fill="none" stroke="black" stroke-width="12"/>'],
    ]) {
      await store().loadLogo(new File([`<svg xmlns="http://www.w3.org/2000/svg">${artwork}</svg>`], `${name}.svg`, {type:'image/svg+xml'}));
      const initialScale = store().scale;
      store().setTransform({scaleFactor:2.5});
      check(store().scale <= initialScale, `Template ${name}: scaling stops at boundary`);
      for (const [dx,dy] of [[0,0],[2000,0],[-4000,0],[0,-3000],[0,6000],[2000,-3000]]) {
        const beforeNudge = store().scale;
        store().setTransform({offsetX:store().offsetX+dx,offsetY:store().offsetY+dy});
        check(Math.abs(store().scale-beforeNudge)<1e-8, `Template ${name}: boundary nudge preserves size (${dx},${dy})`);
        const rendered = await pixels(await exportLogo(store(), 'png'));
        check(rendered.c.width===1250 && rendered.c.height===703, 'Template uses supplied canvas dimensions');
        const data=rendered.ctx.getImageData(0,0,1250,703).data;
        let outside=0,visible=0;
        for(let y=0;y<703;y++) for(let x=0;x<1250;x++) {
          if(data[(y*1250+x)*4+3]<128) continue;
          visible++;
          if(!rendered.ctx.isPointInPath(templatePath,x+0.5,y+0.5)) outside++;
        }
        check(visible>100 && outside===0, `Template ${name}: whole exported artwork inside supplied shape (${dx},${dy})`);
      }
      const exportedDoc = new DOMParser().parseFromString(await (await exportLogo(store(),'svg')).text(),'image/svg+xml');
      check(!exportedDoc.querySelector('[data-main-guide], clipPath'), 'Template export fits artwork without guide or clipping');
    }
    // A tiny valid SVG must scale above the old arbitrary 10x ceiling.
    await store().loadLogo(new File(['<svg xmlns="http://www.w3.org/2000/svg"><rect width="1" height="1"/></svg>'], 'tiny.svg', {type:'image/svg+xml'}));
    check(store().scale > 10 && contained(), 'Tiny SVG fits without an arbitrary scale ceiling');
    const original=store().logoData;
    try { await store().loadLogo(new File(['not svg'], 'broken.svg', {type:'image/svg+xml'})); } catch {}
    check(!store().isProcessing && store().logoData === original, 'Failed upload preserves prior logo and clears loading');
    const raster = document.createElement('canvas');raster.width=100;raster.height=100;
    const rc=raster.getContext('2d');rc.fillStyle='#123456';rc.fillRect(30,40,20,10);
    const blob=await new Promise(resolve=>raster.toBlob(resolve));
    await store().loadLogo(new File([blob], 'raster.png', {type:'image/png'}));
    check(store().bounds.x===0 && store().bounds.y===0 && store().bounds.width===20 && store().bounds.height===10, 'Raster transparent padding cropped to local coordinates');
    check(store().logoData.includes('data:image/png;base64,'), 'Raster pixels preserved');
    const jpgBlob = await new Promise(resolve => raster.toBlob(resolve, 'image/jpeg'));
    await store().loadLogo(new File([jpgBlob], 'photo.jpg', {type:'image/jpeg'}));
    check(store().logoType === 'raster', 'JPEG uploads supported');
    const pending = store().loadLogo(new File([source], 'pending.svg', {type:'image/svg+xml'}));
    store().clearLogo(); await pending;
    check(store().logoData === null && !store().isProcessing, 'Clearing logo cancels pending upload');
    store().setMode(true); store().setUI({lockupOrientation:'horizontal',logoOrder:'nvidia-left'});
    await store().loadLogo(new File([source], 'test.svg', {type:'image/svg+xml'}));
    return checks;
  });
  assert.equal(await page.getByText('Logo body', {exact:true}).count(), 0);
  assert.equal(await page.locator('[id^="body-"]').count(), 0);
  const slider = page.getByRole('slider');
  assert.equal(await slider.getAttribute('aria-valuemax'), '250');
  const initialWidth = await page.locator('[data-partner]').evaluate(el => el.getBoundingClientRect().width);
  await slider.focus(); await slider.press('End');
  assert.equal(await slider.getAttribute('aria-valuenow'), '250');
  const enlargedWidth = await page.locator('[data-partner]').evaluate(el => el.getBoundingClientRect().width);
  assert.ok(Math.abs(enlargedWidth / initialWidth - 2.5) < 0.001);
  const placement = () => page.locator('[data-partner]').evaluate(el => {
    const matrix = el.transform.baseVal.consolidate().matrix;
    return { x: matrix.e, y: matrix.f, scale: matrix.a };
  });
  for (const amount of [100, 250]) {
    await slider.focus(); await slider.press('Home');
    // Slider Home is 1%; use keyboard to exercise the actual control.
    for (let i = 1; i < amount; i++) await slider.press('ArrowRight');
    for (const [name, dx, dy] of [['↑',0,-5], ['→',5,0], ['↓',0,5], ['←',-5,0]]) {
      const before = await placement();
      await page.getByRole('button', {name,exact:true}).click();
      const after = await placement();
      assert.ok(Math.abs(after.x-before.x-dx) < 1e-6 && Math.abs(after.y-before.y-dy) < 1e-6);
      assert.equal(after.scale, before.scale);
    }
    const before = await placement();
    // The position button remains focused after clicking it.
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Shift+ArrowDown');
    const after = await placement();
    assert.ok(Math.abs(after.x-before.x-1) < 1e-6 && Math.abs(after.y-before.y-10) < 1e-6, 'Keyboard positioning must work after clicking a position button');
    assert.equal(after.scale, before.scale);
    await page.getByRole('button', {name:'Center',exact:true}).click();
    assert.equal((await placement()).scale, before.scale);
  }
  await slider.focus();
  const beforeCanvas = await placement();
  await page.getByRole('region', {name:'Logo positioning canvas'}).click({position:{x:20,y:20}});
  await page.keyboard.press('ArrowLeft');
  assert.ok(Math.abs((await placement()).x-beforeCanvas.x+1) < 1e-6);
  const sameModePreservesPosition = await page.evaluate(async () => {
    const { useLogoStore } = await import('/src/store/logoStore.ts');
    const before = useLogoStore.getState();
    before.setMode(before.isPartner);
    const after = useLogoStore.getState();
    return before.offsetX === after.offsetX && before.offsetY === after.offsetY && before.scale === after.scale;
  });
  assert.ok(sameModePreservesPosition);
  const relativePlacement = () => page.evaluate(() => {
    const group = document.querySelector('[data-partner]');
    const matrix = group.transform.baseVal.consolidate().matrix;
    const guide = document.querySelector('[data-main-guide]');
    return { x: matrix.e - Number(guide.getAttribute('x')), y: matrix.f - Number(guide.getAttribute('y')), scale: matrix.a };
  });
  for (const layout of ['Vertical', 'Horizontal']) {
    await page.getByRole('tab', {name:layout,exact:true}).click();
    await page.getByRole('button', {name:'NVIDIA Right',exact:true}).click();
    await slider.focus(); await slider.press('End');
    await page.getByRole('button', {name:'→',exact:true}).click();
    await page.getByRole('button', {name:'↑',exact:true}).click();
    const beforeSwap = await relativePlacement();
    for (let i = 0; i < 3; i++) {
      for (const side of ['NVIDIA Left', 'NVIDIA Right']) {
        await page.getByRole('button', {name:side,exact:true}).click();
        const afterSwap = await relativePlacement();
        assert.ok(Math.abs(afterSwap.x-beforeSwap.x)<1e-6 && Math.abs(afterSwap.y-beforeSwap.y)<1e-6, `${layout}: switching sides must preserve manual offset`);
        assert.equal(afterSwap.scale, beforeSwap.scale);
        assert.equal(await slider.getAttribute('aria-valuenow'), '250');
      }
    }
  }
  const exportMatchesPosition = await page.evaluate(async () => {
    const { useLogoStore } = await import('/src/store/logoStore.ts');
    const { exportLogo } = await import('/src/utils/renderLogo.ts');
    const preview = document.querySelector('[data-partner]').getAttribute('transform');
    const blob = await exportLogo(useLogoStore.getState(), 'svg');
    return new DOMParser().parseFromString(await blob.text(), 'image/svg+xml').querySelector('[data-partner]').getAttribute('transform') === preview;
  });
  assert.ok(exportMatchesPosition);
  await page.getByRole('button', {name:'Export', exact:true}).click();
  const beforeFilename = await placement();
  const filename = page.getByLabel('File Name');
  await filename.fill(''); await filename.pressSequentially('fifty');
  assert.equal(await filename.inputValue(), 'fifty');
  await filename.press('ArrowLeft'); await filename.pressSequentially('x');
  assert.equal(await filename.inputValue(), 'fiftxy');
  assert.deepEqual(await placement(), beforeFilename);
  await page.getByRole('button', {name:'Cancel',exact:true}).click();
  await page.getByRole('dialog').waitFor({state:'hidden'});
  await page.screenshot({path:'/tmp/logo-exporter-reviewed.png', fullPage:true});
  assert.deepEqual(errors, []);
  console.log(JSON.stringify({passed:[...result,'Exclude controls removed','Slider reaches 250% and enlarges preview','Position buttons work at 100% and 250%','Keyboard nudging works with a position button focused','Center preserves scale','Clicking canvas restores keyboard positioning','Same-mode initialization preserves adjustments','Repeated side swaps preserve scale and relative position in both layouts','Export matches manual positioning','Filename keyboard editing','No browser errors']},null,2));
  await browser.close();
  if (server) await server.close();
})().catch(e => { console.error(e); process.exit(1); });
