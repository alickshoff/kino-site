// script.js
// --- ВСТАВЬ СВОЙ TMDB API KEY ЗДЕСЬ ---
const API_KEY = "d625a81a36ac8141a613981f7f1cb2a1"; // <- вставь ключ (получи на https://www.themoviedb.org/settings/api)
// --------------------------------------
const TMDB = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p/w500";
const EMBED_BASE = "https://www.2embed.cc/embed";
let allMedia = [];
let currentPage = 1;
const PER_PAGE = 30;
let currentType = 'movie';
const noticeEl = document.getElementById('notice');
function showNotice(text, time=3500){
  noticeEl.textContent = text;
  noticeEl.style.display='block';
  setTimeout(()=> noticeEl.style.display='none', time);
}
async function fetchMedia(query = null, type = currentType){
  let url1, url2;
  if (query){
    const q = encodeURIComponent(query);
    url1 = `${TMDB}/search/${type}?api_key=${API_KEY}&language=ru-RU&query=${q}&page=1`;
    url2 = `${TMDB}/search/${type}?api_key=${API_KEY}&language=ru-RU&query=${q}&page=2`;
  } else {
    url1 = `${TMDB}/${type}/popular?api_key=${API_KEY}&language=ru-RU&page=1`;
    url2 = `${TMDB}/${type}/popular?api_key=${API_KEY}&language=ru-RU&page=2`;
  }
  try{
    if (!API_KEY || API_KEY === 'YOUR_TMDB_API_KEY'){
      let demo = getDemoMedia(type);
      if (query) demo = demo.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
      allMedia = demo;
      renderPage(1);
      renderPager();
      return;
    }
    const [d1, d2] = await Promise.all([
      fetch(url1).then(res => res.json()),
      fetch(url2).then(res => res.json())
    ]);
    const merged = (d1.results||[]).concat(d2.results||[]);
    allMedia = merged.map(m => ({
      id: m.id,
      title: m.title || m.name,
      poster: m.poster_path ? IMG + m.poster_path : '',
      overview: m.overview || '',
      year: (m.release_date || m.first_air_date || '').slice(0,4) || '—',
      vote: m.vote_average || '—',
      tmdbUrl: `https://www.themoviedb.org/${type}/${m.id}`,
      type: type,
      seasons: null
    }));
    renderPage(1);
    renderPager();
  } catch(err){
    console.error(err);
    showNotice('Ошибка загрузки с TMDB — смотри консоль.');
    allMedia = getDemoMedia(type);
    renderPage(1);
    renderPager();
  }
}
function getDemoMedia(type){
  const demo = [];
  const prefix = type === 'movie' ? 'Демо Фильм' : 'Демо Сериал';
  for(let i=1;i<=40;i++) demo.push({
    id: 10000+i,
    title: `${prefix} ${i}`,
    poster: 'https://via.placeholder.com/500x750?text=Poster+'+i,
    overview: 'Короткое описание.',
    year: '2020',
    vote: (Math.random()*2 + 7).toFixed(1),
    tmdbUrl: '#',
    type: type,
    seasons: null
  });
  return demo;
}
function renderPage(pageNum){
  currentPage = pageNum;
  if (allMedia.length === 0){
    document.getElementById('movies').innerHTML = '<p style="padding:20px">Ничего не найдено.</p>';
    document.getElementById('pager').innerHTML = '';
    return;
  }
  const start = (pageNum-1)*PER_PAGE;
  const slice = allMedia.slice(start, start+PER_PAGE);
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
}
function renderPager(){
  if (allMedia.length === 0){
    document.getElementById('pager').innerHTML = '';
    return;
  }
  const pager = document.getElementById('pager');
  const pages = Math.ceil(allMedia.length / PER_PAGE) || 1;
  pager.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for(let i=1;i<=pages;i++){
    const btn = document.createElement('button');
    btn.textContent = i;
    if (i===currentPage) btn.classList.add('active');
    btn.onclick = () => renderPage(i);
    fragment.appendChild(btn);
  }
  pager.appendChild(fragment);
}
function escapeHtml(text){ return text.replace(/[&<>\"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'})[c]); }
// Поиск
const searchInput = document.getElementById('search');
const searchBtn = document.getElementById('searchBtn');
function performSearch() {
  const q = searchInput.value.trim();
  fetchMedia(q ? q : null);
}
searchBtn.addEventListener('click', performSearch);
searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') performSearch();
});
// Переключение типа
const typeSelect = document.getElementById('mediaType');
typeSelect.addEventListener('change', (e)=>{
  currentType = e.target.value;
  searchInput.value = '';
  fetchMedia();
});
// Карточки и просмотр
let selectedMedia = null;
async function openInfo(media){
  selectedMedia = media;
  document.getElementById('infoPoster').src = media.poster || 'https://via.placeholder.com/500x750?text=no+image';
  document.getElementById('infoTitle').textContent = media.title;
  document.getElementById('infoOverview').textContent = media.overview || 'Описание отсутствует.';
  document.getElementById('infoMeta').textContent = `Год: ${media.year} • Рейтинг: ${media.vote}`;
  document.getElementById('tmdbLink').href = media.tmdbUrl || '#';
  const selector = document.getElementById('seasonEpisodeSelector');
  const watchBtn = document.getElementById('watchBtn');
  if (media.type === 'tv') {
    watchBtn.textContent = 'Выбрать сезон/эпизод';
    selector.style.display = 'block';
    if (!media.seasons) {
      await populateSeasons(media);
    } else {
      populateSeasonsFromCache(media);
    }
  } else {
    watchBtn.textContent = 'Смотреть';
    selector.style.display = 'none';
  }
  document.getElementById('infoModal').style.display = 'block';
}
function closeInfo(){ document.getElementById('infoModal').style.display = 'none'; }
async function populateSeasons(media){
  const seasonSelect = document.getElementById('seasonSelect');
  const episodeSelect = document.getElementById('episodeSelect');
  seasonSelect.innerHTML = '';
  episodeSelect.innerHTML = '';
  if (!API_KEY || API_KEY==='YOUR_TMDB_API_KEY') {
    media.seasons = [];
    for(let s=1; s<=3; s++){
      const opt = document.createElement('option'); opt.value = s; opt.textContent = `Сезон ${s}`;
      seasonSelect.appendChild(opt);
      media.seasons[s-1] = {episodes: []};
      for(let e=1; e<=10; e++){
        media.seasons[s-1].episodes.push({episode_number: e, name: ''});
      }
    }
    await populateEpisodes(1, media);
    return;
  }
  try{
    const res = await fetch(`${TMDB}/tv/${media.id}?api_key=${API_KEY}&language=ru-RU`);
    const data = await res.json();
    const numSeasons = data.number_of_seasons || 1;
    media.seasons = [];
    for(let s=1; s<=numSeasons; s++){
      const opt = document.createElement('option'); opt.value = s; opt.textContent = `Сезон ${s}`;
      seasonSelect.appendChild(opt);
      media.seasons[s-1] = {episodes: null};
    }
    seasonSelect.addEventListener('change', async (e)=>{
      const s = e.target.value;
      await populateEpisodes(s, media);
    });
    await populateEpisodes(1, media);
  } catch(err){
    console.error(err);
    showNotice('Ошибка загрузки сезонов.');
  }
}
function populateSeasonsFromCache(media){
  const seasonSelect = document.getElementById('seasonSelect');
  const episodeSelect = document.getElementById('episodeSelect');
  seasonSelect.innerHTML = '';
  episodeSelect.innerHTML = '';
  media.seasons.forEach((season, idx) => {
    const s = idx + 1;
    const opt = document.createElement('option'); opt.value = s; opt.textContent = `Сезон ${s}`;
    seasonSelect.appendChild(opt);
  });
  seasonSelect.addEventListener('change', async (e)=>{
    const s = e.target.value;
    await populateEpisodes(s, media);
  });
  populateEpisodes(1, media);
}
async function populateEpisodes(seasonNum, media){
  const episodeSelect = document.getElementById('episodeSelect');
  episodeSelect.innerHTML = '';
  const seasonIdx = seasonNum - 1;
  if (media.seasons[seasonIdx].episodes) {
    media.seasons[seasonIdx].episodes.forEach(ep => {
      const opt = document.createElement('option'); opt.value = ep.episode_number; opt.textContent = `Эпизод ${ep.episode_number} ${ep.name ? '- ' + ep.name : ''}`;
      episodeSelect.appendChild(opt);
    });
    return;
  }
  if (!API_KEY || API_KEY==='YOUR_TMDB_API_KEY') {
    media.seasons[seasonIdx].episodes = [];
    for(let e=1; e<=10; e++){
      const ep = {episode_number: e, name: ''};
      media.seasons[seasonIdx].episodes.push(ep);
      const opt = document.createElement('option'); opt.value = e; opt.textContent = `Эпизод ${e}`;
      episodeSelect.appendChild(opt);
    }
    return;
  }
  try{
    const res = await fetch(`${TMDB}/tv/${media.id}/season/${seasonNum}?api_key=${API_KEY}&language=ru-RU`);
    const data = await res.json();
    const episodes = data.episodes || [];
    media.seasons[seasonIdx].episodes = episodes;
    episodes.forEach(ep => {
      const opt = document.createElement('option'); opt.value = ep.episode_number; opt.textContent = `Эпизод ${ep.episode_number} ${ep.name ? '- ' + ep.name : ''}`;
      episodeSelect.appendChild(opt);
    });
    if (episodes.length === 0) {
      const opt = document.createElement('option'); opt.textContent = 'Нет эпизодов';
      episodeSelect.appendChild(opt);
    }
  } catch(err){
    console.error(err);
    showNotice('Ошибка загрузки эпизодов.');
  }
}
function handleWatch(){
  if (!selectedMedia) return;
  if (selectedMedia.type === 'movie') {
    const url = `${EMBED_BASE}/${selectedMedia.id}`;
    openPlayer(url);
    closeInfo();  // Закрываем окно с описанием
  } else {
    showNotice('Выберите сезон и эпизод ниже.');
  }
}
function watchSelectedEpisode(){
  if (!selectedMedia || selectedMedia.type !== 'tv') return;
  const s = document.getElementById('seasonSelect').value;
  const e = document.getElementById('episodeSelect').value;
  if (!s || !e) {
    showNotice('Выберите сезон и эпизод.');
    return;
  }
  const url = `${EMBED_BASE}tv/${selectedMedia.id}&s=${s}&e=${e}`;
  openPlayer(url);
  closeInfo();  // Закрываем окно с описанием
}
function openPlayer(link){ 
  const frame = document.getElementById('playerFrame');
  frame.src = link; 
  document.getElementById('playerModal').style.display = 'block'; 
}
function closePlayer(){ 
  const frame = document.getElementById('playerFrame');
  frame.src=''; 
  document.getElementById('playerModal').style.display='none'; 
}
// старт
fetchMedia();
