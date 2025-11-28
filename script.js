const API_KEY = "d625a81a36ac8141a613981f7f1cb2a1"; // ← ЗАМЕНИТЕ НА СВОЙ КЛЮЧ
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
let allMedia = [];
let currentPage = 1;
const PER_PAGE = 24;
let currentType = 'movie';
let totalPages = 1;
const noticeEl = document.getElementById('notice');
const MAX_PAGES_TO_LOAD = 50;
function showNotice(text, time = 3500) {
  noticeEl.textContent = text;
  noticeEl.style.display = 'block';
  setTimeout(() => noticeEl.style.display = 'none', time);
}
async function fetchMedia(query = null, type = currentType) {
  currentPage = 1;
  if (!API_KEY || API_KEY === 'YOUR_TMDB_API_KEY') {
    showNotice('TMDB API key не установлен — загружены демонстрационные данные.');
    let demo = getDemoMedia(type, 1000);
    if (query) demo = demo.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
    allMedia = demo;
    totalPages = Math.ceil(allMedia.length / PER_PAGE);
    renderPage(1);
    return;
  }
  try {
    showNotice('Загрузка данных... (может занять 10–15 сек)', 15000);
    const urls = [];
    const maxPages = query ? 10 : MAX_PAGES_TO_LOAD;
    for (let page = 1; page <= maxPages; page++) {
      const url = query
        ? `${TMDB}/search/${type}?api_key=${API_KEY}&language=ru-RU&query=${encodeURIComponent(query)}&page=${page}`
        : `${TMDB}/${type}/popular?api_key=${API_KEY}&language=ru-RU&page=${page}`;
      urls.push(fetch(url).then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      }));
    }
    const dataPages = await Promise.all(urls);
    let merged = [];
    dataPages.forEach(d => {
      if (d.results && Array.isArray(d.results)) {
        merged = merged.concat(d.results);
      }
    });
    const seen = new Set();
    allMedia = merged
      .filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      })
      .map(m => ({
        id: m.id,
        title: m.title || m.name || 'Без названия',
        poster: m.poster_path ? IMG + m.poster_path : '',
        overview: m.overview || '',
        year: (m.release_date || m.first_air_date || '').slice(0, 4) || '—',
        vote: m.vote_average ? m.vote_average.toFixed(1) : '—',
        tmdbUrl: `https://www.themoviedb.org/${type}/${m.id}`,
        type: type,
        seasons: null
      }));
    totalPages = Math.ceil(allMedia.length / PER_PAGE);
    renderPage(1);
    showNotice(`Загружено ${allMedia.length} элементов`, 3000);
  } catch (err) {
    console.error('Ошибка загрузки:', err);
    showNotice('Ошибка загрузки — смотри консоль.', 5000);
    allMedia = getDemoMedia(type, 500);
    totalPages = Math.ceil(allMedia.length / PER_PAGE);
    renderPage(1);
  }
}
// === ТРЕЙЛЕРЫ ===
const trailerModalStyle = `
  #trailerModal {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.9);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    animation: fadeInTrailer 0.3s;
  }
  .trailer-modal-content {
    position: relative;
    width: 90%;
    max-width: 900px;
    background: #000;
    border-radius: 12px;
    padding: 20px;
  }
  .close-trailer-btn {
    position: absolute;
    top: 10px;
    right: 16px;
    background: none;
    border: none;
    color: white;
    font-size: 32px;
    cursor: pointer;
    z-index: 1001;
  }
  @keyframes fadeInTrailer {
    from { opacity: 0; } to { opacity: 1; }
  }
  @media (max-width: 768px) {
    .trailer-modal-content { padding: 12px; }
    .trailer-modal-content iframe { height: 300px; }
  }
`;
if (!document.getElementById('trailer-modal-styles')) {
  const styleEl = document.createElement('style');
  styleEl.id = 'trailer-modal-styles';
  styleEl.textContent = trailerModalStyle;
  document.head.appendChild(styleEl);
}
async function fetchTrailers() {
  if (!API_KEY || API_KEY === 'YOUR_TMDB_API_KEY') {
    document.getElementById('trailersTrack').innerHTML = '<div class="trailer-placeholder">Трейлеры недоступны без API-ключа TMDB</div>';
    return;
  }
  try {
    showNotice('Загрузка трейлеров...', 5000);
    let allMoviesWithTrailers = [];
    let page = 1;
    const targetCount = 10;
    while (allMoviesWithTrailers.length < targetCount && page <= 5) {
      const res = await fetch(`${TMDB}/movie/popular?api_key=${API_KEY}&language=ru-RU&page=${page}`);
      const data = await res.json();
     
      if (!data.results || data.results.length === 0) break;
      const trailerPromises = data.results.map(async (movie) => {
        try {
          const videoRes = await fetch(`${TMDB}/movie/${movie.id}/videos?api_key=${API_KEY}&language=ru-RU`);
          const videoData = await videoRes.json();
          const trailer = videoData.results.find(v =>
            v.type === 'Trailer' &&
            v.site === 'YouTube' &&
            (v.official || v.name?.toLowerCase().includes('trailer'))
          ) || videoData.results.find(v =>
            v.type === 'Trailer' &&
            v.site === 'YouTube'
          );
          return trailer ? { ...movie, trailer_key: trailer.key } : null;
        } catch (err) {
          console.warn('Ошибка загрузки трейлера для фильма:', movie.id);
          return null;
        }
      });
      const results = await Promise.all(trailerPromises);
      const validTrailers = results.filter(m => m !== null);
     
      allMoviesWithTrailers.push(...validTrailers);
      page++;
      if (allMoviesWithTrailers.length > targetCount) {
        allMoviesWithTrailers = allMoviesWithTrailers.slice(0, targetCount);
        break;
      }
    }
    if (allMoviesWithTrailers.length === 0) {
      document.getElementById('trailersTrack').innerHTML = '<div class="trailer-placeholder">Не найдено фильмов с трейлерами</div>';
    } else {
      renderTrailers(allMoviesWithTrailers);
      showNotice(`Загружено ${allMoviesWithTrailers.length} трейлеров`, 3000);
    }
  } catch (err) {
    console.error('Критическая ошибка загрузки трейлеров:', err);
    document.getElementById('trailersTrack').innerHTML = '<div class="trailer-placeholder">Не удалось загрузить трейлеры</div>';
  }
}
function renderTrailers(movies) {
  const track = document.getElementById('trailersTrack');
  const cardsHtml = movies.map(movie => `
    <div class="trailer-card" data-key="${movie.trailer_key}" data-title="${escapeHtml(movie.title)}">
      <img class="trailer-poster"
           src="${movie.poster_path ? IMG + movie.poster_path : 'https://via.placeholder.com/500x280?text=Poster'}"
           alt="${movie.title}">
      <div class="trailer-overlay">
        <h3 class="trailer-title">${escapeHtml(movie.title)}</h3>
        <button class="watch-trailer-btn">Смотреть</button>
      </div>
    </div>
  `).join('');
  track.innerHTML = cardsHtml + cardsHtml;
  const cards = track.querySelectorAll('.trailer-card');
  const half = cards.length / 2;
  cards.forEach((card, i) => {
    if (i < half) {
      card.addEventListener('click', () => {
        openTrailerModal(card.dataset.key, card.dataset.title);
      });
    }
    card.addEventListener('mouseenter', () => {
      track.style.animationPlayState = 'paused';
    });
    card.addEventListener('mouseleave', () => {
      track.style.animationPlayState = 'running';
    });
  });
}
function openTrailerModal(youtubeKey, title) {
  const modal = document.createElement('div');
  modal.id = 'trailerModal';
  modal.innerHTML = `
    <div class="trailer-modal-content">
      <button class="close-trailer-btn">&times;</button>
      <h3 style="color:#fff; margin:0 0 16px; text-align:center;">${escapeHtml(title)}</h3>
      <iframe
        width="100%"
        height="500"
        src="https://www.youtube.com/embed/${youtubeKey}?autoplay=1"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen>
      </iframe>
    </div>
  `;
  document.body.appendChild(modal);
  const closeBtn = modal.querySelector('.close-trailer-btn');
  if (closeBtn) {
    closeBtn.onclick = () => {
      document.body.removeChild(modal);
    };
  }
  modal.onclick = (e) => {
    if (e.target === modal) {
      document.body.removeChild(modal);
    }
  };
}
function getDemoMedia(type, count = 100) {
  const demo = [];
  const prefix = type === 'movie' ? 'Демо Фильм' : 'Демо Сериал';
  for (let i = 1; i <= count; i++) {
    demo.push({
      id: 10000 + i,
      title: `${prefix} ${i}`,
      poster: `https://via.placeholder.com/500x750?text=Poster+${i}`,
      overview: 'Короткое описание.',
      year: (2000 + (i % 25)).toString(),
      vote: (Math.random() * 2 + 7).toFixed(1),
      tmdbUrl: '#',
      type: type,
      seasons: null
    });
  }
  return demo;
}
function renderPage(pageNum) {
  if (pageNum < 1) pageNum = 1;
  if (pageNum > totalPages) pageNum = totalPages;
  currentPage = pageNum;
  if (allMedia.length === 0) {
    document.getElementById('movies').innerHTML = '<p style="padding:20px; text-align:center;">Ничего не найдено.</p>';
    document.getElementById('pager').innerHTML = '';
    return;
  }
  const start = (pageNum - 1) * PER_PAGE;
  const slice = allMedia.slice(start, start + PER_PAGE);
  const container = document.getElementById('movies');
  container.innerHTML = '';
  const fragment = document.createDocumentFragment();
  slice.forEach(m => {
    const el = document.createElement('div');
    el.className = 'movie';
    el.innerHTML = `
      <img src="${m.poster}" alt="${m.title}" loading="lazy" onerror="this.src='https://via.placeholder.com/500x750?text=no+image'">
      <div class='movie-info'>
        <div class='movie-title'>${escapeHtml(m.title)}</div>
        <div class='movie-sub'>${m.year} • Рейтинг: ${m.vote}</div>
      </div>`;
    el.onclick = () => openInfo(m);
    fragment.appendChild(el);
  });
  container.appendChild(fragment);
  renderPager();
}
function renderPager() {
  if (totalPages <= 1) {
    document.getElementById('pager').innerHTML = '';
    return;
  }
  const pager = document.getElementById('pager');
  pager.innerHTML = '';
  const fragment = document.createDocumentFragment();
  const prevBtn = document.createElement('button');
  prevBtn.innerHTML = '&laquo;';
  prevBtn.disabled = currentPage === 1;
  prevBtn.onclick = () => renderPage(currentPage - 1);
  fragment.appendChild(prevBtn);
  if (currentPage > 3) {
    const firstBtn = document.createElement('button');
    firstBtn.textContent = '1';
    firstBtn.onclick = () => renderPage(1);
    fragment.appendChild(firstBtn);
   
    if (currentPage > 4) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      fragment.appendChild(ellipsis);
    }
  }
  const startPage = Math.max(1, currentPage - 2);
  const endPage = Math.min(totalPages, currentPage + 2);
  for (let i = startPage; i <= endPage; i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i === currentPage) btn.classList.add('active');
    btn.onclick = () => renderPage(i);
    fragment.appendChild(btn);
  }
  if (currentPage < totalPages - 2) {
    if (currentPage < totalPages - 3) {
      const ellipsis = document.createElement('span');
      ellipsis.textContent = '...';
      fragment.appendChild(ellipsis);
    }
    const lastBtn = document.createElement('button');
    lastBtn.textContent = totalPages;
    lastBtn.onclick = () => renderPage(totalPages);
    fragment.appendChild(lastBtn);
  }
  const nextBtn = document.createElement('button');
  nextBtn.innerHTML = '&raquo;';
  nextBtn.disabled = currentPage === totalPages;
  nextBtn.onclick = () => renderPage(currentPage + 1);
  fragment.appendChild(nextBtn);
  pager.appendChild(fragment);
}
function escapeHtml(text) {
  return text.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
// === ПОИСК ===
const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
function performSearch() {
  const q = searchInput.value.trim();
  fetchMedia(q || null, currentType);
}
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});
// === ТИП МЕДИА ===
const typeSelect = document.getElementById('mediaType');
typeSelect.addEventListener('change', (e) => {
  currentType = e.target.value;
  searchInput.value = '';
  fetchMedia(null, currentType);
});
// === ИНФО-ОКНО ===
let selectedMedia = null;
async function openInfo(media) {
  selectedMedia = media;
  document.getElementById('infoPoster').src = media.poster || 'https://via.placeholder.com/500x750?text=no+image';
  document.getElementById('infoTitle').textContent = media.title;
  document.getElementById('infoOverview').textContent = media.overview || 'Описание отсутствует.';
  document.getElementById('infoMeta').textContent = `Год: ${media.year} • Рейтинг: ${media.vote}`;
  document.getElementById('tmdbLink').href = media.tmdbUrl || '#';
  const selector = document.getElementById('seasonEpisodeSelector');
  if (media.type === 'tv') {
    selector.style.display = 'block';
    if (!media.seasons) {
      await populateSeasons(media);
    } else {
      populateSeasonsFromCache(media);
    }
  } else {
    selector.style.display = 'none';
  }
  const infoModal = document.getElementById('infoModal');
  infoModal.style.display = 'block';
  const infoBox = document.querySelector('.info-box');
  setTimeout(() => {
    infoModal.classList.add('show');
    infoBox.classList.add('show');
  }, 10);
}
function closeInfo() {
  const infoModal = document.getElementById('infoModal');
  const infoBox = document.querySelector('.info-box');
  infoModal.classList.remove('show');
  infoBox.classList.remove('show');
  setTimeout(() => {
    infoModal.style.display = 'none';
  }, 300);
}
document.addEventListener('DOMContentLoaded', () => {
  const closeBtn = document.querySelector('.close-info-btn');
  if (closeBtn) {
    closeBtn.addEventListener('click', closeInfo);
  }
});
document.addEventListener('click', (e) => {
  const infoBox = document.getElementById('infoModal');
  if (infoBox.classList.contains('show') && !infoBox.contains(e.target)) {
    closeInfo();
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    const infoBox = document.getElementById('infoModal');
    if (infoBox.classList.contains('show')) {
      closeInfo();
    }
  }
});
// === СЕЗОНЫ/ЭПИЗОДЫ ===
async function populateSeasons(media) {
  const seasonSelect = document.getElementById('seasonSelect');
  const episodeSelect = document.getElementById('episodeSelect');
  seasonSelect.innerHTML = '';
  episodeSelect.innerHTML = '';
  if (!API_KEY || API_KEY === 'YOUR_TMDB_API_KEY') {
    media.seasons = [];
    for (let s = 1; s <= 3; s++) {
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `Сезон ${s}`;
      seasonSelect.appendChild(opt);
      media.seasons[s - 1] = { episodes: [] };
      for (let e = 1; e <= 10; e++) {
        media.seasons[s - 1].episodes.push({ episode_number: e, name: '' });
      }
    }
    await populateEpisodes(1, media);
    return;
  }
  try {
    const res = await fetch(`${TMDB}/tv/${media.id}?api_key=${API_KEY}&language=ru-RU`);
    const data = await res.json();
    if (data.success === false || data.status_code) {
      console.error('TMDB Error:', data);
      showNotice('Сериал недоступен: ' + (data.status_message || 'ошибка загрузки'));
      media.seasons = [];
      seasonSelect.innerHTML = '<option>Ошибка загрузки</option>';
      return;
    }
    const numSeasons = data.number_of_seasons || 1;
    media.seasons = [];
    for (let s = 1; s <= numSeasons; s++) {
      if (s === 0) continue;
      const opt = document.createElement('option');
      opt.value = s;
      opt.textContent = `Сезон ${s}`;
      seasonSelect.appendChild(opt);
      media.seasons[s - 1] = { episodes: null };
    }
    seasonSelect.onchange = async () => {
      const s = seasonSelect.value;
      await populateEpisodes(s, media);
    };
    if (numSeasons >= 1) {
      await populateEpisodes(1, media);
    }
  } catch (err) {
    console.error('populateSeasons error:', err);
    showNotice('Не удалось загрузить сезоны.');
  }
}
function populateSeasonsFromCache(media) {
  const seasonSelect = document.getElementById('seasonSelect');
  const episodeSelect = document.getElementById('episodeSelect');
  seasonSelect.innerHTML = '';
  episodeSelect.innerHTML = '';
  media.seasons.forEach((season, idx) => {
    const s = idx + 1;
    const opt = document.createElement('option');
    opt.value = s;
    opt.textContent = `Сезон ${s}`;
    seasonSelect.appendChild(opt);
  });
  seasonSelect.onchange = async () => {
    const s = seasonSelect.value;
    await populateEpisodes(s, media);
  };
  populateEpisodes(1, media);
}
async function populateEpisodes(seasonNum, media) {
  const episodeSelect = document.getElementById('episodeSelect');
  episodeSelect.innerHTML = '';
  const seasonIdx = seasonNum - 1;
  if (media.seasons[seasonIdx].episodes) {
    media.seasons[seasonIdx].episodes.forEach(ep => {
      const opt = document.createElement('option');
      opt.value = ep.episode_number;
      opt.textContent = `Эпизод ${ep.episode_number}`;
      episodeSelect.appendChild(opt);
    });
    return;
  }
  if (!API_KEY || API_KEY === 'YOUR_TMDB_API_KEY') {
    media.seasons[seasonIdx].episodes = [];
    for (let e = 1; e <= 10; e++) {
      const ep = { episode_number: e, name: '' };
      media.seasons[seasonIdx].episodes.push(ep);
      const opt = document.createElement('option');
      opt.value = e;
      opt.textContent = `Эпизод ${e}`;
      episodeSelect.appendChild(opt);
    }
    return;
  }
  try {
    const res = await fetch(`${TMDB}/tv/${media.id}/season/${seasonNum}?api_key=${API_KEY}&language=ru-RU`);
    const data = await res.json();
    const episodes = data.episodes || [];
    media.seasons[seasonIdx].episodes = episodes;
    episodes.forEach(ep => {
      const opt = document.createElement('option');
      opt.value = ep.episode_number;
      opt.textContent = `Эпизод ${ep.episode_number}`;
      episodeSelect.appendChild(opt);
    });
    if (episodes.length === 0) {
      const opt = document.createElement('option');
      opt.textContent = 'Нет эпизодов';
      episodeSelect.appendChild(opt);
    }
  } catch (err) {
    console.error(err);
    showNotice('Ошибка загрузки эпизодов.');
  }
}
// === MULTIEMBED (ЕДИНСТВЕННЫЙ ПЛЕЕР) ===
function buildEmbedUrl(media, season = null, episode = null) {
  const id = media.id;
  if (media.type === 'movie') {
    return `https://www.2embed.cc/embed/${id}`;
  } else {
    if (!season || !episode) return null;
    return `https://www.2embed.cc/embedtv/${id}&s=${season}&e=${episode}`;
  }
}
let isWatching = false;
function handleWatch() {
  if (!selectedMedia || isWatching) return;
  isWatching = true;
  const watchBtn = document.getElementById('watchBtn');
  const originalText = watchBtn.textContent;
  watchBtn.textContent = 'Загрузка...';
  watchBtn.disabled = true;
  let url;
  if (selectedMedia.type === 'movie') {
    url = buildEmbedUrl(selectedMedia);
  } else {
    const s = document.getElementById('seasonSelect').value;
    const e = document.getElementById('episodeSelect').value;
    if (!s || !e) {
      showNotice('Выберите сезон и эпизод.');
      isWatching = false;
      watchBtn.textContent = originalText;
      watchBtn.disabled = false;
      return;
    }
    url = buildEmbedUrl(selectedMedia, s, e);
  }
  if (url) {
    openPlayer(url);
    closeInfo();
  } else {
    showNotice('Не удалось сформировать ссылку.');
  }
  setTimeout(() => {
    isWatching = false;
    if (watchBtn) {
      watchBtn.textContent = originalText;
      watchBtn.disabled = false;
    }
  }, 1500);
}
// === PLAYER MODAL ===
let playerIsOpen = false;
function openPlayer(link) {
  if (playerIsOpen) return;
  playerIsOpen = true;
 
  const playerModal = document.getElementById('playerModal');
  playerModal.style.display = 'block';
  const frame = document.getElementById('playerFrame');
  frame.src = link;
 
  showNotice('Загружается 2Embed... Если видео не появится — обновите страницу. Выберите русскую озвучку в плеере, если доступна.', 8000);
 
  setTimeout(() => {
    playerModal.classList.add('show');
  }, 10);
}
function closePlayer() {
  const playerModal = document.getElementById('playerModal');
  playerModal.classList.remove('show');
  setTimeout(() => {
    const frame = document.getElementById('playerFrame');
    frame.src = '';
    playerModal.style.display = 'none';
    playerIsOpen = false;
  }, 300);
}
document.addEventListener('DOMContentLoaded', () => {
  const closePlayerBtn = document.querySelector('.close-player-btn');
  if (closePlayerBtn) {
    closePlayerBtn.addEventListener('click', closePlayer);
  }
});
fetchMedia(null, currentType);
fetchTrailers();
