const BRANCHES = { busan: '부산점', daegu: '대구점' };
const PAGE_SIZE = 4;
let assetPromise;

export function posterDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('ko-KR', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: 'numeric', day: 'numeric', weekday: 'short'
  }).formatToParts(now);
  const value = type => parts.find(part => part.type === type).value;
  return {
    label: `${value('month')}/${value('day')}(${value('weekday')})`,
    filename: `${value('year')}-${value('month').padStart(2, '0')}-${value('day').padStart(2, '0')}`
  };
}

export function posterPages(couples) {
  const pages = [];
  for (let i = 0; i < couples.length; i += PAGE_SIZE) pages.push(couples.slice(i, i + PAGE_SIZE));
  return pages;
}

async function loadAssets() {
  if (!assetPromise) {
    assetPromise = Promise.all([
      new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error('포스터 배경을 불러오지 못했습니다. 다시 시도해 주세요.'));
        image.src = new URL('./assets/couple-poster-background.png', import.meta.url).href;
      }),
      new FontFace('SumitPoster', `url(${new URL('./assets/NotoSansKR.ttf', import.meta.url).href})`, { weight: '100 900' })
        .load().then(font => { document.fonts.add(font); })
    ]).catch(error => { assetPromise = undefined; throw error; });
  }
  return assetPromise;
}

function text(ctx, value, x, y, size, width, color = '#f5f4ef', weight = 300) {
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size}px SumitPoster, sans-serif`;
  while (ctx.measureText(value).width > width && size > 16) {
    size -= 1;
    ctx.font = `${weight} ${size}px SumitPoster, sans-serif`;
  }
  ctx.fillText(value, x, y, width);
}

function rule(ctx, y) {
  ctx.strokeStyle = '#eeefdb'; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(140, y); ctx.lineTo(520, y);
  ctx.lineTo(532, y - 8); ctx.lineTo(532, y + 7); ctx.lineTo(545, y);
  ctx.lineTo(940, y); ctx.stroke();
}

function nameplate(ctx, name, x, y, width, color) {
  ctx.fillStyle = color === 'blue' ? '#655293b8' : '#aa537bb8';
  ctx.fillRect(x - width / 2, y - 43, width, 86);
  ctx.strokeStyle = color === 'blue' ? '#a8baff' : '#f3a2c6';
  ctx.lineWidth = 3; ctx.strokeRect(x - width / 2, y - 43, width, 86);
  text(ctx, name, x, y - 2, 48, width - 26, '#fff', 500);
}

export async function renderPoster({ couples, floor, date, total = couples.length, page = 1, pages = 1 }) {
  if (!BRANCHES[floor] || !couples.length || couples.length > PAGE_SIZE) throw new Error('포스터 정보를 확인해 주세요.');
  const [background] = await loadAssets();
  const canvas = document.createElement('canvas');
  canvas.width = 1080; canvas.height = 1920;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(background, 0, 0, 1080, 1920);
  text(ctx, date.label, 540, 305, 64, 800);
  rule(ctx, 370);
  const gradient = ctx.createLinearGradient(0, 403, 0, 492);
  gradient.addColorStop(0, '#dcec9c'); gradient.addColorStop(1, '#fff');
  text(ctx, `썸잇 ${BRANCHES[floor]} 커플매칭`, 540, 448, 82, 820, gradient);
  rule(ctx, 523);
  const multiple = couples.length > 1;
  const start = 1002 - (couples.length - 1) * 50;
  couples.forEach((couple, index) => {
    const y = start + index * 100;
    nameplate(ctx, couple.person1, multiple ? 350 : 324, y, multiple ? 236 : 274, 'blue');
    nameplate(ctx, couple.person2, multiple ? 730 : 756, y, multiple ? 236 : 274, 'pink');
    text(ctx, '♡', 540, y - 3, 76, 90);
  });
  text(ctx, total === 1 ? '커플 탄생' : `총 ${total}커플 탄생`, 540, 1600, 52, 650);
  text(ctx, `${total} ${total === 1 ? 'COUPLE' : 'COUPLES'}`, 540, 1680, 40, 680);
  if (pages > 1) text(ctx, `${page} / ${pages}`, 540, 1762, 27, 300, '#c8c8c8');
  return canvas;
}

export function setupCouplePoster(button) {
  let current = { floor: '', couples: [] };
  let revision = 0;
  let activeDialog;
  const dismiss = () => { if (activeDialog) activeDialog.close(); };
  function update(floor, couples) {
    current = { floor, couples: couples.map(({ person1, person2 }) => ({ person1, person2 })) };
    revision += 1;
    button.disabled = !BRANCHES[floor] || !couples.length;
    dismiss();
  }
  button.addEventListener('click', async () => {
    const snapshot = { floor: current.floor, couples: current.couples.map(couple => ({ ...couple })) };
    if (!snapshot.couples.length || !BRANCHES[snapshot.floor]) return;
    const date = posterDate(); // Freeze Korean date at the button click, including across midnight.
    const version = revision;
    const originalText = button.textContent;
    button.disabled = true; button.textContent = '포스터 만드는 중…';
    const dialog = document.createElement('dialog');
    dialog.className = 'couple-poster-dialog';
    dialog.setAttribute('aria-label', '커플매칭 포스터 미리보기');
    const heading = document.createElement('h2'); heading.textContent = `${date.label} 썸잇 ${BRANCHES[snapshot.floor]} 커플매칭`;
    const close = document.createElement('button'); close.type = 'button'; close.textContent = '닫기'; close.className = 'poster-close';
    close.addEventListener('click', () => dialog.close());
    dialog.append(close, heading);
    const description = document.createElement('p');
    description.textContent = '1080 × 1920 · 이미지를 저장해 스토리에 올려주세요.';
    dialog.append(description);
    const urls = [];
    dialog.addEventListener('close', () => {
      urls.forEach(url => URL.revokeObjectURL(url)); dialog.remove();
      if (activeDialog === dialog) activeDialog = undefined;
    }, { once: true });
    try {
      const groups = posterPages(snapshot.couples);
      // Generate sequentially to keep mobile memory usage bounded.
      for (let i = 0; i < groups.length; i += 1) {
        const canvas = await renderPoster({ ...snapshot, couples: groups[i], date, total: snapshot.couples.length, page: i + 1, pages: groups.length });
        const blob = await new Promise((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('이미지를 만들지 못했습니다.')), 'image/png'));
        canvas.width = canvas.height = 0;
        if (version !== revision) return;
        const url = URL.createObjectURL(blob); urls.push(url);
        const section = document.createElement('section');
        const image = document.createElement('img'); image.src = url;
        image.alt = `${date.label} ${BRANCHES[snapshot.floor]} 커플매칭 ${i + 1}번째 포스터`;
        const filename = `썸잇_${BRANCHES[snapshot.floor]}_${date.filename}_${i + 1}.png`;
        const download = document.createElement('a'); download.href = url; download.download = filename;
        download.className = 'poster-download'; download.textContent = groups.length > 1 ? `${i + 1}번 포스터 PNG 저장` : '포스터 PNG 저장';
        section.append(image, download);
        const file = new File([blob], filename, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          const share = document.createElement('button'); share.type = 'button'; share.textContent = '공유 / 사진에 저장';
          share.addEventListener('click', async () => {
            try { await navigator.share({ files: [file] }); }
            catch (error) { if (error.name !== 'AbortError') alert('PNG 저장 버튼을 이용해 주세요.'); }
          });
          section.append(share);
        }
        dialog.append(section);
      }
      if (version !== revision) return;
      document.body.append(dialog); activeDialog = dialog; dialog.showModal();
    } catch (error) {
      if (version === revision) alert(error.message || '포스터를 만들지 못했습니다. 다시 시도해 주세요.');
    } finally {
      if (!dialog.open) { urls.forEach(url => URL.revokeObjectURL(url)); dialog.remove(); }
      button.textContent = originalText;
      button.disabled = !BRANCHES[current.floor] || !current.couples.length;
    }
  });
  return { update };
}
