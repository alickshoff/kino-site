async function loadMovies() {
    const res = await fetch('movies.json');
    const movies = await res.json();
    const container = document.getElementById('movies');
    
    
    movies.forEach(m => {
    const div = document.createElement('div');
    div.className = 'movie';
    div.innerHTML = `<img src="${m.poster}"><div class="movie-title">${m.title}</div>`;
    div.onclick = () => openPlayer(m.iframe);
    container.appendChild(div);
    });
    }
    
    
    function openPlayer(link) {
    document.getElementById('playerFrame').src = link;
    document.getElementById('playerModal').style.display = 'block';
    }
    function closePlayer() {
    document.getElementById('playerFrame').src = '';
    document.getElementById('playerModal').style.display = 'none';
    }
    
    
    loadMovies();