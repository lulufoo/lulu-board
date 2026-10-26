/* Hash persist: #z: zlib envelope. Browser uses CompressionStream; Node tests use zlib. */
function nodeZlib() {
  try {
    return Function("return typeof require === 'function' ? require('zlib') : null")();
  } catch (_e) {
    return null;
  }
}

export function diagramPersistMode() {
  var doc = typeof document !== "undefined" ? document.documentElement : null;
  var forced = doc && doc.getAttribute("data-persist");
  if (forced === "hash" || forced === "local") return forced;
  return "hash";
}

function bytesToBase64Url(bytes) {
  var bin = "";
  for (var i = 0; i < bytes.length; i += 1) bin += String.fromCharCode(bytes[i]);
  var b64 = typeof btoa === "function" ? btoa(bin) : Buffer.from(bytes).toString("base64");
  return b64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64UrlToBytes(token) {
  var b64 = String(token || "").replace(/-/g, "+").replace(/_/g, "/");
  var pad = b64.length % 4;
  if (pad) b64 += "====".slice(pad);
  if (typeof atob === "function") {
    var bin = atob(b64);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
    return out;
  }
  return new Uint8Array(Buffer.from(b64, "base64"));
}

async function compressZlib(bytes) {
  if (typeof CompressionStream === "function") {
    var stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  var zlib = nodeZlib();
  if (!zlib) throw new Error("zlib unavailable");
  return new Uint8Array(zlib.deflateSync(Buffer.from(bytes)));
}

async function decompressZlib(bytes) {
  if (typeof DecompressionStream === "function") {
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate"));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  var zlib = nodeZlib();
  if (!zlib) throw new Error("zlib unavailable");
  return new Uint8Array(zlib.inflateSync(Buffer.from(bytes)));
}

export async function encodeDiagramHash(text, version) {
  var payload = JSON.stringify({
    bmd: String(text || ""),
    version: Number(version) > 0 ? Number(version) : 1,
  });
  var input = new TextEncoder().encode(payload);
  return "z:" + bytesToBase64Url(await compressZlib(input));
}

export async function decodeDiagramHash(raw) {
  var token = String(raw || "").replace(/^#/, "");
  if (token.indexOf("z:") !== 0) throw new Error("invalid board hash");
  var bytes = base64UrlToBytes(token.slice(2));
  if (!bytes.length) throw new Error("invalid board hash");
  var out = await decompressZlib(bytes);
  var payload = JSON.parse(new TextDecoder().decode(out));
  if (!payload || typeof payload !== "object" || Array.isArray(payload) || payload.bmd == null) {
    throw new Error("invalid board hash");
  }
  var ver = Number(payload.version);
  return {
    bmd: String(payload.bmd),
    version: Number.isFinite(ver) && ver > 0 ? ver : 1,
  };
}

const DrawerHashPersist = {
  diagramPersistMode: diagramPersistMode,
  encodeDiagramHash: encodeDiagramHash,
  decodeDiagramHash: decodeDiagramHash,
};

export default DrawerHashPersist;
