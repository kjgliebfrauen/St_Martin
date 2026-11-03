const songNav = document.querySelector("#song-nav");
const songList = document.querySelector("#song-list");
const pdfFrame = document.querySelector("#pdf-frame");
const emptyState = document.querySelector("#empty-state");
const loadingState = document.querySelector("#loading-state");
const downloadLink = document.querySelector("#download-link");
let documentUrl = null;

document.querySelector("#nav-toggle").addEventListener("click", () => {
  songNav.classList.add("is-collapsed");
  document.querySelector("#nav-toggle").setAttribute("aria-expanded", "false");
});

document.querySelector("#nav-reopen").addEventListener("click", () => {
  songNav.classList.remove("is-collapsed");
  document.querySelector("#nav-toggle").setAttribute("aria-expanded", "true");
});

function addSongLink(song, index) {
  const item = document.createElement("li");
  const link = document.createElement("a");
  link.className = "song-link";
  link.href = `#page=${song.page}`;
  link.innerHTML = `<span class="song-number">${String(index + 1).padStart(2, "0")}</span>`;
  const title = document.createElement("span");
  title.className = "song-link-title";
  title.textContent = song.title;
  const page = document.createElement("span");
  page.className = "song-page-number";
  page.textContent = String(song.page);
  link.append(title, page);
  link.addEventListener("click", (event) => {
    event.preventDefault();
    if (documentUrl) pdfFrame.src = `${documentUrl}#page=${song.page}`;
    history.replaceState(null, "", `#page=${song.page}`);
  });
  item.append(link);
  songList.append(item);
}

async function renderLibrary() {
  try {
    const response = await fetch("/api/library");
    if (response.status === 404) return;
    if (!response.ok) throw new Error("Die Liedliste konnte nicht geladen werden.");
    const library = await response.json();
    if (!library.pdfUrl) return;

    documentUrl = library.pdfUrl;
    pdfFrame.src = `${documentUrl}${window.location.hash || ""}`;
    pdfFrame.hidden = false;
    emptyState.hidden = true;
    loadingState.hidden = true;
    document.querySelector("#pdf-name").textContent = library.fileName || "Liedzettel.pdf";
    document.querySelector("#pdf-meta").textContent = `${library.songs.length} ${library.songs.length === 1 ? "Lied" : "Lieder"} · PDF-Dokument`;
    downloadLink.href = documentUrl;
    downloadLink.download = library.fileName || "Liedzettel.pdf";
    downloadLink.hidden = false;
    songList.replaceChildren();

    if (!library.songs.length) {
      document.querySelector("#nav-caption").textContent = "Noch keine Lieder eingetragen";
    } else {
      library.songs.forEach(addSongLink);
    }
  } catch {
    loadingState.hidden = true;
    document.querySelector("#empty-state h2").textContent = "Liedzettel konnte nicht geladen werden";
    document.querySelector("#empty-state p").textContent = "Bitte lade die Seite erneut oder prüfe die Website-Verbindung.";
  }
}

renderLibrary();