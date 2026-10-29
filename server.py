import http.server
import json
import mimetypes
import os
import socketserver
import urllib.parse

PORT = 8080
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_DIR = os.path.join(BASE_DIR, "project")
ASSETS_DIR = os.path.join(BASE_DIR, "assets")

BLOB_MAP = {
    "2dfe8bf3b1450e792096c28c7430a508": "chan-dung-anh-goc.jpg",
    "8b3ccd25421622e7159367cc161d69b8": "chan-dung-tach-nen.webp",
    "618c1af3907225f2605c3d89c62bd96c": "tp02-poster-dien-vua-du.webp",
    "80535c369d55d41873b43749680ba93e": "tp03-minh-hoa-long-bien.webp",
    "b1114a6e341fee3d913c0dbc719aaae2": "tp04-nhan-dien-gac-xep.webp",
    "950d916a2103e84df23e30b44bf91101": "tp05-3d-can-bang-gia.webp",
    "e6dda941d38e6e2b7ebe29d21f804cf2": "tp01-giao-dien-di-lac.webp",
    "5c7bd031a4aa5734c27fc7388907c0af": "tp06-tao-sinh-dem-pho.webp",
    "ba35d4e2d42f76a23e2811874855e02d": "trangchu-manh-xe-poster.webp",
    "a423d9596a472000b5c35702848b8e4b": "trangchu-manh-xe-dem-pho.webp",
    "e360ecb345186299a175c9ecb988d921": "trangchu-manh-xe-gac-xep.webp",
    "ab3f89d19f728d4264d50cef9a7152af": "chandung-nhan-dan.webp",
    "bd4dc96fe2e52467804fb63ec4cbff26": "chandung-manh-thua.webp",
    "e2a2c579e9bc86263bfa1a879609cd4d": "chandung-muc-loang.webp",
    "687277fe3aa253132c17187592f0686c": "chandung-riso-xanh.webp",
    "768e50fd17905c1ce8a967a20115cd3d": "chandung-riso-hong.webp",
    "fb94455f4fcb6f1e0f6bedb931fe6aeb": "three-r180.global.js",
    "f03a6d827e15052a36e5b98ed81f7e79": "gsap-3.15.0-st.js",
    "a65c487e20bfdc38d2f424d079be1a81": "lenis-1.3.27.min.js",
}

TRANSPARENT_GIF = (
    b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!"
    b"\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00"
    b"\x00\x02\x02D\x01\x00;"
)

CANVAS_HTML = """<!doctype html>
<html lang="vi">
<head>
<meta charset="utf-8">
<title>Canvas — Web cá nhân Nguyễn Tuấn Anh</title>
<link rel="icon" type="image/png" href="/favicon.png">
<link rel="shortcut icon" href="/favicon.ico">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@400;700;800&family=Space+Mono:wght@400;700&display=swap">
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: #0f0f14; color: #f2f1ec; font-family: 'Bricolage Grotesque', sans-serif; }
  header { padding: 24px 40px; border-bottom: 2px solid #2b2ef0; display: flex; justify-content: space-between; align-items: center; background: #14141d; position: sticky; top: 0; z-index: 10; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(420px, 1fr)); gap: 28px; padding: 40px; max-width: 1800px; margin: 0 auto; }
  .board { border: 2px solid #f2f1ec; background: #1a1a24; box-shadow: 8px 8px 0 #2b2ef0; display: flex; flex-direction: column; overflow: hidden; }
  .board-head { padding: 12px 16px; background: #0f0f14; border-bottom: 2px solid #f2f1ec; display: flex; justify-content: space-between; align-items: center; font-family: 'Space Mono', monospace; font-size: 13px; }
  .board-head a { color: #d8ff3c; text-decoration: none; font-weight: 700; }
  .frame-wrap { position: relative; width: 100%; aspect-ratio: 16 / 10; overflow: hidden; background: #f2f1ec; }
  iframe { width: 1440px; height: 900px; border: 0; transform: scale(0.3); transform-origin: 0 0; pointer-events: none; }
</style>
</head>
<body>
<header>
  <div>
    <h1 style="margin:0;font-size:24px;">Web cá nhân — Nguyễn Tuấn Anh</h1>
    <p style="margin:4px 0 0;font-family:'Space Mono',monospace;font-size:12px;color:#a3a3ad;">Bấm vào tên từng trang để mở toàn màn hình và tương tác trực tiếp</p>
  </div>
  <a href="/Main.dc.html" style="padding:10px 20px;background:#d8ff3c;color:#0f0f14;font-family:'Space Mono',monospace;font-weight:700;text-decoration:none;border-radius:999px;">Mở Trang Chủ</a>
</header>
<div class="grid" id="boards"></div>
<script>
fetch('/canvas.json').then(r => r.json()).then(data => {
  const container = document.getElementById('boards');
  (data.order || Object.keys(data.boards)).forEach(file => {
    const b = data.boards[file];
    if (!b) return;
    const card = document.createElement('div');
    card.className = 'board';
    card.innerHTML = `
      <div class="board-head">
        <span><b>${b.title}</b></span>
        <a href="/${file}">Mở trang</a>
      </div>
      <a href="/${file}" class="frame-wrap">
        <iframe src="/${file}" loading="lazy"></iframe>
      </a>
    `;
    container.appendChild(card);
  });
});
</script>
</body>
</html>
"""


class DCHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, format, *args):
        pass

    def send_file_bytes(self, filepath, content_type=None):
        if not os.path.isfile(filepath):
            self.send_error(404, "File not found")
            return
        if not content_type:
            content_type, _ = mimetypes.guess_type(filepath)
            if filepath.endswith(".webp"):
                content_type = "image/webp"
            elif filepath.endswith(".html"):
                content_type = "text/html; charset=utf-8"
            elif filepath.endswith(".js"):
                content_type = "application/javascript; charset=utf-8"
            elif filepath.endswith(".json"):
                content_type = "application/json; charset=utf-8"
        with open(filepath, "rb") as f:
            data = f.read()
        self.send_response(200)
        self.send_header("Content-Type", content_type or "application/octet-stream")
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        raw_path = urllib.parse.unquote(parsed.path)

        if "{{" in raw_path or "}}" in raw_path:
            self.send_response(200)
            self.send_header("Content-Type", "image/gif")
            self.send_header("Content-Length", str(len(TRANSPARENT_GIF)))
            self.end_headers()
            self.wfile.write(TRANSPARENT_GIF)
            return

        if raw_path in ("/", "/index.html"):
            self.send_response(302)
            self.send_header("Location", "/Main.dc.html")
            self.end_headers()
            return

        if raw_path == "/canvas":
            canvas_file = os.path.join(PROJECT_DIR, "canvas.html")
            if os.path.isfile(canvas_file):
                self.send_file_bytes(canvas_file, "text/html; charset=utf-8")
                return
            data = CANVAS_HTML.encode("utf-8")
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)
            return

        if raw_path.startswith("/_blob/"):
            blob_id = raw_path.split("/_blob/", 1)[1].strip("/")
            asset_name = BLOB_MAP.get(blob_id)
            if asset_name:
                self.send_file_bytes(os.path.join(ASSETS_DIR, asset_name))
                return
            self.send_error(404, f"Unknown blob: {blob_id}")
            return

        if raw_path.startswith("/assets/"):
            rel = raw_path.lstrip("/")
            self.send_file_bytes(os.path.join(BASE_DIR, rel))
            return

        clean_rel = raw_path.lstrip("/")
        if clean_rel.startswith("project/"):
            clean_rel = clean_rel[len("project/"):]
        candidate = os.path.join(PROJECT_DIR, clean_rel)
        if os.path.isfile(candidate):
            self.send_file_bytes(candidate)
            return

        self.send_error(404, f"Not found: {raw_path}")


class ThreadedHTTPServer(socketserver.ThreadingMixIn, http.server.HTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    with ThreadedHTTPServer(("0.0.0.0", PORT), DCHandler) as httpd:
        print(f"Server running at http://localhost:{PORT}/Main.dc.html (Canvas: http://localhost:{PORT}/canvas)", flush=True)
        httpd.serve_forever()
