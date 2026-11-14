(() => {
  'use strict';

  const AGENTS = [
    { id: 'direct', name: 'Direktno' },
    { id: 'cnfans', name: 'CNFans' },
    { id: 'mulebuy', name: 'Mulebuy' },
    { id: 'kakobuy', name: 'KakoBuy' },
    { id: 'acbuy', name: 'ACBuy' },
    { id: 'superbuy', name: 'Superbuy' },
    { id: 'oopbuy', name: 'Oopbuy' },
    { id: 'sugargoo', name: 'Sugargoo' }
  ];

  const RATES = {
    CNY_PER_EUR: 7.8,
    CNY_PER_USD: 7.2
  };

  const PAGE_SIZE = 60;
  const IDB_NAME = 'vaultx_cache_v3';
  const IDB_VERSION = 1;
  const LS_AGENT = 'vaultx_agent';
  const LS_CURRENCY = 'vaultx_currency';
  const LS_WISHLIST = 'vaultx_wishlist_v1';

  const state = {
    mode: 'static', // 'static' | 'api'
    items: [],
    filtered: [],
    renderedCount: 0,
    apiTotal: 0,
    apiOffset: 0,
    isLoading: true,
    agent: localStorage.getItem(LS_AGENT) || 'direct',
    currency: localStorage.getItem(LS_CURRENCY) || 'EUR',
    wishlist: loadWishlist(),
    shuffleSeed: 0,
    filters: {
      q: '',
      category: '',
      platform: '',
      priceMin: '',
      priceMax: '',
      brand: '',
      withImg: false,
      sort: 'default'
    },
    categories: [],
    brands: [],
    activeDetailItem: null
  };

  const $ = (id) => document.getElementById(id);

  const els = {
    loadProgressWrap: $('loadProgressWrap'),
    loadProgressBar: $('loadProgressBar'),
    loadStatus: $('loadStatus'),
    searchInput: $('searchInput'),
    clearSearchBtn: $('clearSearchBtn'),
    agentSelect: $('agentSelect'),
    openConverterBtn: $('openConverterBtn'),
    openWishlistBtn: $('openWishlistBtn'),
    wishlistCount: $('wishlistCount'),
    mobileWishlistCount: $('mobileWishlistCount'),
    drawerWishlistCount: $('drawerWishlistCount'),
    mobileCategoryList: $('mobileCategoryList'),
    categoryList: $('categoryList'),
    platformSelect: $('platformSelect'),
    priceCurrencyLabel: $('priceCurrencyLabel'),
    priceMin: $('priceMin'),
    priceMax: $('priceMax'),
    brandSelect: $('brandSelect'),
    withImgToggle: $('withImgToggle'),
    sortSelect: $('sortSelect'),
    resetFiltersBtn: $('resetFiltersBtn'),
    heroArchiveCount: $('heroArchiveCount'),
    shuffleBtn: $('shuffleBtn'),
    quickCategoryBar: $('quickCategoryBar'),
    activeCategoryBreadcrumb: $('activeCategoryBreadcrumb'),
    resultsMeta: $('resultsMeta'),
    activeChips: $('activeChips'),
    skeletonGrid: $('skeletonGrid'),
    itemsGrid: $('itemsGrid'),
    emptyState: $('emptyState'),
    emptyTitle: $('emptyTitle'),
    emptyDesc: $('emptyDesc'),
    emptyResetBtn: $('emptyResetBtn'),
    paginationBar: $('paginationBar'),
    paginationRange: $('paginationRange'),
    loadMoreBtn: $('loadMoreBtn'),
    refreshCacheBtn: $('refreshCacheBtn'),
    filterSidebar: $('filterSidebar'),
    sheetBackdrop: $('sheetBackdrop'),
    mobileFilterBtn: $('mobileFilterBtn'),
    mobileFilterBadge: $('mobileFilterBadge'),
    closeFilterSheetBtn: $('closeFilterSheetBtn'),
    applyFiltersSheetBtn: $('applyFiltersSheetBtn'),
    mobileConverterBtn: $('mobileConverterBtn'),
    mobileWishlistBtn: $('mobileWishlistBtn'),
    detailModal: $('detailModal'),
    detailTitle: $('detailTitle'),
    detailBody: $('detailBody'),
    converterModal: $('converterModal'),
    converterInput: $('converterInput'),
    converterPasteBtn: $('converterPasteBtn'),
    converterOutput: $('converterOutput'),
    wishlistDrawer: $('wishlistDrawer'),
    wishlistBody: $('wishlistBody'),
    wishlistTotal: $('wishlistTotal'),
    copyWishlistBtn: $('copyWishlistBtn'),
    exportWishlistBtn: $('exportWishlistBtn'),
    clearWishlistBtn: $('clearWishlistBtn'),
    infoModal: $('infoModal'),
    infoTitle: $('infoTitle'),
    infoBody: $('infoBody'),
    toast: $('toast')
  };

  function escHtml(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  let toastTimer = null;
  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      els.toast.hidden = true;
    }, 2400);
  }

  function formatNumber(n) {
    return String(Math.round(Number(n || 0))).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function cleanBrand(rawBrand) {
    const b = String(rawBrand ?? '').trim();
    if (!b || /^(unspecified|unknown|none|n\/a|-)$/i.test(b)) return '';
    return b;
  }

  function normalizeItem(raw) {
    if (Array.isArray(raw)) {
      const [id, katIdx, platIdx, naslovRaw, linkRaw, imgRaw, cnyRaw, eurRaw, brandRaw, deadRaw] = raw;
      const kat = (state.meta && state.meta.categories && state.meta.categories[katIdx]?.name) || 'Ostalo';
      const plat = (state.meta && state.meta.platforms && state.meta.platforms[platIdx]?.name) || '';
      const naslov = String(naslovRaw ?? '');
      const brand = cleanBrand(brandRaw);
      const link = String(linkRaw ?? '');
      const img = String(imgRaw ?? '');
      const cny = Number(cnyRaw ?? 0) || 0;
      const eur = Number(eurRaw ?? 0) || 0;
      const searchBlob = (naslov + ' ' + brand + ' ' + kat + ' ' + plat).toLowerCase();
      return { _i: normalizeItem._n = (normalizeItem._n || 0) + 1, id, kat, plat, naslov, link, img, cny, eur, brand, dead: deadRaw ? 1 : 0, _q: searchBlob };
    }

    const cny = Number(raw.cny ?? raw.price_cny ?? 0) || 0;
    const eur = Number(raw.eur ?? raw.price_eur ?? 0) || 0;
    const naslov = String(raw.naslov ?? raw.title ?? '');
    const brand = cleanBrand(raw.brand);
    const kat = String(raw.kat ?? raw.kategorija ?? raw.category ?? 'Ostalo');
    const plat = String(raw.plat ?? raw.platforma ?? raw.platform ?? '');
    const link = String(raw.link ?? raw.direct_link ?? '');
    const img = String(raw.img ?? raw.image_url ?? '');
    const searchBlob = (naslov + ' ' + brand + ' ' + kat + ' ' + plat).toLowerCase();

    return {
      id: raw.id,
      kat,
      plat,
      naslov,
      link,
      img,
      cny,
      eur,
      brand,
      _q: searchBlob
    };
  }

  // --- Currency ---
  function getItemPrice(item, currency) {
    let cny = item.cny || 0;
    let eur = item.eur || 0;
    if (cny <= 0 && eur > 0) cny = eur * RATES.CNY_PER_EUR;
    if (eur <= 0 && cny > 0) eur = cny / RATES.CNY_PER_EUR;

    if (currency === 'CNY') return cny;
    if (currency === 'USD') return cny / RATES.CNY_PER_USD;
    return eur;
  }

  function formatPrice(amount, currency) {
    if (!amount || amount <= 0) return '-';
    if (currency === 'CNY') return formatNumber(amount) + ' CNY';
    if (currency === 'USD') return '$' + amount.toFixed(2).replace('.', ',');
    return amount.toFixed(2).replace('.', ',') + ' €';
  }

  // --- Agent Link Conversion & Reverse Parsing ---
  function extractPlatformAndId(rawUrl, fallbackPlat) {
    if (!rawUrl || typeof rawUrl !== 'string') return null;
    let urlStr = rawUrl.trim();
    if (!/^https?:\/\//i.test(urlStr)) {
      if (/^(weidian|taobao|detail\.1688|item\.taobao)/i.test(urlStr)) {
        urlStr = 'https://' + urlStr;
      } else {
        return null;
      }
    }

    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      return null;
    }

    const host = parsed.hostname.toLowerCase();
    const params = parsed.searchParams;

    const nested = params.get('url') || params.get('productLink') || params.get('link') || params.get('itemUrl');
    if (nested && nested !== rawUrl) {
      const inner = extractPlatformAndId(decodeURIComponent(nested), fallbackPlat);
      if (inner) return inner;
    }

    if (host.includes('weidian.com')) {
      const id = params.get('itemID') || params.get('itemId') || params.get('id');
      if (id && /^\d+$/.test(id)) {
        return { plat: 'weidian', id, directUrl: 'https://weidian.com/item.html?itemID=' + id };
      }
    }

    if (host.includes('taobao.com') || host.includes('tmall.com')) {
      const id = params.get('id') || params.get('itemId');
      if (id && /^\d+$/.test(id)) {
        return { plat: 'taobao', id, directUrl: 'https://item.taobao.com/item.htm?id=' + id };
      }
    }

    if (host.includes('1688.com')) {
      const m = parsed.pathname.match(/\/offer\/(\d+)\.html/i);
      const id = (m && m[1]) || params.get('offerId') || params.get('id');
      if (id && /^\d+$/.test(id)) {
        return { plat: '1688', id, directUrl: 'https://detail.1688.com/offer/' + id + '.html' };
      }
    }

    if (host.includes('cnfans.com') || host.includes('mulebuy.com') || host.includes('orientdig.com') || host.includes('joyabuy.com')) {
      const id = params.get('id');
      const st = (params.get('shop_type') || '').toLowerCase();
      if (id && /^\d+$/.test(id)) {
        const plat = st.includes('1688') ? '1688' : st.includes('taobao') ? 'taobao' : 'weidian';
        return buildDirectFromPlat(plat, id);
      }
    }

    if (host.includes('acbuy.com')) {
      const id = params.get('id');
      const src = (params.get('source') || '').toUpperCase();
      if (id && /^\d+$/.test(id)) {
        const plat = src === 'TB' ? 'taobao' : src === 'AL' ? '1688' : 'weidian';
        return buildDirectFromPlat(plat, id);
      }
    }

    if (host.includes('oopbuy.com')) {
      const m = parsed.pathname.match(/\/product\/(weidian|taobao|1688|0|1|2)\/(\d+)/i);
      if (m) {
        const rawP = m[1].toLowerCase();
        const plat = (rawP === 'taobao' || rawP === '1') ? 'taobao' : (rawP === '1688' || rawP === '2') ? '1688' : 'weidian';
        return buildDirectFromPlat(plat, m[2]);
      }
    }

    if (fallbackPlat && (fallbackPlat === 'weidian' || fallbackPlat === 'taobao' || fallbackPlat === '1688')) {
      const m = urlStr.match(/(\d{6,})/);
      if (m) return buildDirectFromPlat(fallbackPlat, m[1]);
    }

    return null;
  }

  function buildDirectFromPlat(plat, id) {
    if (plat === 'taobao') {
      return { plat: 'taobao', id, directUrl: 'https://item.taobao.com/item.htm?id=' + id };
    }
    if (plat === '1688') {
      return { plat: '1688', id, directUrl: 'https://detail.1688.com/offer/' + id + '.html' };
    }
    return { plat: 'weidian', id, directUrl: 'https://weidian.com/item.html?itemID=' + id };
  }

  function convertToAgent(rawUrl, agentId, fallbackPlat) {
    if (!rawUrl) return '#';
    if (agentId === 'direct') return rawUrl;

    const info = extractPlatformAndId(rawUrl, fallbackPlat);
    if (!info) return rawUrl;

    const { plat, id, directUrl } = info;
    const encoded = encodeURIComponent(directUrl);
    const cnfansPlat = plat === '1688' ? 'ali_1688' : plat;
    const acSource = plat === 'taobao' ? 'TB' : plat === '1688' ? 'AL' : 'WD';

    switch (agentId) {
      case 'cnfans':
        return 'https://cnfans.com/product/?shop_type=' + cnfansPlat + '&id=' + id;
      case 'mulebuy':
        return 'https://mulebuy.com/product/?shop_type=' + cnfansPlat + '&id=' + id;
      case 'kakobuy':
        return 'https://www.kakobuy.com/item/details?url=' + encoded;
      case 'acbuy':
        return 'https://www.acbuy.com/product?id=' + id + '&source=' + acSource;
      case 'superbuy':
        return 'https://www.superbuy.com/en/page/buy/?nTag=Home-search&from=search-input&url=' + encoded;
      case 'oopbuy':
        return 'https://www.oopbuy.com/product/' + plat + '/' + id;
      case 'sugargoo':
        return 'https://www.sugargoo.com/#/home/productDetail?productLink=' + encoded;
      default:
        return directUrl;
    }
  }

  function shortPlatLabel(plat) {
    if (!plat) return 'LINK';
    const p = plat.toLowerCase();
    if (p === 'weidian') return 'WD';
    if (p === 'taobao') return 'TB';
    if (p === '1688') return '1688';
    if (p.includes('yupoo')) return 'YUPOO';
    if (p.includes('kakobuy')) return 'KAKO';
    if (p.includes('dhgate')) return 'DHG';
    if (p.includes('store')) return 'SHOP';
    return p.slice(0, 6).toUpperCase();
  }

  // --- IndexedDB Cache ---
  function openIdb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new Error('IndexedDB unavailable'));
        return;
      }
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = (e) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains('meta')) db.createObjectStore('meta');
        if (!db.objectStoreNames.contains('chunks')) db.createObjectStore('chunks');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbGet(db, store, key) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readonly');
      const req = tx.objectStore(store).get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  function idbPut(db, store, key, val) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(store, 'readwrite');
      const req = tx.objectStore(store).put(val, key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  }

  function idbGetAllChunks(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction('chunks', 'readonly');
      const req = tx.objectStore('chunks').getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  }

  function idbClear(db) {
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['meta', 'chunks'], 'readwrite');
      tx.objectStore('meta').clear();
      tx.objectStore('chunks').clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  function resolveChunkList(meta) {
    if (Array.isArray(meta.chunk_files)) return meta.chunk_files;
    if (Array.isArray(meta.chunks)) return meta.chunks;
    if (Array.isArray(meta.files)) return meta.files;
    const count = Number(meta.chunk_count ?? meta.chunks ?? 0);
    const list = [];
    for (let i = 0; i < count; i++) {
      const num = (i < 10 ? '0' : '') + i;
      list.push('chunk_' + num + '.json');
    }
    return list;
  }

  function extractChunkItems(data) {
    if (Array.isArray(data)) return data;
    if (data && Array.isArray(data.items)) return data.items;
    return [];
  }

  function updateArchiveCountLabels() {
    const countStr = formatNumber(state.items.length) + ' kosov';
    els.loadStatus.textContent = countStr;
    if (els.heroArchiveCount) els.heroArchiveCount.textContent = countStr;
  }

  async function initData(forceRefresh) {
    state.isLoading = true;
    els.loadProgressWrap.classList.add('active');
    els.loadProgressBar.style.width = '5%';
    els.loadStatus.textContent = 'Preverjam arhiv...';
    els.loadStatus.classList.remove('ready');

    let db = null;
    try {
      db = await openIdb();
      if (forceRefresh) await idbClear(db);
    } catch {
      db = null;
    }

    try {
      const metaRes = await fetch('./data/meta.json?t=' + Date.now(), { cache: 'no-cache' });
      if (!metaRes.ok) throw new Error('meta.json missing');
      const meta = await metaRes.json();
      state.meta = meta;

      if (meta.rates) {
        if (meta.rates.eur) RATES.CNY_PER_EUR = Number(meta.rates.eur);
        if (meta.rates.usd) RATES.CNY_PER_USD = Number(meta.rates.usd);
      }

      const chunkFiles = resolveChunkList(meta);
      if (!chunkFiles.length) throw new Error('No chunks in meta.json');

      const remoteVer = String(meta.timestamp || meta.version || meta.generated_at || meta.total || chunkFiles.length);
      let cachedVer = null;
      if (db && !forceRefresh) {
        cachedVer = await idbGet(db, 'meta', 'version');
      }

      if (db && cachedVer === remoteVer && !forceRefresh) {
        els.loadStatus.textContent = 'Nalagam iz predpomnilnika...';
        const cachedChunks = await idbGetAllChunks(db);
        if (cachedChunks.length >= chunkFiles.length) {
          const all = [];
          for (const chunkArr of cachedChunks) {
            for (let i = 0; i < chunkArr.length; i++) {
              all.push(normalizeItem(chunkArr[i]));
            }
          }
          state.items = all;
          state.mode = 'static';
          state.isLoading = false;
          els.loadProgressBar.style.width = '100%';
          setTimeout(() => els.loadProgressWrap.classList.remove('active'), 300);
          updateArchiveCountLabels();
          els.loadStatus.classList.add('ready');
          rebuildFacets();
          applyFilters();
          return;
        }
      }

      if (db) await idbClear(db);
      state.items = [];
      state.mode = 'static';

      const firstRes = await fetch('./data/' + chunkFiles[0]);
      if (!firstRes.ok) throw new Error('Failed first chunk');
      const firstRaw = extractChunkItems(await firstRes.json());
      if (db) await idbPut(db, 'chunks', chunkFiles[0], firstRaw);
      for (let i = 0; i < firstRaw.length; i++) {
        state.items.push(normalizeItem(firstRaw[i]));
      }

      state.isLoading = false;
      els.loadProgressBar.style.width = Math.round((1 / chunkFiles.length) * 100) + '%';
      els.loadStatus.textContent = formatNumber(state.items.length) + ' (nalagam...)';
      if (els.heroArchiveCount) els.heroArchiveCount.textContent = formatNumber(state.items.length) + ' kosov';
      rebuildFacets();
      applyFilters();

      const remaining = chunkFiles.slice(1);
      let doneCount = 1;
      for (let i = 0; i < remaining.length; i += 4) {
        const batch = remaining.slice(i, i + 4);
        await Promise.all(batch.map(async (fname) => {
          const r = await fetch('./data/' + fname);
          if (!r.ok) return;
          const rawArr = extractChunkItems(await r.json());
          if (db) await idbPut(db, 'chunks', fname, rawArr);
          for (let j = 0; j < rawArr.length; j++) {
            state.items.push(normalizeItem(rawArr[j]));
          }
          doneCount++;
        }));
        const pct = Math.round((doneCount / chunkFiles.length) * 100);
        els.loadProgressBar.style.width = pct + '%';
        els.loadStatus.textContent = formatNumber(state.items.length) + ' (' + pct + '%)';
        if (els.heroArchiveCount) els.heroArchiveCount.textContent = formatNumber(state.items.length) + ' kosov';
        rebuildFacets();
        applyFilters(true);
      }

      if (db) await idbPut(db, 'meta', 'version', remoteVer);
      els.loadProgressBar.style.width = '100%';
      setTimeout(() => els.loadProgressWrap.classList.remove('active'), 350);
      updateArchiveCountLabels();
      els.loadStatus.classList.add('ready');
    } catch {
      await switchToApiFallback(db);
    }
  }

  async function switchToApiFallback(db) {
    if (db) {
      try {
        const cachedChunks = await idbGetAllChunks(db);
        if (cachedChunks.length > 0) {
          const all = [];
          for (const chunkArr of cachedChunks) {
            for (let i = 0; i < chunkArr.length; i++) {
              all.push(normalizeItem(chunkArr[i]));
            }
          }
          if (all.length > 0) {
            state.items = all;
            state.mode = 'static';
            state.isLoading = false;
            els.loadProgressWrap.classList.remove('active');
            els.loadStatus.textContent = formatNumber(all.length) + ' (predpomnilnik)';
            if (els.heroArchiveCount) els.heroArchiveCount.textContent = formatNumber(all.length) + ' kosov';
            els.loadStatus.classList.add('ready');
            rebuildFacets();
            applyFilters();
            return;
          }
        }
      } catch {
        // continue to API
      }
    }

    state.mode = 'api';
    els.loadStatus.textContent = 'API način';
    els.loadProgressWrap.classList.remove('active');
    await fetchApiSearch(false);
  }

  async function fetchApiSearch(append) {
    if (!append) {
      state.apiOffset = 0;
      state.items = [];
      els.skeletonGrid.hidden = false;
      els.itemsGrid.hidden = true;
    }

    const params = new URLSearchParams();
    if (state.filters.q) params.set('q', state.filters.q);
    if (state.filters.category) params.set('category', state.filters.category);
    if (state.filters.brand) params.set('brand', state.filters.brand);
    if (state.filters.withImg) params.set('with_img', '1');
    params.set('limit', String(PAGE_SIZE));
    params.set('offset', String(state.apiOffset));

    try {
      const res = await fetch('/api/search?' + params.toString());
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      const batch = (data.items || []).map(normalizeItem);
      state.apiTotal = Number(data.total || batch.length);
      if (append) {
        state.items = state.items.concat(batch);
      } else {
        state.items = batch;
      }
      state.filtered = state.items;
      state.renderedCount = state.items.length;
      state.isLoading = false;
      els.loadStatus.textContent = formatNumber(state.apiTotal) + ' kosov';
      if (els.heroArchiveCount) els.heroArchiveCount.textContent = formatNumber(state.apiTotal) + ' kosov';
      els.loadStatus.classList.add('ready');
      renderGrid();
    } catch {
      state.isLoading = false;
      els.skeletonGrid.hidden = true;
      els.itemsGrid.hidden = true;
      els.emptyState.hidden = false;
      els.emptyTitle.textContent = 'Podatki niso dosegljivi';
      els.emptyDesc.textContent = 'Ne najdem ./data/meta.json niti /api/search strežnika.';
      els.resultsMeta.textContent = '0 zadetkov';
      els.loadStatus.textContent = 'Brez povezave';
    }
  }

  // --- Facets (Categories & Brands) ---
  function rebuildFacets() {
    const catMap = new Map();
    const brandMap = new Map();

    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
      catMap.set(it.kat, (catMap.get(it.kat) || 0) + 1);
      if (it.brand) {
        brandMap.set(it.brand, (brandMap.get(it.brand) || 0) + 1);
      }
    }

    state.categories = Array.from(catMap.entries()).sort((a, b) => b[1] - a[1]);
    state.brands = Array.from(brandMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 120);

    renderCategories();
    renderBrandSelect();
  }

  function renderCategories() {
    const total = state.items.length;
    const active = state.filters.category;

    const deskHtml = [
      '<li><button type="button" class="cat-btn' + (active === '' ? ' active' : '') + '" data-cat="">' +
        '<span class="cat-name">Vsi izdelki</span>' +
        '<span class="cat-count num">' + formatNumber(total) + '</span>' +
      '</button></li>'
    ];

    const mobHtml = [
      '<button type="button" class="mobile-cat-pill' + (active === '' ? ' active' : '') + '" data-cat="">' +
        '<span>Vsi</span><span class="num">' + formatNumber(total) + '</span>' +
      '</button>'
    ];

    for (let i = 0; i < state.categories.length; i++) {
      const [name, cnt] = state.categories[i];
      const isAct = active === name ? ' active' : '';
      deskHtml.push(
        '<li><button type="button" class="cat-btn' + isAct + '" data-cat="' + escHtml(name) + '">' +
          '<span class="cat-name">' + escHtml(name) + '</span>' +
          '<span class="cat-count num">' + formatNumber(cnt) + '</span>' +
        '</button></li>'
      );
      mobHtml.push(
        '<button type="button" class="mobile-cat-pill' + isAct + '" data-cat="' + escHtml(name) + '">' +
          '<span>' + escHtml(name) + '</span><span class="num">' + formatNumber(cnt) + '</span>' +
        '</button>'
      );
    }

    els.categoryList.innerHTML = deskHtml.join('');
    els.mobileCategoryList.innerHTML = mobHtml.join('');

    if (els.quickCategoryBar) {
      els.quickCategoryBar.querySelectorAll('[data-quick-cat]').forEach((btn) => {
        btn.classList.toggle('active', btn.dataset.quickCat === active);
      });
    }
  }

  function renderBrandSelect() {
    const current = state.filters.brand;
    const opts = ['<option value="">Vse znamke</option>'];
    for (let i = 0; i < state.brands.length; i++) {
      const [b, cnt] = state.brands[i];
      const sel = b === current ? ' selected' : '';
      opts.push('<option value="' + escHtml(b) + '"' + sel + '>' + escHtml(b) + ' (' + formatNumber(cnt) + ')</option>');
    }
    els.brandSelect.innerHTML = opts.join('');
  }

  // Deterministic pseudo-random hash for shuffle sorting
  function shuffleScore(id, seed) {
    let x = ((Number(id) || 1) ^ seed) * 0x45d9f3b;
    x = ((x >> 16) ^ x) * 0x45d9f3b;
    x = (x >> 16) ^ x;
    return x >>> 0;
  }

  // --- Filtering & Sorting ---
  function applyFilters(preserveCount) {
    if (state.mode === 'api') {
      fetchApiSearch(false);
      return;
    }

    const f = state.filters;
    const qTerms = f.q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const minP = f.priceMin !== '' ? Number(f.priceMin) : null;
    const maxP = f.priceMax !== '' ? Number(f.priceMax) : null;

    const out = [];
    for (let i = 0; i < state.items.length; i++) {
      const it = state.items[i];
      if (f.category && it.kat !== f.category) continue;
      if (f.brand && it.brand !== f.brand) continue;
      if (f.withImg && !it.img) continue;

      if (f.platform) {
        const p = it.plat.toLowerCase();
        if (f.platform === 'yupoo' && !p.includes('yupoo')) continue;
        else if (f.platform === 'dhgate' && !p.includes('dhgate')) continue;
        else if (f.platform === 'store' && !p.includes('store')) continue;
        else if (f.platform !== 'yupoo' && f.platform !== 'dhgate' && f.platform !== 'store' && p !== f.platform) continue;
      }

      if (minP !== null || maxP !== null) {
        const price = getItemPrice(it, state.currency);
        if (price <= 0) continue;
        if (minP !== null && price < minP) continue;
        if (maxP !== null && price > maxP) continue;
      }

      if (qTerms.length > 0) {
        let match = true;
        for (let t = 0; t < qTerms.length; t++) {
          if (!it._q.includes(qTerms[t])) {
            match = false;
            break;
          }
        }
        if (!match) continue;
      }

      out.push(it);
    }

    if (f.sort === 'price_asc') {
      out.sort((a, b) => {
        const pa = getItemPrice(a, state.currency) || 999999;
        const pb = getItemPrice(b, state.currency) || 999999;
        return pa - pb;
      });
    } else if (f.sort === 'price_desc') {
      out.sort((a, b) => getItemPrice(b, state.currency) - getItemPrice(a, state.currency));
    } else if (f.sort === 'newest') {
      out.sort((a, b) => b.id - a.id);
    } else if (f.sort === 'shuffle') {
      const seed = state.shuffleSeed || 1;
      out.sort((a, b) => (b.img ? 1 : 0) - (a.img ? 1 : 0) || shuffleScore(a.id, seed) - shuffleScore(b.id, seed));
    } else {
      out.sort((a, b) => (a._i || 0) - (b._i || 0));
    }

    state.filtered = out;
    if (!preserveCount) {
      state.renderedCount = Math.min(PAGE_SIZE, out.length);
    } else {
      state.renderedCount = Math.min(Math.max(state.renderedCount, PAGE_SIZE), out.length);
    }

    renderActiveChips();
    updateFilterBadge();
    renderGrid();
  }

  function updateFilterBadge() {
    const f = state.filters;
    let count = 0;
    if (f.category) count++;
    if (f.platform) count++;
    if (f.priceMin !== '' || f.priceMax !== '') count++;
    if (f.brand) count++;
    if (f.withImg) count++;
    if (f.sort !== 'default') count++;

    if (count > 0) {
      els.mobileFilterBadge.textContent = String(count);
      els.mobileFilterBadge.hidden = false;
    } else {
      els.mobileFilterBadge.hidden = true;
    }
  }

  function renderActiveChips() {
    const f = state.filters;
    const chips = [];
    if (f.category) chips.push({ key: 'category', label: 'Kategorija: ' + f.category });
    if (f.platform) chips.push({ key: 'platform', label: 'Platforma: ' + f.platform });
    if (f.brand) chips.push({ key: 'brand', label: 'Znamka: ' + f.brand });
    if (f.priceMin !== '' || f.priceMax !== '') {
      chips.push({ key: 'price', label: 'Cena: ' + (f.priceMin || '0') + ' - ' + (f.priceMax || 'max') + ' ' + state.currency });
    }
    if (f.withImg) chips.push({ key: 'withImg', label: 'Samo s slikami' });

    if (chips.length === 0) {
      els.activeChips.hidden = true;
      els.activeChips.innerHTML = '';
      return;
    }

    els.activeChips.hidden = false;
    els.activeChips.innerHTML = chips.map((c) =>
      '<button type="button" class="filter-chip" data-clear-chip="' + c.key + '">' +
        '<span>' + escHtml(c.label) + '</span>' +
        '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
      '</button>'
    ).join('');
  }

  function renderGrid() {
    els.skeletonGrid.hidden = true;
    els.activeCategoryBreadcrumb.textContent = state.filters.category || 'Vsi izdelki';

    const total = state.mode === 'api' ? state.apiTotal : state.filtered.length;
    els.resultsMeta.textContent = formatNumber(total) + ' zadetkov';

    if (total === 0) {
      els.itemsGrid.hidden = true;
      els.emptyState.hidden = false;
      els.paginationBar.hidden = true;
      els.emptyTitle.textContent = 'Ni najdenih izdelkov';
      els.emptyDesc.textContent = 'Poskusite z drugačnim iskalnim nizom ali ponastavite filtre.';
      return;
    }

    els.emptyState.hidden = true;
    els.itemsGrid.hidden = false;

    const slice = state.filtered.slice(0, state.renderedCount);
    els.itemsGrid.innerHTML = slice.map(renderCardHtml).join('');

    if (state.renderedCount < total) {
      els.paginationBar.hidden = false;
      els.paginationRange.textContent = 'Prikazano 1 - ' + formatNumber(state.renderedCount) + ' od ' + formatNumber(total);
    } else {
      els.paginationBar.hidden = true;
    }
  }

  function renderCardHtml(it) {
    const isWished = state.wishlist.some((w) => w.id === it.id);
    const priceVal = getItemPrice(it, state.currency);
    const priceStr = formatPrice(priceVal, state.currency);
    const cnyVal = getItemPrice(it, 'CNY');
    const subCny = (state.currency !== 'CNY' && cnyVal > 0) ? Math.round(cnyVal) + ' CNY' : '';
    const agentUrl = convertToAgent(it.link, state.agent, it.plat);

    const mediaHtml = it.img
      ? '<img src="' + escHtml(it.img) + '" alt="' + escHtml(it.naslov) + '" loading="lazy" referrerpolicy="no-referrer">'
      : '<div class="card-no-img"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Brez slike</span></div>';

    return (
      '<article class="item-card' + (it.dead ? ' is-dead' : '') + '" data-id="' + escHtml(it.id) + '">' +
        '<div class="card-media" data-open-detail="' + escHtml(it.id) + '">' +
          mediaHtml +
          (it.dead ? '<span class="dead-badge">Mrtev link</span>' : '') +
          '<button type="button" class="wish-btn' + (isWished ? ' active' : '') + '" data-wish-id="' + escHtml(it.id) + '" aria-label="Dodaj na seznam želja">' +
            '<svg width="16" height="16" viewBox="0 0 24 24" fill="' + (isWished ? 'currentColor' : 'none') + '" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
              '<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>' +
            '</svg>' +
          '</button>' +
        '</div>' +
        '<div class="card-body">' +
          (it.brand ? '<div class="card-brand">' + escHtml(it.brand) + '</div>' : '') +
          '<h3 class="card-title" data-open-detail="' + escHtml(it.id) + '">' + escHtml(it.naslov) + '</h3>' +
          '<div class="card-price-row">' +
            '<span class="card-price num">' + escHtml(priceStr) + '</span>' +
            (subCny ? '<span class="card-price-sub num">' + escHtml(subCny) + '</span>' : '') +
          '</div>' +
          '<div class="card-actions">' +
            '<a href="' + escHtml(agentUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Odpri</a>' +
            '<button type="button" class="btn btn-secondary btn-copy-icon" data-copy-id="' + escHtml(it.id) + '" aria-label="Kopiraj povezavo" title="Kopiraj povezavo">' +
              '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>' +
            '</button>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  // --- Wishlist ---
  function loadWishlist() {
    try {
      const raw = JSON.parse(localStorage.getItem(LS_WISHLIST) || '[]');
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function saveWishlist() {
    localStorage.setItem(LS_WISHLIST, JSON.stringify(state.wishlist));
    updateWishlistBadges();
  }

  function updateWishlistBadges() {
    const cnt = String(state.wishlist.length);
    els.wishlistCount.textContent = cnt;
    els.mobileWishlistCount.textContent = cnt;
    els.drawerWishlistCount.textContent = cnt;
  }

  function toggleWishlist(itemId) {
    const idx = state.wishlist.findIndex((w) => w.id === itemId);
    if (idx >= 0) {
      state.wishlist.splice(idx, 1);
      showToast('Odstranjeno s seznama želja');
    } else {
      const item = findItemById(itemId);
      if (!item) return;
      state.wishlist.push({
        kat: item.kat,
        id: item.id,
        naslov: item.naslov,
        link: item.link,
        img: item.img,
        plat: item.plat,
        cny: item.cny,
        eur: item.eur,
        brand: item.brand
      });
      showToast('Dodano na seznam želja');
    }
    saveWishlist();
    renderGrid();
    if (!els.wishlistDrawer.hidden) renderWishlistDrawer();
    if (state.activeDetailItem && state.activeDetailItem.id === itemId && !els.detailModal.hidden) {
      openDetailModal(itemId);
    }
  }

  function renderWishlistDrawer() {
    if (state.wishlist.length === 0) {
      els.wishlistBody.innerHTML = '<div class="empty-state"><p>Seznam želja je prazen. Kliknite srček na izdelku za shranjevanje.</p></div>';
      els.wishlistTotal.textContent = formatPrice(0, state.currency);
      return;
    }

    let total = 0;
    const rows = state.wishlist.map((w) => {
      const p = getItemPrice(w, state.currency);
      total += p;
      const agentUrl = convertToAgent(w.link, state.agent, w.plat);
      const thumb = w.img
        ? '<img src="' + escHtml(w.img) + '" alt="' + escHtml(w.naslov) + '" referrerpolicy="no-referrer">'
        : '';

      return (
        '<div class="wishlist-item">' +
          '<div class="wishlist-thumb">' + thumb + '</div>' +
          '<div class="wishlist-item-info">' +
            '<a href="' + escHtml(agentUrl) + '" target="_blank" rel="noopener noreferrer" class="wishlist-item-title">' + escHtml(w.naslov) + '</a>' +
            '<span class="wishlist-item-price num">' + escHtml(formatPrice(p, state.currency)) + '</span>' +
          '</div>' +
          '<button type="button" class="btn-icon" data-remove-wish="' + escHtml(w.id) + '" aria-label="Odstrani">' +
            '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>' +
          '</button>' +
        '</div>'
      );
    });

    els.wishlistBody.innerHTML = '<div class="wishlist-list">' + rows.join('') + '</div>';
    els.wishlistTotal.textContent = formatPrice(total, state.currency);
    renderShipEstimate();
  }

  function findItemById(id) {
    const numId = Number(id);
    return state.items.find((it) => it.id === numId || String(it.id) === String(id)) ||
      state.wishlist.find((w) => w.id === numId || String(w.id) === String(id));
  }

  // --- Detail Modal & QC ---
  function openDetailModal(id) {
    const item = findItemById(id);
    if (!item) return;
    state.activeDetailItem = item;

    const isWished = state.wishlist.some((w) => w.id === item.id);
    const priceMain = formatPrice(getItemPrice(item, state.currency), state.currency);
    const priceCny = item.cny > 0 ? Math.round(item.cny) + ' CNY' : '';
    const agentUrl = convertToAgent(item.link, state.agent, item.plat);

    const mediaHtml = item.img
      ? '<img src="' + escHtml(item.img) + '" alt="' + escHtml(item.naslov) + '" referrerpolicy="no-referrer">'
      : '<div class="card-no-img"><span>Brez slike</span></div>';

    const agentOpts = AGENTS.map((a) =>
      '<option value="' + a.id + '"' + (a.id === state.agent ? ' selected' : '') + '>' + a.name + '</option>'
    ).join('');

    els.detailTitle.textContent = item.brand ? item.brand + ' | Podrobnosti' : 'Podrobnosti izdelka';
    els.detailBody.innerHTML =
      '<div class="detail-grid">' +
        '<div class="detail-media">' + mediaHtml + '</div>' +
        '<div class="detail-info">' +
          '<h3 class="detail-name">' + escHtml(item.naslov) + '</h3>' +
          '<div class="detail-meta-tags">' +
            '<span class="meta-tag">' + escHtml(item.kat || 'Ostalo') + '</span>' +
            '<span class="meta-tag">' + escHtml(shortPlatLabel(item.plat)) + '</span>' +
            (item.brand ? '<span class="meta-tag">' + escHtml(item.brand) + '</span>' : '') +
            (item.dead ? '<span class="meta-tag" style="color:var(--danger);">Mrtev link</span>' : '') +
            '<span class="meta-tag num">ID ' + escHtml(item.id) + '</span>' +
          '</div>' +
          '<div class="detail-price-box">' +
            '<span class="detail-price-main num">' + escHtml(priceMain) + '</span>' +
            (priceCny && state.currency !== 'CNY' ? '<span class="detail-price-sub num">(' + escHtml(priceCny) + ')</span>' : '') +
          '</div>' +
          '<div class="detail-agent-row">' +
            '<select id="detailAgentSelect" class="select-control" aria-label="Izberi agenta za ta izdelek">' + agentOpts + '</select>' +
            '<button type="button" id="detailCopyBtn" class="btn btn-secondary">Kopiraj link</button>' +
          '</div>' +
          '<div id="detailUrlPreview" class="detail-url-preview">' + escHtml(agentUrl) + '</div>' +
          '<div class="detail-actions">' +
            '<a id="detailOpenLink" href="' + escHtml(agentUrl) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Odpri pri agentu</a>' +
            '<button type="button" id="detailWishBtn" class="btn btn-secondary">' + (isWished ? 'Na seznamu želja' : 'Dodaj na želje') + '</button>' +
            '<button type="button" id="detailQcBtn" class="btn btn-secondary">QC slike</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div id="detailQcSection" class="qc-section" hidden></div>';

    $('detailAgentSelect').addEventListener('change', (e) => {
      const nextUrl = convertToAgent(item.link, e.target.value, item.plat);
      $('detailUrlPreview').textContent = nextUrl;
      $('detailOpenLink').href = nextUrl;
    });

    $('detailCopyBtn').addEventListener('click', () => {
      copyText($('detailUrlPreview').textContent, 'Povezava kopirana');
    });

    $('detailWishBtn').addEventListener('click', () => toggleWishlist(item.id));
    $('detailQcBtn').addEventListener('click', () => loadQcPhotos(item));

    els.detailModal.hidden = false;
  }

  function loadQcPhotos(item) {
    const qcBox = $('detailQcSection');
    qcBox.hidden = false;
    const info = extractPlatformAndId(item.link, item.plat);
    const plat = info ? (info.plat === 'weidian' ? 'WD' : info.plat === 'taobao' ? 'TB' : 'AL') : '';
    const qcLinks = info ? [
      ['FindQC', 'https://findqc.com/detail/' + info.plat.toUpperCase().replace('1688', 'ALI_1688') + '/' + info.id],
      ['Picks.ly', 'https://picks.ly/product/' + plat + '/' + info.id]
    ] : [];
    qcBox.innerHTML =
      '<div class="filter-heading">QC fotografije</div>' +
      '<p class="results-meta" style="margin-top:6px;">' +
      (qcLinks.length
        ? qcLinks.map((q) => '<a href="' + escHtml(q[1]) + '" target="_blank" rel="noopener noreferrer" style="color:var(--accent);margin-right:14px;">' + q[0] + '</a>').join('') +
          '<br>QC slike se odprejo na zunanji strani (statična stran jih ne more prikazati sama).'
        : 'Preverite fotografije neposredno pri izbranem agentu.') +
      '</p>';
  }

  // --- Link Converter Modal ---
  function renderConverterOutput(rawUrl) {
    const val = (rawUrl || '').trim();
    if (!val) {
      els.converterOutput.innerHTML = '<p class="results-meta">Prilepite povezavo zgoraj za takojšnjo pretvorbo za vse agente.</p>';
      return;
    }

    const parsed = extractPlatformAndId(val);
    if (!parsed) {
      els.converterOutput.innerHTML = '<p class="results-meta">Ne prepoznam Weidian, Taobao ali 1688 ID-ja v tej povezavi.</p>';
      return;
    }

    const rows = AGENTS.map((ag) => {
      const converted = convertToAgent(parsed.directUrl, ag.id, parsed.plat);
      return (
        '<div class="converter-row">' +
          '<span class="converter-agent-name">' + ag.name + '</span>' +
          '<span class="converter-url">' + escHtml(converted) + '</span>' +
          '<button type="button" class="btn btn-secondary" data-copy-raw="' + escHtml(converted) + '">Kopiraj</button>' +
          '<a href="' + escHtml(converted) + '" target="_blank" rel="noopener noreferrer" class="btn btn-primary">Odpri</a>' +
        '</div>'
      );
    });

    els.converterOutput.innerHTML =
      '<p class="results-meta" style="margin-bottom:8px;">Prepoznano: <strong>' + parsed.plat.toUpperCase() + '</strong> | ID <span class="num">' + escHtml(parsed.id) + '</span></p>' +
      rows.join('');
  }

  function copyText(text, toastMsg) {
    if (!navigator.clipboard) {
      showToast('Kopiranje ni podprto');
      return;
    }
    navigator.clipboard.writeText(text).then(() => showToast(toastMsg || 'Kopirano'));
  }

  // --- Mobile Filter Sheet ---
  function openFilterSheet() {
    els.filterSidebar.classList.add('open');
    els.sheetBackdrop.hidden = false;
  }

  function closeFilterSheet() {
    els.filterSidebar.classList.remove('open');
    els.sheetBackdrop.hidden = true;
  }

  function resetAllFilters() {
    state.filters = {
      q: '',
      category: '',
      platform: '',
      priceMin: '',
      priceMax: '',
      brand: '',
      withImg: false,
      sort: 'default'
    };
    els.searchInput.value = '';
    els.clearSearchBtn.hidden = true;
    els.platformSelect.value = '';
    els.priceMin.value = '';
    els.priceMax.value = '';
    els.brandSelect.value = '';
    els.withImgToggle.checked = false;
    els.sortSelect.value = 'default';
    renderCategories();
    applyFilters();
  }

  function triggerShuffle() {
    state.shuffleSeed = (Date.now() & 0x7fffffff) || 1;
    state.filters.sort = 'shuffle';
    els.sortSelect.value = 'shuffle';
    applyFilters();
    showToast('Naključen izbor arhiva');
  }

  // --- Event Listeners ---
  function bindEvents() {
    // Graceful fallback for any broken external CDN image
    document.addEventListener('error', (e) => {
      const img = e.target;
      if (!img || img.tagName !== 'IMG') return;
      const parent = img.parentElement;
      if (!parent) return;
      if (parent.classList.contains('card-media') || parent.classList.contains('detail-media')) {
        img.remove();
        if (!parent.querySelector('.card-no-img')) {
          const placeholder = document.createElement('div');
          placeholder.className = 'card-no-img';
          placeholder.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg><span>Slika ni na voljo</span>';
          parent.prepend(placeholder);
        }
      } else if (parent.classList.contains('wishlist-thumb')) {
        img.remove();
      }
    }, true);

    els.agentSelect.value = state.agent;
    els.agentSelect.addEventListener('change', (e) => {
      state.agent = e.target.value;
      localStorage.setItem(LS_AGENT, state.agent);
      renderGrid();
      if (!els.wishlistDrawer.hidden) renderWishlistDrawer();
      showToast('Agent: ' + (AGENTS.find((a) => a.id === state.agent)?.name || state.agent));
    });

    document.querySelectorAll('.currency-btn').forEach((btn) => {
      if (btn.dataset.currency === state.currency) btn.classList.add('active');
      else btn.classList.remove('active');

      btn.addEventListener('click', () => {
        state.currency = btn.dataset.currency;
        localStorage.setItem(LS_CURRENCY, state.currency);
        els.priceCurrencyLabel.textContent = state.currency;
        document.querySelectorAll('.currency-btn').forEach((b) =>
          b.classList.toggle('active', b.dataset.currency === state.currency)
        );
        applyFilters(true);
        if (!els.wishlistDrawer.hidden) renderWishlistDrawer();
      });
    });
    els.priceCurrencyLabel.textContent = state.currency;

    let searchTimer = null;
    els.searchInput.addEventListener('input', (e) => {
      const val = e.target.value;
      els.clearSearchBtn.hidden = val.length === 0;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        state.filters.q = val;
        applyFilters();
      }, 120);
    });

    els.clearSearchBtn.addEventListener('click', () => {
      els.searchInput.value = '';
      els.clearSearchBtn.hidden = true;
      state.filters.q = '';
      applyFilters();
      els.searchInput.focus();
    });

    const onCatClick = (e) => {
      const btn = e.target.closest('[data-cat]');
      if (!btn) return;
      state.filters.category = btn.dataset.cat;
      renderCategories();
      applyFilters();
    };
    els.categoryList.addEventListener('click', onCatClick);
    els.mobileCategoryList.addEventListener('click', onCatClick);

    if (els.quickCategoryBar) {
      els.quickCategoryBar.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-quick-cat]');
        if (!btn) return;
        state.filters.category = btn.dataset.quickCat;
        renderCategories();
        applyFilters();
      });
    }

    if (els.shuffleBtn) {
      els.shuffleBtn.addEventListener('click', triggerShuffle);
    }

    els.platformSelect.addEventListener('change', (e) => {
      state.filters.platform = e.target.value;
      applyFilters();
    });

    els.brandSelect.addEventListener('change', (e) => {
      state.filters.brand = e.target.value;
      applyFilters();
    });

    let priceTimer = null;
    const onPriceInput = () => {
      clearTimeout(priceTimer);
      priceTimer = setTimeout(() => {
        state.filters.priceMin = els.priceMin.value;
        state.filters.priceMax = els.priceMax.value;
        applyFilters();
      }, 180);
    };
    els.priceMin.addEventListener('input', onPriceInput);
    els.priceMax.addEventListener('input', onPriceInput);

    els.withImgToggle.addEventListener('change', (e) => {
      state.filters.withImg = e.target.checked;
      applyFilters();
    });

    els.sortSelect.addEventListener('change', (e) => {
      state.filters.sort = e.target.value;
      if (state.filters.sort === 'shuffle' && !state.shuffleSeed) {
        state.shuffleSeed = (Date.now() & 0x7fffffff) || 1;
      }
      applyFilters();
    });

    els.resetFiltersBtn.addEventListener('click', resetAllFilters);
    els.emptyResetBtn.addEventListener('click', resetAllFilters);

    els.activeChips.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-clear-chip]');
      if (!btn) return;
      const key = btn.dataset.clearChip;
      if (key === 'category') { state.filters.category = ''; renderCategories(); }
      if (key === 'platform') { state.filters.platform = ''; els.platformSelect.value = ''; }
      if (key === 'brand') { state.filters.brand = ''; els.brandSelect.value = ''; }
      if (key === 'price') { state.filters.priceMin = ''; state.filters.priceMax = ''; els.priceMin.value = ''; els.priceMax.value = ''; }
      if (key === 'withImg') { state.filters.withImg = false; els.withImgToggle.checked = false; }
      applyFilters();
    });

    els.loadMoreBtn.addEventListener('click', () => {
      if (state.mode === 'api') {
        state.apiOffset += PAGE_SIZE;
        fetchApiSearch(true);
      } else {
        state.renderedCount = Math.min(state.renderedCount + PAGE_SIZE, state.filtered.length);
        renderGrid();
      }
    });

    els.refreshCacheBtn.addEventListener('click', () => initData(true));

    els.itemsGrid.addEventListener('click', (e) => {
      const wishBtn = e.target.closest('[data-wish-id]');
      if (wishBtn) {
        e.stopPropagation();
        toggleWishlist(Number(wishBtn.dataset.wishId) || wishBtn.dataset.wishId);
        return;
      }

      const copyBtn = e.target.closest('[data-copy-id]');
      if (copyBtn) {
        const it = findItemById(copyBtn.dataset.copyId);
        if (it) copyText(convertToAgent(it.link, state.agent, it.plat), 'Povezava kopirana');
        return;
      }

      const detailTrigger = e.target.closest('[data-open-detail]');
      if (detailTrigger) {
        openDetailModal(detailTrigger.dataset.openDetail);
      }
    });

    els.mobileFilterBtn.addEventListener('click', openFilterSheet);
    els.closeFilterSheetBtn.addEventListener('click', closeFilterSheet);
    els.applyFiltersSheetBtn.addEventListener('click', closeFilterSheet);
    els.sheetBackdrop.addEventListener('click', closeFilterSheet);

    const openConverter = () => {
      els.converterModal.hidden = false;
      renderConverterOutput(els.converterInput.value);
      els.converterInput.focus();
    };
    els.openConverterBtn.addEventListener('click', openConverter);
    els.mobileConverterBtn.addEventListener('click', openConverter);

    els.converterInput.addEventListener('input', (e) => renderConverterOutput(e.target.value));
    els.converterPasteBtn.addEventListener('click', async () => {
      try {
        const txt = await navigator.clipboard.readText();
        els.converterInput.value = txt;
        renderConverterOutput(txt);
      } catch {
        showToast('Prilepite povezavo ročno');
      }
    });
    els.converterOutput.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-copy-raw]');
      if (btn) copyText(btn.dataset.copyRaw, 'Pretvorjena povezava kopirana');
    });

    const openWishlist = () => {
      renderWishlistDrawer();
      els.wishlistDrawer.hidden = false;
    };
    els.openWishlistBtn.addEventListener('click', openWishlist);
    els.mobileWishlistBtn.addEventListener('click', openWishlist);

    els.wishlistBody.addEventListener('click', (e) => {
      const rem = e.target.closest('[data-remove-wish]');
      if (rem) toggleWishlist(Number(rem.dataset.removeWish) || rem.dataset.removeWish);
    });

    els.copyWishlistBtn.addEventListener('click', () => {
      if (state.wishlist.length === 0) return;
      const lines = state.wishlist.map((w, i) =>
        (i + 1) + '. ' + w.naslov + ' (' + formatPrice(getItemPrice(w, state.currency), state.currency) + ') - ' + convertToAgent(w.link, state.agent, w.plat)
      );
      copyText(lines.join('\n'), 'Seznam želja kopiran');
    });

    els.exportWishlistBtn.addEventListener('click', () => {
      if (state.wishlist.length === 0) return;
      const blob = new Blob([JSON.stringify(state.wishlist, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'vaultx-želje.json';
      a.click();
      URL.revokeObjectURL(url);
      showToast('Seznam izvožen');
    });

    const shareBtn = $('shareWishlistBtn');
    if (shareBtn) shareBtn.addEventListener('click', shareWishlist);

    els.clearWishlistBtn.addEventListener('click', () => {
      state.wishlist = [];
      saveWishlist();
      renderWishlistDrawer();
      renderGrid();
      showToast('Seznam želja počiščen');
    });

    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.addEventListener('click', () => {
        $(btn.dataset.close).hidden = true;
      });
    });

    [els.detailModal, els.converterModal, els.wishlistDrawer, els.infoModal].forEach((backdrop) => {
      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.hidden = true;
      });
    });

    document.querySelectorAll('[data-info]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const type = btn.dataset.info;
        if (type === 'privacy') {
          els.infoTitle.textContent = 'Politika zasebnosti';
          els.infoBody.innerHTML = '<p style="color:var(--muted);">VAULT X ne zbira osebnih podatkov, nima računov in ne uporablja sledilnih piškotkov ali analitike. Pisave so naložene z istega strežnika. Izbrani agent, valuta, seznam želja in predpomnilnik baze ostanejo samo v tvojem brskalniku (localStorage in IndexedDB). Deljena povezava seznama želja vsebuje samo ID-je artiklov. Slike se nalagajo z zunanjih strežnikov trgovin z oznako no-referrer, ti strežniki vidijo tvoj IP naslov.</p>';
        } else if (type === 'faq') {
          els.infoTitle.textContent = 'Pogosta vprašanja';
          els.infoBody.innerHTML = '<div class="faq-item"><h3>Kaj je VAULT X?</h3><p>Kuriran indeks javno dostopnih povezav do artiklov na Weidianu, Taobaou, 1688 in Yupoo. Povezave odpreš neposredno ali prek izbranega agenta.</p></div>' +
            '<div class="faq-item"><h3>Zakaj je pri artiklu oznaka Mrtev link?</h3><p>Prodajalec je artikel odstranil. Povezava je še v arhivu, a verjetno ne deluje več.</p></div>' +
            '<div class="faq-item"><h3>Kako deluje deljenje seznama želja?</h3><p>V seznamu želja pritisni Deli seznam. Povezava vsebuje samo ID-je artiklov, prejemnik jo odpre in seznam se uvozi.</p></div>' +
            '<div class="faq-item"><h3>Je ocena poštnine točna?</h3><p>Ne. Teža in cena sta ocena po kategoriji. Pravi znesek določi agent po tehtanju paketa.</p></div>' +
            '<div class="faq-item"><h3>Kako najdem artikel s povezavo?</h3><p>Prilepi povezavo trgovine ali agenta v iskalno vrstico. Če je artikel v arhivu, se odpre, sicer se odpre pretvornik.</p></div>';
        } else {
          els.infoTitle.textContent = 'Pogoji uporabe';
          els.infoBody.innerHTML = '<p style="color:var(--muted);">VAULT X je indeks javno dostopnih povezav do zunanjih trgovin in agentov. Cene in razpoložljivost izdelkov se lahko spremenijo na izvornih platformah. Uporaba povezav poteka na lastno odgovornost.</p>';
        }
        els.infoModal.hidden = false;
      });
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === '/' && document.activeElement !== els.searchInput && document.activeElement.tagName !== 'INPUT') {
        e.preventDefault();
        els.searchInput.focus();
      }
      if (e.key === 'Escape') {
        els.detailModal.hidden = true;
        els.converterModal.hidden = true;
        els.wishlistDrawer.hidden = true;
        els.infoModal.hidden = true;
        closeFilterSheet();
      }
    });
  }


  // --- Kompaktno deljenje seznama želja (#w=...) ---
  function wishToken(w) {
    const info = extractPlatformAndId(w.link, w.plat);
    if (!info) return null;
    return (info.plat === 'weidian' ? 'w' : info.plat === 'taobao' ? 't' : 'a') + info.id;
  }
  function b64urlEncode(str) {
    return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  }
  function b64urlDecode(str) {
    str = str.replace(/-/g, '+').replace(/_/g, '/');
    while (str.length % 4) str += '=';
    return atob(str);
  }
  function buildShareUrl() {
    const toks = state.wishlist.map(wishToken).filter(Boolean);
    return location.origin + location.pathname + '#w=' + b64urlEncode(toks.join(','));
  }
  function shareWishlist() {
    if (!state.wishlist.length) return;
    const url = buildShareUrl();
    if (navigator.share) {
      navigator.share({ title: 'VAULT X seznam želja', url }).catch((err) => {
        if (err && err.name !== 'AbortError') copyText(url, 'Povezava seznama kopirana');
      });
    } else {
      copyText(url, 'Povezava seznama kopirana');
    }
  }
  function importSharedWishlist() {
    const m = location.hash.match(/^#w=([A-Za-z0-9_-]+)$/);
    if (!m) return;
    let toks = [];
    try { toks = b64urlDecode(m[1]).split(',').filter((t) => /^[wta]\d{5,13}$/.test(t)); } catch { return; }
    if (!toks.length) return;
    const want = new Set(toks);
    let added = 0;
    for (const it of state.items) {
      const t = wishToken(it);
      if (t && want.has(t) && !state.wishlist.some((w) => w.id === it.id)) {
        state.wishlist.push({ id: it.id, naslov: it.naslov, link: it.link, img: it.img, plat: it.plat, cny: it.cny, eur: it.eur, brand: it.brand, kat: it.kat });
        added++;
      }
    }
    if (added) {
      saveWishlist();
      showToast('Uvoženih ' + added + ' artiklov iz deljenega seznama');
      history.replaceState(null, '', location.pathname);
      renderWishlistDrawer();
      els.wishlistDrawer.hidden = false;
    }
  }

  // --- Ocena teže in poštnine (ocena, ne ponudba agenta) ---
  const WEIGHT_G = {
    'Jakne & Bunde': 1100, 'Puloverji & Hoodiji': 750, 'Majice': 260, 'Hlače & Kavbojke': 750,
    'Obutev': 1450, 'Kape & Pokrivala': 110, 'Torbe & Nahrbtniki': 900, 'Dodatki & Nakit': 120,
    'Dresi & Sport': 450, 'Ostalo': 500
  };
  const SHIP = { firstCny: 112, extraCny: 36, step: 500 }; // EU linija, ocena iz raziskave
  function estimateShipping(list) {
    let grams = 0;
    list.forEach((w) => { grams += WEIGHT_G[w.kat] || WEIGHT_G['Ostalo']; });
    if (!grams) return null;
    const steps = Math.max(1, Math.ceil(grams / SHIP.step));
    const cny = SHIP.firstCny + (steps - 1) * SHIP.extraCny;
    return { grams, cny, eur: cny / RATES.CNY_PER_EUR };
  }
  function renderShipEstimate() {
    const box = $('wishlistShip');
    if (!box) return;
    const est = estimateShipping(state.wishlist);
    if (!est) { box.innerHTML = ''; return; }
    box.innerHTML = 'Ocena teže: <strong>' + (est.grams / 1000).toFixed(1).replace('.', ',') + ' kg</strong> · poštnina v EU približno <strong>' +
      est.eur.toFixed(0) + ' EUR</strong>. Pravi znesek določi agent po tehtanju.';
  }

  // --- Pametna iskalna vrstica: prilepljena povezava in slika ---
  function handlePastedUrl(val) {
    const info = extractPlatformAndId(val);
    if (!info) return false;
    const hit = state.items.find((it) => {
      const i2 = extractPlatformAndId(it.link, it.plat);
      return i2 && i2.id === info.id;
    });
    els.searchInput.value = '';
    els.clearSearchBtn.hidden = true;
    state.filters.q = '';
    if (hit) {
      applyFilters();
      openDetailModal(hit.id);
      showToast('Artikel najden v arhivu');
    } else {
      els.converterInput.value = val;
      els.converterModal.hidden = false;
      renderConverterOutput(val);
      showToast('Ni v arhivu, odpiram pretvornik');
    }
    return true;
  }
  function handleImageFile(file) {
    if (!file || !/^image\//.test(file.type)) return false;
    showToast('Odpiram Google Lens, naloži sliko tam');
    window.open('https://lens.google.com/', '_blank', 'noopener');
    return true;
  }
  function bindSmartSearch() {
    els.searchInput.addEventListener('paste', (e) => {
      const cd = e.clipboardData;
      if (!cd) return;
      for (const item of cd.items || []) {
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          e.preventDefault();
          handleImageFile(item.getAsFile());
          return;
        }
      }
      const txt = cd.getData('text');
      if (/^\s*https?:\/\//i.test(txt) && extractPlatformAndId(txt.trim())) {
        e.preventDefault();
        handlePastedUrl(txt.trim());
      }
    });
    ['dragover', 'drop'].forEach((ev) => els.searchInput.addEventListener(ev, (e) => {
      e.preventDefault();
      if (ev === 'drop' && e.dataTransfer && e.dataTransfer.files[0]) handleImageFile(e.dataTransfer.files[0]);
    }));
    els.searchInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const v = els.searchInput.value.trim();
        if (/^https?:\/\//i.test(v)) handlePastedUrl(v);
      }
    });
  }
  function bindShortcuts() {
    document.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        els.searchInput.focus();
        els.searchInput.select();
        return;
      }
      const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
      if (typing || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 's' || e.key === 'S') triggerShuffle();
      if (e.key === 'w' || e.key === 'W') { renderWishlistDrawer(); els.wishlistDrawer.hidden = false; }
      if (!els.detailModal.hidden && state.activeDetailItem && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
        const idx = state.filtered.findIndex((it) => it.id === state.activeDetailItem.id);
        const next = state.filtered[idx + (e.key === 'ArrowRight' ? 1 : -1)];
        if (next) openDetailModal(next.id);
      }
    });
  }

  // --- Init ---
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  }

  updateWishlistBadges();
  bindEvents();
  bindSmartSearch();
  bindShortcuts();
  initData(false).then(() => { importSharedWishlist(); });
})();
