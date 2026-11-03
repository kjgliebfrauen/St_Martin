const MAX_FILE_SIZE = 30 * 1024 * 1024;
let savedLibrary = null;
let selectedFile = null;

async function getLibrary() {
  const response = await fetch("/api/library");
  if (response.status === 404) return null;
  if (!response.ok) throw new Error("Die Liedliste konnte nicht geladen werden.");
  return response.json();
}

const form = document.querySelector("#admin-form");
const songRows = document.querySelector("#admin-song-list");
const saveMessage = document.querySelector("#save-message");
const fileInput = document.querySelector("#pdf-upload");

function createSongRow(song = {}) {
  const row = document.createElement("div");
  row.className = "song-fields-row";

  const title = document.createElement("input");
  title.type = "text";
  title.name = "song-title";
  title.placeholder = "z. B. Sankt Martin, Sankt Martin";
  title.value = song.title || "";
  title.setAttribute("aria-label", "Liedtitel");

  const page = document.createElement("input");
  page.type = "number";
  page.name = "song-page";
  page.min = "1";
  page.placeholder = "1";
  page.value = song.page || "";
  page.setAttribute("aria-label", "PDF-Seite");

  const remove = document.createElement("button");
  remove.className = "icon-button remove-song";
  remove.type = "button";
  remove.setAttribute("aria-label", "Lied entfernen");
  remove.title = "Lied entfernen";
  remove.innerHTML = '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M5 7h14M10 11v6m4-6v6M7 7l1 13h8l1-13M9 7V4h6v3"/></svg>';
  remove.addEventListener("click", () => row.remove());

  row.append(title, page, remove);
  songRows.append(row);
}

function collectSongs() {
  return [...songRows.querySelectorAll(".song-fields-row")]
    .map((row) => ({
      title: row.querySelector('[name="song-title"]').value.trim(),
      page: Number(row.querySelector('[name="song-page"]').value),
    }))
    .filter((song) => song.title && Number.isInteger(song.page) && song.page > 0);
}

fileInput.addEventListener("change", () => {
  const file = fileInput.files[0];
  if (!file) return;
  saveMessage.textContent = "";
  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    saveMessage.textContent = "Bitte wähle eine PDF-Datei aus.";
    fileInput.value = "";
    return;
  }
  if (file.size > MAX_FILE_SIZE) {
    saveMessage.textContent = "Die PDF-Datei darf höchstens 30 MB groß sein.";
    fileInput.value = "";
    return;
  }
  selectedFile = file;
  document.querySelector("#file-label").textContent = file.name;
  document.querySelector("#upload-zone").classList.add("has-file");
});

document.querySelector("#add-song").addEventListener("click", () => createSongRow());

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  saveMessage.textContent = "";

  if (!selectedFile && !savedLibrary) {
    saveMessage.textContent = "Bitte wähle zuerst eine PDF-Datei aus.";
    fileInput.focus();
    return;
  }

  try {
    const songs = collectSongs();
    if (selectedFile) {
      const uploadResponse = await fetch("/api/library/document", {
        method: "PUT",
        headers: {
          "Content-Type": "application/pdf",
          "X-File-Name": encodeURIComponent(selectedFile.name),
        },
        body: selectedFile,
      });
      if (!uploadResponse.ok) throw new Error("PDF-Upload fehlgeschlagen.");
    }
    const response = await fetch("/api/library", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileName: selectedFile?.name || savedLibrary.fileName, songs }),
    });
    if (!response.ok) throw new Error("Speichern fehlgeschlagen.");
    savedLibrary = await getLibrary();
    selectedFile = null;
    document.querySelector("#current-file").textContent = `Aktuell veröffentlicht: ${savedLibrary.fileName}`;
    document.querySelector("#current-file").hidden = false;
    saveMessage.textContent = "Liedzettel wurde gespeichert.";
  } catch (error) {
    if (error instanceof TypeError) {
      saveMessage.textContent = "Der Server ist nicht erreichbar. Starte die Website über den Projektserver.";
      return;
    }
    saveMessage.textContent = "Speichern fehlgeschlagen. Prüfe den verfügbaren Speicherplatz.";
  }
});

async function loadAdmin() {
  try {
    savedLibrary = await getLibrary();
    if (!savedLibrary) {
      createSongRow();
      return;
    }
    document.querySelector("#current-file").textContent = `Aktuell veröffentlicht: ${savedLibrary.fileName}`;
    document.querySelector("#current-file").hidden = false;
    document.querySelector("#file-label").textContent = "Neue PDF-Datei auswählen";
    savedLibrary.songs.forEach(createSongRow);
    if (!savedLibrary.songs.length) createSongRow();
  } catch {
    saveMessage.textContent = "Die Liedliste konnte nicht vom Server geladen werden.";
  }
}

loadAdmin();