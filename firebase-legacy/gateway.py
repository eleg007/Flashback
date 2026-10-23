from fastapi import FastAPI, Request
from fastapi.responses import Response, FileResponse
from pathlib import Path
import httpx

STATIC_FILE = Path('/opt/emulation2k/public/index.html')
TARGETS = {
    'auth': 'http://127.0.0.1:9099',
    'firestore': 'http://127.0.0.1:8080',
    'storage': 'http://127.0.0.1:9199',
    'functions': 'http://127.0.0.1:5001',
}

def backend_for(path):
    if path.startswith('/identitytoolkit.googleapis.com') or path.startswith('/securetoken.googleapis.com'):
        return 'auth'
    if path.startswith('/v1/projects') or path.startswith('/$rpc') or path.startswith('/google.firestore'):
        return 'firestore'
    if path.startswith('/v0/b'):
        return 'storage'
    if path.startswith('/demo-emulation2k/'):
        return 'functions'
    return None

client = httpx.AsyncClient(timeout=None)
app = FastAPI()

@app.api_route('/', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
async def root(request: Request):
    return FileResponse(STATIC_FILE)

@app.api_route('/{full_path:path}', methods=['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'])
async def catch_all(full_path: str, request: Request):
    full = '/' + full_path
    target = backend_for(full)
    if target is None:
        return FileResponse(STATIC_FILE)
    base = TARGETS[target]
    url = base + full
    if request.url.query:
        url += '?' + request.url.query
    forwarded = {}
    for k, v in request.headers.items():
        if k.lower() in ('host', 'content-length', 'connection'):
            continue
        forwarded[k] = v
    body = await request.body()
    try:
        r = await client.request(request.method, url, headers=forwarded, content=body)
    except Exception as exc:
        return Response(content=f'Gateway proxy error: {exc}'.encode(), status_code=502)
    headers = dict(r.headers)
    # Rewrite emulator storage URLs so remote upload/fetch flow stays on the public gateway
    origin = f"{request.url.scheme}://{request.url.netloc}"
    for key in ('x-goog-upload-url', 'X-Goog-Upload-URL'):
        val = headers.get(key) or headers.get(key.lower())
        if val:
            headers[key.lower()] = val.replace('http://127.0.0.1:9199', origin).replace('http://localhost:9199', origin)
    return Response(content=r.content, status_code=r.status_code, headers=headers)
