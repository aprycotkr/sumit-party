import { pages, adminPage } from './pages.js';
import { pageHeader, infoCard } from './ui-components.js';

const routeToHash = (route) => `#${route}`;
const normalizeRoute = () => {
  const hashRoute = window.location.hash.replace(/^#/, '');
  if (hashRoute) return hashRoute.startsWith('/') ? hashRoute : `/${hashRoute}`;
  return window.location.pathname === '/' ? '/' : window.location.pathname;
};

function resolveRoute(route) {
  const aliases = {
    '/profile': '/table',
    '/match': '/likes',
    '/event': '/game',
    '/help': '/more'
  };
  return aliases[route] || route;
}

function appendIf(parent, node) {
  if (parent && node) parent.appendChild(node);
}

function closestCard(selector) {
  const el = document.querySelector(selector);
  return el ? el.closest('.card') : null;
}

function createRoutePage(page) {
  const section = document.createElement('section');
  section.id = page.id;
  section.className = 'route-page hidden';
  section.dataset.route = page.route;
  if (!page.hideHeader) section.appendChild(pageHeader(page));
  return section;
}

function buildEntryPage() {
  const entry = document.getElementById('entry');
  if (!entry) return;
  entry.dataset.route = '/';
  entry.classList.add('route-page');
  const form = entry.querySelector('.entry-form');
  const logo = entry.querySelector('img');
  if (logo) logo.classList.add('entry-logo');
  if (form && !entry.querySelector('.page-header')) {
    entry.insertBefore(pageHeader({
      title: '파티 입장',
      description: '닉네임과 기본 정보만 입력하면 바로 시작할 수 있어요.'
    }), form);
  }
}

function buildAnnouncementsCard() {
  const card = infoCard({
    title: '공지사항',
    body: '<p class="card-subtitle">스태프 안내와 운영 공지를 확인하세요.</p><div id="announcements">공지 없음</div>'
  });
  card.id = 'announcementsCard';
  return card;
}

function enhanceHomeGreeting(card) {
  if (!card) return null;
  card.classList.add('home-greeting-card');
  const greeting = card.querySelector('#greeting');
  if (greeting && !card.querySelector('.home-date')) {
    const date = document.createElement('div');
    date.className = 'home-date';
    const now = new Date();
    date.textContent = `${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')}`;
    greeting.insertAdjacentElement('afterend', date);
  }
  return card;
}

function buildHomeRoundInfo(timerCard, tableCard) {
  if (!timerCard && !tableCard) return null;
  const wrap = document.createElement('div');
  wrap.className = 'home-round-info';
  appendIf(wrap, timerCard);
  appendIf(wrap, tableCard);
  return wrap;
}

function buildHomePartyCard() {
  const card = document.createElement('div');
  card.className = 'home-party-card';
  card.innerHTML = `
    <div class="home-party-head">
      <div class="home-party-icon">🎉</div>
      <div>
        <span class="home-small-badge" id="homePartyBadge">1부 진행 중</span>
        <span id="homeTableDisplay" style="font-size:11px;font-weight:700;color:#ffc107;background:rgba(255,193,7,0.15);border:1px solid rgba(255,193,7,0.35);border-radius:6px;padding:2px 8px;margin-left:6px;display:inline-block;">테이블 확인 중</span>
        <h2>파티 시작! 🎉</h2>
      </div>
    </div>
    <p class="home-party-copy">
      <span>다른 참가자들을 둘러보고 마음에 드는 분에게 호감을 표현해보세요!</span>
      <span>무료 호감 <strong id="homePopularityLeft">3개 남음</strong>.</span>
    </p>
    <div class="home-party-actions">
      <a class="home-party-action primary" href="#/participants"><span>♡</span><strong>호감 보내기 및 참가자 보기</strong><em>›</em></a>
    </div>
  `;
  return card;
}

function buildLikeStatusDashboard() {
  const card = document.createElement('section');
  card.className = 'like-status-dashboard';
  card.innerHTML = `
    <div class="like-status-head">
      <h2>호감 현황</h2>
      <p>매칭 결과를 확인하세요.</p>
    </div>
    <div class="like-status-tabs" id="likeStatusTabs">
      <button type="button" class="active" data-like-tab="final"><span>☑ 최종</span><strong id="likeFinalCount">(0)</strong></button>
      <button type="button" data-like-tab="match"><span>♡ 매칭</span><strong id="likeMatchCount">(0)</strong></button>
      <button type="button" data-like-tab="received"><span>받은 호감</span><strong id="likeReceivedCount">(0)</strong></button>
      <button type="button" data-like-tab="sent"><span>보낸 호감</span><strong id="likeSentCount">(0)</strong></button>
    </div>
    <div class="like-result-card" id="likeResultCard">
      <div class="like-result-art">♡</div>
      <div id="likeResultContent" class="like-result-content">
        <strong>결과 대기중</strong>
        <p>호감 공개 후 확인할 수 있어요.</p>
      </div>
    </div>
  `;
  card.querySelectorAll('[data-like-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      card.querySelectorAll('[data-like-tab]').forEach((item) => item.classList.toggle('active', item === button));
      window.renderLikeStatusDashboard?.(button.dataset.likeTab);
    });
  });
  return card;
}

function buildParticipantShell() {
  const main = document.getElementById('main');
  if (!main || main.dataset.routed === 'true') return;

  const homePage = createRoutePage(pages.find(page => page.route === '/home'));
  const participantsPage = createRoutePage(pages.find(page => page.route === '/participants'));
  const likesPage = createRoutePage(pages.find(page => page.route === '/likes'));
  const tablePage = createRoutePage(pages.find(page => page.route === '/table'));
  const gamePage = createRoutePage(pages.find(page => page.route === '/game'));
  const morePage = createRoutePage(pages.find(page => page.route === '/more'));

  const greetingCard = enhanceHomeGreeting(document.getElementById('greeting')?.closest('.card'));
  const timerCard = document.getElementById('timerDisplay');
  const tableRotationCard = document.getElementById('tableRotationCard');
  const editCard = document.getElementById('newNickInput')?.closest('.card');
  const tableMapCard = document.getElementById('participantTableMap')?.closest('.card');
  const statsCard = document.getElementById('homeReceivedLikeSummary')?.closest('.card');
  const cupidNoticeCard = document.getElementById('cupidNotifications')?.closest('.card');
  const participantListCard = closestCard('#oppositeList');
  const conversationCard = closestCard('#conversationTopic');
  const legacyLikeControls = document.getElementById('cupidList')?.closest('.card')?.parentElement;
  const rankingCard = document.getElementById('maleRank1')?.closest('.card');
  const songCard = closestCard('#songTitle');
  const sosCard = closestCard('#sosReason');
  const requestRow = songCard && sosCard && songCard.parentElement === sosCard.parentElement ? songCard.parentElement : null;
  const leaveCard = closestCard('#leaveBtn');
  const noteInboxCard = closestCard('#noteInboxList');

  if (statsCard) statsCard.classList.add('home-stats-card');
  if (leaveCard) leaveCard.classList.add('home-leave-card');
  if (tableMapCard) tableMapCard.classList.add('table-overview-card');
  if (requestRow) requestRow.classList.add('more-request-row');

  appendIf(homePage, greetingCard);
  appendIf(homePage, buildHomeRoundInfo(timerCard, tableRotationCard));
  appendIf(homePage, buildHomePartyCard());
  appendIf(homePage, statsCard);
  appendIf(homePage, leaveCard);

  appendIf(participantsPage, participantListCard);

  appendIf(likesPage, buildLikeStatusDashboard());
  appendIf(likesPage, document.getElementById('finalCard'));
  if (legacyLikeControls) {
    legacyLikeControls.style.display = 'none';
    appendIf(likesPage, legacyLikeControls);
  }
  appendIf(likesPage, noteInboxCard);

  appendIf(tablePage, tableMapCard);

  appendIf(gamePage, document.getElementById('imageGameSection'));
  appendIf(gamePage, document.getElementById('balanceGameSection'));

  appendIf(morePage, conversationCard);
  appendIf(morePage, document.getElementById('storySection'));
  appendIf(morePage, document.getElementById('vote3rdSection'));
  if (requestRow) {
    appendIf(morePage, requestRow);
  } else {
    appendIf(morePage, songCard);
    appendIf(morePage, sosCard);
  }

  main.replaceChildren(homePage, participantsPage, likesPage, tablePage, gamePage, morePage, buildBottomNav());
  main.dataset.routed = 'true';
}

function navIcon(name) {
  const icons = {
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 10.8 12 3l9 7.8v9.7a.5.5 0 0 1-.5.5H15v-6H9v6H3.5a.5.5 0 0 1-.5-.5z"/></svg>',
    participants: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 11a4 4 0 1 0-3.2-6.4"/><path d="M8 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z"/><path d="M2.5 21c.5-4 3-6 5.5-6s5 2 5.5 6"/><path d="M13.5 15c2.4.1 4.7 2 5.2 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 5.8c-1.7-2-4.6-2.1-6.4-.3L12 7.8 9.6 5.5c-1.8-1.8-4.7-1.7-6.4.3-1.6 1.9-1.4 4.8.4 6.6L12 21l8.4-8.6c1.8-1.8 2-4.7.4-6.6Z"/></svg>',
    table: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h16v16H4z"/><path d="M4 9h16M4 15h16M9 4v16M15 4v16"/></svg>',
    game: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 8h10a5 5 0 0 1 4.8 6.4l-.8 2.6a2.2 2.2 0 0 1-3.8.8L15.5 16h-7l-1.7 1.8a2.2 2.2 0 0 1-3.8-.8l-.8-2.6A5 5 0 0 1 7 8Z"/><path d="M8 12h4M10 10v4M16.5 11.5h.01M18.5 13.5h.01"/></svg>',
    more: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h.01M12 12h.01M19 12h.01"/></svg>'
  };
  return `<span class="tab-icon">${icons[name] || icons.more}</span>`;
}

function buildBottomNav() {
  const nav = document.createElement('nav');
  nav.id = 'bottomTabBar';
  nav.className = 'bottom-tabbar';
  nav.setAttribute('aria-label', '참가자 메뉴');
  pages.forEach((page) => {
    const link = document.createElement('a');
    link.href = routeToHash(page.route);
    link.dataset.route = page.route;
    link.innerHTML = `${navIcon(page.icon)}<strong>${page.label}</strong>`;
    nav.appendChild(link);
  });
  return nav;
}

function buildAdminPage() {
  const wrap = document.querySelector('.wrap');
  const adminLogin = document.getElementById('adminLogin');
  const adminPanel = document.getElementById('adminPanel');
  if (!wrap || !adminLogin || document.getElementById(adminPage.id)) return;

  const divider = document.querySelector('hr');
  if (divider) divider.remove();

  const page = createRoutePage(adminPage);
  page.id = adminPage.id;
  page.dataset.route = adminPage.route;
  adminLogin.classList.add('admin-login-card');
  page.appendChild(adminLogin);
  page.appendChild(adminPanel);
  wrap.appendChild(page);

  const adminLink = document.createElement('a');
  adminLink.className = 'admin-entry-link';
  adminLink.href = routeToHash('/admin');
  adminLink.textContent = '관리자';
  document.body.appendChild(adminLink);
}

function setRoute(route) {
  const isParticipantReady = !document.getElementById('main')?.classList.contains('hidden');
  const requested = route === '/' || route === '/admin' ? route : (isParticipantReady ? route : '/');

  document.querySelectorAll('.route-page').forEach((page) => {
    page.classList.toggle('hidden', page.dataset.route !== requested);
  });

  document.querySelectorAll('#bottomTabBar a').forEach((link) => {
    link.classList.toggle('active', link.dataset.route === requested);
  });

  document.body.classList.toggle('admin-route', requested === '/admin');
  document.body.classList.toggle('entry-route', requested === '/');
  document.body.classList.toggle('participant-route', requested !== '/' && requested !== '/admin');
}

function handleRoute() {
  const route = resolveRoute(normalizeRoute());
  if (route === '/') setRoute('/');
  else if (route === '/admin') setRoute('/admin');
  else setRoute(pages.some((page) => page.route === route) ? route : '/home');
}

function initRouter() {
  buildEntryPage();
  buildParticipantShell();
  buildAdminPage();
  handleRoute();
  window.addEventListener('hashchange', handleRoute);
}

initRouter();

window.sumitRouter = {
  go(route) {
    const nextRoute = resolveRoute(route);
    window.location.hash = nextRoute;
    setRoute(nextRoute);
  },
  enterParticipant() {
    const current = resolveRoute(normalizeRoute());
    setRoute(current === '/' || current === '/admin' ? '/home' : current);
  },
  leaveParticipant() {
    setRoute('/');
  },
  revealAdminPanel() {
    setRoute('/admin');
  }
};