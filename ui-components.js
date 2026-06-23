export function pageHeader({ title, description }) {
  const header = document.createElement('div');
  header.className = 'page-header';
  header.innerHTML = `<p class="eyebrow">SUMIT PARTY</p><h1>${title}</h1><p>${description}</p>`;
  return header;
}

export function actionCard({ icon, title, description, route, cta }) {
  const card = document.createElement('a');
  card.className = 'action-card';
  card.href = route;
  card.innerHTML = `<span class="action-icon">${icon}</span><span><strong>${title}</strong><small>${description}</small></span><em>${cta}</em>`;
  return card;
}

export function infoCard({ title, body, className = '' }) {
  const card = document.createElement('div');
  card.className = `card ia-card ${className}`.trim();
  card.innerHTML = `<h3>${title}</h3>${body}`;
  return card;
}