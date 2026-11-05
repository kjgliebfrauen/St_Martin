const songNav = document.querySelector("#song-nav");
const songList = document.querySelector("#song-list");
const songContent = document.querySelector("#song-content");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const songbook = document.querySelector(".songbook");
const navToggle = document.querySelector("#nav-toggle");
const navReopen = document.querySelector("#nav-reopen");

function setNavigationCollapsed(collapsed) {
  songNav.classList.toggle("is-collapsed", collapsed);
  songbook.classList.toggle("is-nav-collapsed", collapsed);
  navToggle.setAttribute("aria-expanded", String(!collapsed));
  navToggle.hidden = collapsed;
  navReopen.hidden = !collapsed;
}

navToggle.addEventListener("click", () => {
  setNavigationCollapsed(true);
});

navReopen.addEventListener("click", () => {
  setNavigationCollapsed(false);
});

if (window.matchMedia("(max-width: 680px)").matches) setNavigationCollapsed(true);

const themeToggle = document.querySelector("#theme-toggle");
themeToggle.addEventListener("click", () => {
  const isDark = document.body.classList.toggle("dark-mode");
  themeToggle.setAttribute("aria-pressed", String(isDark));
  themeToggle.setAttribute("aria-label", isDark ? "Hellmodus einschalten" : "Dunkelmodus einschalten");
  themeToggle.title = isDark ? "Hellmodus einschalten" : "Dunkelmodus einschalten";
});

function addSong(song, index) {
  const songId = `song-${index + 1}`;
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "song-link";
  link.href = `#${songId}`;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    const target = document.getElementById(songId);
    setNavigationCollapsed(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!target) return;
        const display = document.querySelector(".song-display");
        const targetTop = display.scrollTop + target.getBoundingClientRect().top - display.getBoundingClientRect().top;
        display.scrollTo({ top: targetTop, behavior: "smooth" });
        history.replaceState(null, "", `#${songId}`);
      });
    });
  });

  const number = document.createElement("span");
  number.className = "song-number";
  number.textContent = String(index + 1).padStart(2, "0");
  const title = document.createElement("span");
  title.className = "song-link-title";
  title.textContent = song.title;
  link.append(number, title);
  item.append(link);
  songList.append(item);

  const article = document.createElement("article");
  article.className = "song-card";
  article.id = songId;
  const heading = document.createElement("h2");
  heading.textContent = song.title;
  article.append(heading);

  const stanzas = [];
  let stanza = [];
  song.text.split(/\r?\n/).forEach((line) => {
    if (/^\s*\d+[.)]\s*/.test(line) && stanza.length) {
      stanzas.push(stanza);
      stanza = [];
    }
    if (!line.trim() && stanza.length) {
      stanzas.push(stanza);
      stanza = [];
    } else if (line.trim()) {
      stanza.push(line);
    }
  });
  if (stanza.length) stanzas.push(stanza);

  stanzas.forEach((lines) => {
    const paragraph = document.createElement("p");
    paragraph.className = "song-stanza";
    paragraph.textContent = lines.join("\n");
    article.append(paragraph);
  });
  songContent.append(article);
}

async function loadFromStaticFiles() {
  const manifestUrl = new URL("texte/songs.json", document.baseURI);
  const manifestResponse = await fetch(manifestUrl);
  if (!manifestResponse.ok) throw new Error("Der statische Liedkatalog wurde nicht gefunden.");
  const manifest = await manifestResponse.json();
  if (!Array.isArray(manifest.files)) throw new Error("Der statische Liedkatalog hat ein ungültiges Format.");

  return Promise.all(manifest.files.map(async (fileName) => {
    if (typeof fileName !== "string" || fileName.includes("/") || fileName.includes("\\") || !fileName.toLowerCase().endsWith(".txt")) {
      throw new Error("Der statische Liedkatalog enthält einen ungültigen Dateinamen.");
    }
    const response = await fetch(new URL(`texte/${encodeURIComponent(fileName)}`, document.baseURI));
    if (!response.ok) throw new Error(`Lieddatei „${fileName}“ konnte nicht geladen werden.`);
    const contents = (await response.text()).replace(/^\uFEFF/, "");
    const lines = contents.split(/\r?\n/);
    const titleLine = lines.findIndex((line) => line.trim());
    if (titleLine < 0) return null;
    const title = lines[titleLine].trim();
    const text = lines.slice(titleLine + 1).join("\n").trim();
    return text ? { title, text } : null;
  })).then((songs) => songs.filter(Boolean));
}

async function renderSongs() {
  let songs;
  if (Array.isArray(window.ST_MARTIN_SONGS)) {
    songs = window.ST_MARTIN_SONGS;
  } else {
    try {
      const response = await fetch("/api/songs");
      if (!response.ok) throw new Error("API nicht verfügbar.");
      const library = await response.json();
      if (!Array.isArray(library.songs)) throw new Error("Die Liedliste hat ein ungültiges Format.");
      songs = library.songs;
    } catch {
      try {
        songs = await loadFromStaticFiles();
      } catch {
        loadingState.hidden = true;
        document.querySelector("#empty-title").textContent = "Liedtexte konnten nicht geladen werden";
        document.querySelector("#empty-copy").textContent = "Führe aktualisiere-lieder.bat aus oder starte die Website mit node server.js.";
        return;
      }
    }
  }

  if (!Array.isArray(songs) || songs.some((song) => typeof song.title !== "string" || typeof song.text !== "string")) {
    loadingState.hidden = true;
    document.querySelector("#empty-title").textContent = "Liedkatalog hat ein ungültiges Format";
    document.querySelector("#empty-copy").textContent = "Führe aktualisiere-lieder.bat erneut aus.";
    return;
  }

  loadingState.hidden = true;
  if (!songs.length) return;

  emptyState.hidden = true;
  document.querySelector("#song-meta").textContent = `${songs.length} ${songs.length === 1 ? "Lied" : "Lieder"}`;
  songs.forEach(addSong);
}

renderSongs();
