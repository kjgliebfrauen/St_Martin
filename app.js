const songNav = document.querySelector("#song-nav");
const songList = document.querySelector("#song-list");
const songContent = document.querySelector("#song-content");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");

document.querySelector("#nav-toggle").addEventListener("click", () => {
  songNav.classList.add("is-collapsed");
  document.querySelector(".songbook").classList.add("is-nav-collapsed");
  document.querySelector("#nav-toggle").setAttribute("aria-expanded", "false");
  document.querySelector("#nav-toggle").hidden = true;
  document.querySelector("#nav-reopen").hidden = false;
});

document.querySelector("#nav-reopen").addEventListener("click", () => {
  songNav.classList.remove("is-collapsed");
  document.querySelector(".songbook").classList.remove("is-nav-collapsed");
  document.querySelector("#nav-toggle").setAttribute("aria-expanded", "true");
  document.querySelector("#nav-toggle").hidden = false;
  document.querySelector("#nav-reopen").hidden = true;
});

function addSong(song, index) {
  const songId = `song-${index + 1}`;
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "song-link";
  link.href = `#${songId}`;

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
