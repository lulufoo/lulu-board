/* vela-mcp/brand.js — same mark as drawer-app/brand, served from the MCP origin */

export const FAVICON_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect x="2" y="2" width="28" height="28" rx="8" fill="#db4c84"/>
  <path d="M8 8h7v9h9v7H8z" fill="#f5f5f7"/>
  <rect x="18" y="8" width="6" height="6" rx="1.5" fill="#ffd166"/>
</svg>
`;

export const FAVICON_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAtUlEQVR4nGNgGOmAkZCC2z4t/ym1RHVLDU57GGlpMTEOYaKX5bjMZaKX5bjMZ6Kn5djsYWIYYMBIyPdSK4vxGvAsvBfOVml9hCF/p1oOb6JkYqASwGY5PvFBEwVMow5gGC4OuIMjtePLBSDAQi0HEGPZoIwCFkoNIFRQoRdWgy4EmEYdwDDqgJHuAMaBaJIht5CZGAYYMBHbgaAmQLaHCZ8krS3H6gBaOgKbuYyENNG6bzjgAABi0Dyv9+kONgAAAABJRU5ErkJggg==";

function origin(env) {
  var fromEnv = String(env && env.PUBLIC_ORIGIN || "").replace(/\/$/, "");
  return fromEnv || "https://mcp.luluboard.app";
}

export function serverInfo(env) {
  var root = origin(env);
  return {
    name: "lulu-board",
    version: "1.0.0",
    websiteUrl: "https://luluboard.app",
    icons: [
      { src: root + "/favicon-32.png", mimeType: "image/png", sizes: ["32x32"] },
      { src: root + "/favicon.svg", mimeType: "image/svg+xml", sizes: ["any"] },
    ],
  };
}

export function isBrandPath(pathname) {
  return pathname === "/favicon.svg" || pathname === "/favicon-32.png";
}

export function brandResponse(pathname) {
  var headers = {
    "access-control-allow-origin": "*",
    "cache-control": "public, max-age=0, must-revalidate",
  };
  if (pathname === "/favicon.svg") {
    return new Response(FAVICON_SVG, {
      status: 200,
      headers: Object.assign({ "content-type": "image/svg+xml; charset=utf-8" }, headers),
    });
  }
  if (pathname === "/favicon-32.png") {
    var bytes = Uint8Array.from(atob(FAVICON_PNG_BASE64), function (c) { return c.charCodeAt(0); });
    return new Response(bytes, {
      status: 200,
      headers: Object.assign({ "content-type": "image/png" }, headers),
    });
  }
  return null;
}
