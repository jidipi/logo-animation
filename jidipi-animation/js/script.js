(() => {
  const wrap = document.getElementById('wrap');
  const letters = Array.from(wrap.querySelectorAll('.letter'));
  const WORD = 'jidipi';

  const HIDE_INDICES = [0, 1, 3, 5];
  const D_INDEX = 2;
  const P_INDEX = 4;

  const OVERLAP_PX_RATIO = 0.128;

  function getFontSize() {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Math.max(64, Math.min(vw * 0.18, vh * 0.35, 220));
  }

  function measureInkBounds(char, fontSize) {
    const cvs = document.createElement('canvas');
    const size = Math.ceil(fontSize * 2);
    cvs.width = size;
    cvs.height = size;
    const c = cvs.getContext('2d');

    c.font = `${fontSize}px 'Game Over', monospace`;
    c.fillStyle = '#000';
    c.textBaseline = 'top';
    c.fillText(char, 0, 0);

    const imgData = c.getImageData(0, 0, size, size);
    const pixels = imgData.data;

    let minX = size, maxX = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (pixels[(y * size + x) * 4 + 3] > 10) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
        }
      }
    }

    return {
      inkLeft: minX,
      inkRight: maxX + 1,
      inkWidth: maxX + 1 - minX,
    };
  }

  let wordPositions = [];
  let mergePositions = [];
  let wrapW = 0;
  let wrapH = 0;
  let ready = false;

  function measure() {
    const fs = getFontSize();
    wrap.style.fontSize = fs + 'px';

    const testWrap = document.createElement('div');
    testWrap.style.cssText = `
      font-family:'Game Over',monospace;
      font-size:${fs}px;
      line-height:1;
      position:absolute;
      visibility:hidden;
      white-space:nowrap;
      -webkit-font-smoothing:none;
      display:inline-block;
    `;

    const spans = [];
    WORD.split('').forEach(ch => {
      const s = document.createElement('span');
      s.textContent = ch;
      s.style.display = 'inline-block';
      testWrap.appendChild(s);
      spans.push(s);
    });
    document.body.appendChild(testWrap);

    const wrapRect = testWrap.getBoundingClientRect();
    const charInfos = spans.map(s => {
      const r = s.getBoundingClientRect();
      return { x: r.left - wrapRect.left, w: r.width, h: r.height };
    });
    const totalW = wrapRect.width;
    const totalH = wrapRect.height;
    document.body.removeChild(testWrap);

    wordPositions = charInfos;
    wrapW = totalW;
    wrapH = totalH;
    wrap.style.width = wrapW + 'px';
    wrap.style.height = wrapH + 'px';

    const dInk = measureInkBounds('d', fs);
    const pInk = measureInkBounds('p', fs);
    const dCharW = charInfos[D_INDEX].w;

    const dRightBearing = dCharW - dInk.inkRight;
    const pLeftBearing = pInk.inkLeft;
    const bearingOverlap = dRightBearing + pLeftBearing;

    const extraOverlap = Math.round(fs * OVERLAP_PX_RATIO);

    const centerX = wrapW / 2;
    const combinedInkW = dInk.inkWidth + pInk.inkWidth - extraOverlap;

    const dMergeX = centerX - combinedInkW / 2 - dInk.inkLeft;
    const pMergeX = dMergeX + dCharW - bearingOverlap - extraOverlap;

    mergePositions = wordPositions.map((pos, i) => {
      if (i === D_INDEX) return { x: dMergeX };
      if (i === P_INDEX) return { x: pMergeX };
      return { x: centerX - pos.w / 2 };
    });

    letters.forEach((el, i) => {
      el.style.left = wordPositions[i].x + 'px';
    });

    ready = true;
  }

  function easeInOutCubic(t) {
    return t < 0.5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
  }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function clamp(v) { return Math.max(0, Math.min(1, v)); }

  const TL = {
    holdWord: 2.0,
    merge:    1.8,
    holdLogo: 2.0,
    split:    1.8,
  };
  const CYCLE = TL.holdWord + TL.merge + TL.holdLogo + TL.split;

  function getProgress(sec) {
    const t = sec % CYCLE;
    if (t < TL.holdWord) return 0;
    if (t < TL.holdWord + TL.merge) {
      return easeInOutCubic((t - TL.holdWord) / TL.merge);
    }
    if (t < TL.holdWord + TL.merge + TL.holdLogo) return 1;
    return 1 - easeInOutCubic(
      (t - TL.holdWord - TL.merge - TL.holdLogo) / TL.split
    );
  }

  let t0 = null;

  function frame(ts) {
    if (!ready) { requestAnimationFrame(frame); return; }
    if (t0 === null) t0 = ts;

    const sec = (ts - t0) / 1000;
    const p = getProgress(sec);

    letters.forEach((el, i) => {
      const fromX = wordPositions[i].x;
      const toX = mergePositions[i].x;
      const currentX = lerp(fromX, toX, p);
      const dx = currentX - fromX;

      el.style.transform = `translateX(${dx}px)`;

      if (HIDE_INDICES.includes(i)) {
        const opacity = 1 - clamp((p - 0.55) / 0.25);
        el.style.opacity = opacity;
      } else {
        el.style.opacity = 1;
      }
    });

    requestAnimationFrame(frame);
  }

  function init() {
    measure();
    requestAnimationFrame(frame);
  }

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      ready = false;
      measure();
      ready = true;
    }, 200);
  });

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(() => setTimeout(init, 200));
  } else {
    window.addEventListener('load', () => setTimeout(init, 500));
  }
})();