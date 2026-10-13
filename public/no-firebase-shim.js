// No-Firebase client adapter for Flashback FastAPI backend
const __AuthState = {
  user: null,
  listeners: [],
  initDone: false
};
function __emitAuth() {
  for (const cb of __AuthState.listeners) {
    try { cb(__AuthState.user); } catch (e) { console.error('auth cb', e); }
  }
}
async function __refreshAuth() {
  try {
    const r = await fetch('/api/auth/session', { credentials: 'include' });
    if (r.ok) __AuthState.user = await r.json();
    else __AuthState.user = null;
  } catch (e) {
    __AuthState.user = null;
  }
  if (!__AuthState.initDone) { __AuthState.initDone = true; }
  __emitAuth();
}

const auth = {
  get currentUser() { return __AuthState.user; },
  Persistence: { LOCAL: 'LOCAL', SESSION: 'SESSION' },
  onAuthStateChanged(cb) {
    __AuthState.listeners.push(cb);
    if (__AuthState.initDone) cb(__AuthState.user);
    else setTimeout(__refreshAuth, 0);
  },
  setPersistence() { return Promise.resolve(); },
  async createUserWithEmailAndPassword(email, password) {
    const username = (email || '').split('@')[0] || 'user';
    const r = await fetch('/api/auth/register', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, username }) });
    if (!r.ok) throw { code: 'auth/registration-failed', message: await r.text() };
    await __refreshAuth();
    let user = __AuthState.user;
    if (!user) user = { uid: 'session', username, email, status:'approved', role:'admin' };
    return { user };
  },
  async signInWithEmailAndPassword(email, password) {
    const r = await fetch('/api/auth/login', { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ email, password, remember: true }) });
    if (!r.ok) throw { code: r.status === 401 ? 'auth/invalid-credential' : 'auth/network-request-failed', message: await r.text() };
    await __refreshAuth();
    return { user: __AuthState.user };
  },
  async signOut() {
    await fetch('/api/auth/logout', { method:'POST', credentials:'include' });
    __AuthState.user = null;
    __emitAuth();
  }
};

const AuthPersistence = { LOCAL: 'LOCAL', SESSION: 'SESSION' };
const firebase = {
  initializeApp() {},
  auth() { return auth; },
  firestore() { return db; },
  storage() { return storage; },
  functions() { return functions; }
};
firebase.auth.Auth = { Persistence: AuthPersistence };

const FieldValue = {
  serverTimestamp: () => new Date().toISOString(),
  increment: (n) => ({ __inc: n || 1 })
};

const db = {
  collection(name) {
    return new CollectionRef(name);
  }
};

function CollectionRef(name) {
  this.name = name;
  this._sort = null;
  this._limit = null;
}

CollectionRef.prototype.get = async function() {
  if (this.name === 'users' && this._sort && this._sort.field === 'createdAt' && this._sort.dir === 'desc') {
    const r = await fetch('/api/admin/users', { credentials:'include' });
    if (!r.ok) return { empty: true, docs: [] };
    const list = await r.json();
    const docs = (list || []).map(u => ({ id: u.uid, data: () => ({
      uid: u.uid, username: u.username, email: u.email, status: u.status, role: u.role,
      cloudBanned: !!u.cloudBanned, createdAt: u.createdAt
    })}));
    return { empty: docs.length === 0, docs };
  }
  if (this.name === 'users') {
    const r = await fetch('/api/users/bootstrap', { credentials:'include' });
    const j = r.ok ? await r.json() : { empty: true };
    return { empty: !!j.empty, docs: [] };
  }
  if (this.name === 'cloudGames') {
    const r = await fetch('/api/cloud-games', { credentials:'include' });
    const list = r.ok ? await r.json() : [];
    const docs = (list || []).map(g => ({ id: g.id, data: () => ({
      id: g.id, name: g.name, displayName: g.displayName, size: g.size, storageUrl: g.storageUrl,
      storagePath: g.storagePath, uploadedBy: g.uploadedBy, uploadedByName: g.uploadedByName,
      uploadedAt: g.uploadedAt, playCount: g.playCount
    })}));
    return { empty: docs.length === 0, docs };
  }
  return { empty: true, docs: [] };
};

CollectionRef.prototype.doc = function(id) {
  const col = this.name;
  return {
    get: async () => {
      if (col === 'users') {
        if (auth.currentUser && id === auth.currentUser.uid) {
          const r = await fetch('/api/auth/session', { credentials: 'include' });
          if (!r.ok) return { exists: false, data: () => ({}), id };
          const u = await r.json();
          return { exists: true, id: u.uid, data: () => ({ username: u.username, email: u.email, status: u.status, role: u.role, cloudBanned: u.cloud_banned, createdAt: u.createdAt || u.created_at }) };
        }
        return { exists: false, data: () => ({}), id };
      }
      if (col === 'cloudGames') {
        const r = await fetch('/api/cloud-games', { credentials: 'include' });
        const list = r.ok ? await r.json() : [];
        const g = list.find(x => x.id === id);
        return { exists: !!g, data: () => g || {}, id };
      }
      return { exists: false, data: () => ({}), id };
    },
    set: async (data) => {
      if (col === 'users') {
        await fetch('/api/users/me', { method:'PUT', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ username: data.username, email: data.email }) });
      }
      return { ok: true };
    },
    update: async (data) => {
      if (col === 'users') {
        const payload = {};
        if (data.username !== undefined) payload.username = data.username;
        if (data.email !== undefined) payload.email = data.email;
        if (data.status !== undefined) payload.status = data.status;
        if (data.role !== undefined) payload.role = data.role;
        if (data.cloudBanned !== undefined) payload.cloud_banned = data.cloudBanned;
        await fetch(`/api/admin/users/${id}/update`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) });
        if (data.cloudBanned !== undefined) {
          await fetch(`/api/admin/users/${id}/cloud-ban`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ banned: !!data.cloudBanned }) });
        }
        return { ok: true };
      }
      if (col === 'cloudGames') {
        if (data && Object.prototype.hasOwnProperty.call(data, 'playCount') && data.playCount && data.playCount.__inc) {
          await fetch(`/api/cloud-games/${id}/play`, { method:'POST', credentials:'include' });
        }
      }
      return { ok: true };
    },
    delete: async () => {
      if (col === 'cloudGames') {
        await fetch(`/api/cloud-games/${id}`, { method:'DELETE', credentials:'include' });
      }
      if (col === 'users') {
        await fetch(`/api/admin/users/${id}/delete`, { method:'POST', credentials:'include' });
      }
      return { ok: true };
    },
    onSnapshot(cb) {
      (async () => {
        const snap = await this.get();
        cb(snap);
      })();
      return () => {};
    }
  };
};

CollectionRef.prototype.orderBy = function(field, dir) {
  this._sort = { field, dir: dir || 'asc' };
  return this;
};
CollectionRef.prototype.limit = function(n) {
  this._limit = n;
  return this;
};

const storage = {
  ref(path) {
    return {
      fullPath: path,
      put(file) {
        const task = {
          snapshot: {
            ref: {
              fullPath: path,
              getDownloadURL: () => Promise.resolve(null)
            },
            bytesTransferred: 0,
            totalBytes: file.size
          },
          state: 'running'
        };
        let onProgress = null;
        let onError = null;
        let onComplete = null;
        task.on = function(eventName, progressCb, errorCb, completeCb) {
          onProgress = progressCb || onProgress;
          onError = errorCb || onError;
          onComplete = completeCb || onComplete;
        };
        // Start upload after callbacks registered.
        setTimeout(async () => {
          try {
            if (onProgress) onProgress({ bytesTransferred: 0, totalBytes: file.size });
            const fd = new FormData();
            fd.append('file', file, file.name);
            const r = await fetch('/api/upload', { method:'POST', credentials:'include', body: fd });
            if (!r.ok) throw new Error(await r.text());
            const j = await r.json();
            task.snapshot.ref.getDownloadURL = () => Promise.resolve(j.storageUrl);
            task.snapshot.bytesTransferred = file.size;
            if (onProgress) onProgress({ bytesTransferred: file.size, totalBytes: file.size });
            task.state = 'success';
            if (onComplete) onComplete();
          } catch (e) {
            console.error('upload failed', e);
            task.state = 'error';
            if (onError) onError(e);
          }
        }, 10);
        return task;
      },
      delete() { return Promise.resolve(); }
    };
  }
};

const functions = {
  httpsCallable(name) {
    return async (data) => {
      if (name === 'adminUpdateEmail') {
        if (data && data.uid && data.newEmail) {
          await fetch(`/api/admin/users/${data.uid}/update`, { method:'POST', credentials:'include', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ newEmail: data.newEmail }) });
        }
      }
      if (name === 'adminDeleteUser') {
        if (data && data.uid) {
          await fetch(`/api/admin/users/${data.uid}/delete`, { method:'POST', credentials:'include' });
        }
      }
      return { data: { success: true } };
    };
  },
  useEmulator() {},
  httpsCallable() { return async () => ({ data: { success: true } }); }
};

// Repair firebase object reference
firebase.storage = () => storage;
firebase.firestore = () => db;
firebase.auth = () => auth;
firebase.functions = () => functions;

window.firebase = firebase;

// Provide a no-op FieldValue on firebase namespace expected by code
window.firebase.firestore = window.firebase.firestore || (() => db);
window.firebase.firestore.FieldValue = FieldValue;

// Alias auth variable expected by HTML
window.auth = auth;
window.db = db;
window.storage = storage;
window.functions = functions;

// Bootstrap URL
setTimeout(__refreshAuth, 50);

// hide Google login buttons (not supported without Firebase OAuth)
document.addEventListener('DOMContentLoaded', () => {
  for (const b of document.querySelectorAll('.btn-google')) b.style.display = 'none';
});

function handleGoogle() { alert("Google login is disabled in the no-Firebase version."); return false; }
window.handleGoogle = handleGoogle;
