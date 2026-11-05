const MAX_FILE_SIZE = 30 * 1024 * 1024;
const PDFJS_VERSION = "3.11.174";
const fileInput = document.querySelector("#pdf-upload");
const processButton = document.querySelector("#process-pdf");
const saveMessage = document.querySelector("#save-message");
const songResults = document.querySelector("#song-results");
let selectedFile = null;
let extractedSongs = [];

fileInput.addEventListener("change", () => {
  selectedFile = fileInput.files[0] || null;
  extractedSongs = [];
  songResults.replaceChildren();
  document.querySelector("#extracted-section").hidden = true;
  processButton.disabled = !selectedFile;
  saveMessage.textContent = "";
  document.querySelector("#upload-zone").classList.toggle("has-file", Boolean(selectedFile));
  document.querySelector("#file-label").textContent = selectedFile?.name || "PDF-Datei auswählen";

  if (!selectedFile) return;
  if (selectedFile.type !== "application/pdf" && !selectedFile.name.toLowerCase().endsWith(".pdf")) {
    showError("Bitte wähle eine PDF-Datei aus.");
    resetFile();
  } else if (selectedFile.size > MAX_FILE_SIZE) {
    showError("Die PDF-Datei darf höchstens 30 MB groß sein.");
    resetFile();
  }
});

function showError(message) {
  saveMessage.textContent = message;
  saveMessage.classList.add("is-error");
}

function resetFile() {
  selectedFile = null;
  fileInput.value = "";
  processButton.disabled = true;
  document.querySelector("#upload-zone").classList.remove("has-file");
  document.querySelector("#file-label").textContent = "PDF-Datei auswählen";
}

function getTextSize(item) {
  return Math.abs(item.transform?.[3] || item.height || 0);
}

function getFontName(item, styles) {
  return `${item.fontName || ""} ${styles[item.fontName]?.fontFamily || ""}`;
}

function isBold(item, styles) {
  return /bold|black|heavy|demi|semibold/i.test(getFontName(item, styles));
}

function getPageLines(textContent) {
  const styles = textContent.styles || {};
  const items = textContent.items
    .filter((item) => typeof item.str === "string" && item.str.trim())
    .map((item) => ({
      item,
      x: item.transform?.[4] || 0,
      y: item.transform?.[5] || 0,
      size: getTextSize(item),
      bold: isBold(item, styles),
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);
  const lines = [];

  for (const positioned of items) {
    let line = lines.find((candidate) => Math.abs(candidate.y - positioned.y) <= 2.5);
    if (!line) {
      line = { y: positioned.y, items: [] };
      lines.push(line);
    }
    line.items.push(positioned);
  }

  return lines
    .map((line) => {
      line.items.sort((a, b) => a.x - b.x);
      let text = "";
      let previousRight = null;
      let sizeTotal = 0;
      let charCount = 0;
      let boldChars = 0;
      for (const part of line.items) {
        const value = part.item.str;
        if (previousRight !== null && part.x - previousRight > Math.max(1, part.size * 0.15)) text += " ";
        text += value;
        previousRight = part.x + (part.item.width || 0);
        sizeTotal += part.size * value.length;
        charCount += value.length;
        if (part.bold) boldChars += value.length;
      }
      return {
        text: text.replace(/[ \t]+/g, " ").trim(),
        size: charCount ? sizeTotal / charCount : 0,
        bold: charCount > 0 && boldChars / charCount >= 0.5,
        y: line.y,
      };
    })
    .filter((line) => line.text)
    .sort((a, b) => b.y - a.y);
}

async function extractSongs(file) {
  if (!window.pdfjsLib) throw new Error("Die PDF-Erkennung konnte nicht geladen werden. Prüfe deine Internetverbindung und lade die Seite erneut.");
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${PDFJS_VERSION}/pdf.worker.min.js`;
  const document = await window.pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise;
  const lines = [];
  for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    lines.push(...getPageLines(await page.getTextContent()), { text: "", size: 0, bold: false });
  }

  const sizes = lines.filter((line) => line.text && line.size > 0).map((line) => line.size).sort((a, b) => a - b);
  const medianSize = sizes.length ? sizes[Math.floor(sizes.length / 2)] : 0;
  const headingSize = Math.max(medianSize * 1.16, medianSize + 1);
  function splitSongs(isHeading) {
    const songs = [];
    let currentSong = null;
    for (const line of lines) {
      if (!line.text) continue;
      if (isHeading(line)) {
        currentSong = { title: line.text, lines: [] };
        songs.push(currentSong);
      } else if (currentSong) {
        currentSong.lines.push(line.text);
      }
    }
    return songs.map((song) => ({ title: song.title, text: song.lines.join("\n").trim() })).filter((song) => song.text);
  }

  const isLargeHeading = (line) => line.size >= headingSize && line.text.length <= 120;
  const boldSongs = splitSongs((line) => line.bold && isLargeHeading(line));
  return boldSongs.length ? boldSongs : splitSongs(isLargeHeading);
}

function safeFilename(title, index) {
  const name = title
    .normalize("NFC")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/[. ]+$/g, "")
    .trim();
  return `${String(index + 1).padStart(2, "0")} - ${name || "lied"}.txt`;
}

function downloadFile(fileName, contents, type) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function addSongDownload(song, index) {
  const item = document.createElement("li");
  item.className = "extracted-song";
  const description = document.createElement("span");
  description.textContent = `${String(index + 1).padStart(2, "0")} · ${song.title}`;
  const download = document.createElement("button");
  download.className = "button button-secondary";
  download.type = "button";
  download.textContent = "TXT herunterladen";
  download.addEventListener("click", () => {
    const contents = `${song.title}\n\n${song.text}\n`;
    downloadFile(safeFilename(song.title, index), contents, "text/plain;charset=utf-8");
  });
  item.append(description, download);
  songResults.append(item);
}

processButton.addEventListener("click", async () => {
  if (!selectedFile) return;
  processButton.disabled = true;
  processButton.textContent = "PDF wird ausgewertet …";
  saveMessage.classList.remove("is-error");
  saveMessage.textContent = "Die Lieder werden erkannt.";
  extractedSongs = [];
  songResults.replaceChildren();

  try {
    const songs = await extractSongs(selectedFile);
    if (!songs.length) {
      throw new Error("Es wurden keine passenden Überschriften erkannt. Benötigt werden echte PDF-Texte mit deutlich größerer, fetter Liedüberschrift; gescannte PDFs werden nicht unterstützt.");
    }
    extractedSongs = songs;
    songs.forEach(addSongDownload);
    document.querySelector("#extracted-section").hidden = false;
    saveMessage.textContent = `${songs.length} ${songs.length === 1 ? "Lied wurde" : "Lieder wurden"} erkannt.`;
  } catch (error) {
    showError(error instanceof Error ? error.message : "Die PDF-Datei konnte nicht ausgewertet werden.");
  } finally {
    processButton.disabled = !selectedFile;
    processButton.textContent = "Lieder erkennen";
  }
});
