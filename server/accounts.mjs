// Personal accounts: e-mail and password (scrypt), opaque session tokens stored only as SHA-256 hashes.
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const SESSION_DAYS = 30;
const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
const hashToken = (token) => createHash('sha256').update(token).digest('hex');

export function createAccounts(dataDir) {
  const file = join(dataDir, 'accounts.json');
  let state = { users: {}, sessions: {} };
  let writing = Promise.resolve();
  const loaded = readFile(file, 'utf8').then((raw) => { const saved = JSON.parse(raw); if (saved && typeof saved === 'object') state = { users: saved.users ?? {}, sessions: saved.sessions ?? {} }; }).catch(() => {});
  const persist = () => {
    const snapshot = JSON.stringify(state);
    writing = writing.then(async () => {
      await mkdir(dataDir, { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await writeFile(temporary, snapshot, { mode: 0o600 });
      await rename(temporary, file);
    }).catch((cause) => console.error(`Could not save accounts: ${cause.message}`));
  };
  const publicUser = (user) => ({ id: user.id, email: user.email, name: user.name });
  async function issue(user) {
    const token = randomBytes(32).toString('hex');
    const now = Date.now();
    for (const [key, session] of Object.entries(state.sessions)) if (session.expires < now) delete state.sessions[key];
    state.sessions[hashToken(token)] = { userId: user.id, expires: now + SESSION_DAYS * 86_400_000 };
    persist();
    return { token, user: publicUser(user) };
  }
  return {
    loaded,
    get writing() { return writing; },
    async register({ email, password, name }) {
      await loaded;
      const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
      if (!EMAIL.test(address)) return { error: 'invalid_email' };
      if (typeof password !== 'string' || password.length < 8 || password.length > 200) return { error: 'weak_password' };
      const displayName = typeof name === 'string' ? name.replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40) : '';
      if (!displayName) return { error: 'invalid_name' };
      if (Object.values(state.users).some((user) => user.email === address)) return { error: 'email_taken' };
      const salt = randomBytes(16).toString('hex');
      const hash = (await scrypt(password, salt, 64)).toString('hex');
      const user = { id: randomUUID(), email: address, name: displayName, salt, hash, createdAt: new Date().toISOString() };
      state.users[user.id] = user;
      return issue(user);
    },
    async login({ email, password }) {
      await loaded;
      const address = typeof email === 'string' ? email.trim().toLowerCase() : '';
      const user = Object.values(state.users).find((candidate) => candidate.email === address);
      // Always run scrypt so a missing account takes as long as a wrong password.
      const derived = await scrypt(typeof password === 'string' ? password : '', user?.salt ?? 'no-account-salt', 64);
      if (!user || !timingSafeEqual(derived, Buffer.from(user.hash, 'hex'))) return { error: 'invalid_credentials' };
      return issue(user);
    },
    async session(token) {
      await loaded;
      if (typeof token !== 'string' || token.length !== 64) return null;
      const session = state.sessions[hashToken(token)];
      if (!session || session.expires < Date.now()) return null;
      const user = state.users[session.userId];
      return user ? publicUser(user) : null;
    },
    async logout(token) {
      await loaded;
      if (typeof token === 'string' && state.sessions[hashToken(token)]) { delete state.sessions[hashToken(token)]; persist(); }
    },
    async rename(userId, name) { await loaded; const user = state.users[userId]; if (user && name) { user.name = name; persist(); } },
  };
}
