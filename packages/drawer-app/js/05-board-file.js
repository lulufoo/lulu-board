/* drawer-app/05-board-file.js — open a .bmd into the hash URL */
function boardTitleFromBody(body) {
  var hit = /^\s*board\s+"([^"]*)"/.exec(String(body || ""));
  return hit ? hit[1] : "";
}

function pickBoardSourceFile() {
  return new Promise(function (resolve, reject) {
    if (typeof window !== "undefined" && typeof window.showOpenFilePicker === "function") {
      window.showOpenFilePicker({
        types: [{ description: "Board file", accept: { "text/plain": [".bmd"] } }],
        multiple: false,
      }).then(function (handles) {
        if (!handles || !handles[0]) return resolve(null);
        return handles[0].getFile().then(function (file) {
          return file.text().then(resolve, reject);
        });
      }).catch(function (error) {
        if (error && error.name === "AbortError") resolve(null);
        else reject(error);
      });
      return;
    }
    var input = document.createElement("input");
    input.type = "file";
    input.accept = ".bmd,text/plain";
    input.hidden = true;
    var finish = function (text) {
      input.remove();
      resolve(text);
    };
    input.addEventListener("change", function () {
      var file = input.files && input.files[0];
      if (!file) return finish(null);
      file.text().then(finish, function (error) {
        input.remove();
        reject(error);
      });
    });
    input.addEventListener("cancel", function () { finish(null); });
    document.body.appendChild(input);
    input.click();
  });
}

async function openBoardFile() {
  if (typeof boardPersistMode === "function" && boardPersistMode() !== "hash") return;
  var button = document.getElementById("btnHistoryOpenFile");
  if (button) button.disabled = true;
  try {
    var text = await pickBoardSourceFile();
    if (text == null) return;
    text = typeof stripDocumentMeta === "function" ? stripDocumentMeta(text) : String(text);
    if (!text.trim()) throw new Error("Board file is empty");
    if (!boardSourceEl) throw new Error("Board source is missing");
    boardSourceEl.value = text;
    boardDirty = false;
    boardLocalRev = 1;
    boardServerRev = 0;
    if (typeof applyBoardLiveMeta === "function") {
      applyBoardLiveMeta({
        id: "",
        version: 1,
        title: boardTitleFromBody(text),
      });
    }
    if (typeof updateBoardChars === "function") updateBoardChars();
    if (typeof saveBoardToHash === "function") await saveBoardToHash({ bump: false });
    if (typeof renderBoard === "function") renderBoard({ fit: true });
    setStatus("Opened file");
    showCopyTip("Opened file");
  } catch (error) {
    console.error(error);
    setStatus((error && error.message) || "Open file failed", true);
    showCopyTip("Open file failed");
  } finally {
    if (button) button.disabled = false;
  }
}
