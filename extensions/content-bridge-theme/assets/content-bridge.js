(() => {
  const roots = document.querySelectorAll('[data-content-bridge]');
  if (!roots.length) return;

  const escapeHtml = (str) =>
    String(str ?? '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');

  const render = (root, items) => {
    const inner = root.querySelector('[data-content-bridge-inner]');
    if (!inner) return;

    if (!Array.isArray(items) || items.length === 0) {
      root.style.display = 'none';
      return;
    }

    inner.innerHTML = `
      <div class="content-bridge__grid">
        ${items
          .map((it) => {
            const title = escapeHtml(it.title);
            const url = escapeHtml(it.url || '#');
            const excerpt = escapeHtml(it.excerpt || '');
            const image = it.image
              ? `<img src="${escapeHtml(it.image)}" alt="${title}" loading="lazy">`
              : '';

            return `
              <a class="content-bridge__card" href="${url}">
                ${image}
                <div class="content-bridge__meta">
                  <div class="content-bridge__title">${title}</div>
                  ${excerpt ? `<div class="content-bridge__excerpt">${excerpt}</div>` : ''}
                </div>
              </a>
            `;
          })
          .join('')}
      </div>
    `;
  };

  const fetchJson = async (url) => {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    return res.json();
  };

  const buildUrl = ({ limit, tax, term }) => {
    const params = new URLSearchParams();
    params.set('limit', String(limit));
    if (tax && term) {
      params.set('tax', tax);   // "category" | "tag"
      params.set('term', term);
    }
    return `/apps/content-bridge/posts?${params.toString()}`;
  };

  roots.forEach(async (root) => {
    const term = (root.dataset.term || '').trim();
    const limit = Math.max(1, Math.min(12, Number(root.dataset.limit || 4)));
    const fallbackLatest = root.dataset.fallbackLatest === 'true';

    // ✅ tax を data-tax から読む（なければ tag に寄せる）
    const tax = (root.dataset.tax || 'tag').trim(); // "" | "category" | "tag"

    try {
      // A) termなし
      if (!term) {
        if (!fallbackLatest) {
          root.style.display = 'none';
          return;
        }
        const latest = await fetchJson(buildUrl({ limit })); // latest
        render(root, latest?.items);
        return;
      }

      // B) termあり → filtered 取得
      const filtered = await fetchJson(buildUrl({ limit, tax, term }));
      const filteredItems = filtered?.items;

      // ヒット
      if (Array.isArray(filteredItems) && filteredItems.length > 0) {
        render(root, filteredItems);
        return;
      }

      // 0件 → fallbackLatest
      if (!fallbackLatest) {
        root.style.display = 'none';
        return;
      }

      const latest = await fetchJson(buildUrl({ limit })); // latest
      render(root, latest?.items);
    } catch (e) {
      root.style.display = 'none';
    }
  });
})();
