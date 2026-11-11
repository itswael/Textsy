import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { bearer, Chat, Message, register, startTestServer, User } from './helpers.js';

describe('auth', () => {
  let t;
  before(async () => {
    t = await startTestServer({ inviteCodes: [] });
  });
  after(() => t.stop());
  beforeEach(() => t.reset());

  const valid = {
    email: 'Asha@Example.com',
    handle: 'asha_k',
    password: 'longenough',
    ageConfirmed: true,
    city: 'meerut',
  };

  describe('register', () => {
    it('creates an account, normalises input and never returns the hash', async () => {
      const res = await t.api.post('/api/auth/register').send(valid);
      assert.equal(res.status, 201);
      assert.ok(res.body.token);
      assert.equal(res.body.user.email, 'asha@example.com');
      assert.equal(res.body.user.handle, 'asha_k');
      assert.equal(res.body.user.city, 'Meerut');
      assert.equal(res.body.user.passwordHash, undefined);

      const stored = await User.findOne({ handle: 'asha_k' }).select('+passwordHash');
      assert.notEqual(stored.passwordHash, valid.password);
      assert.match(stored.passwordHash, /^\$2[aby]\$/);
    });

    it('rejects a duplicate email or handle with a specific code', async () => {
      await t.api.post('/api/auth/register').send(valid);

      const sameEmail = await t.api.post('/api/auth/register').send({ ...valid, handle: 'other_one' });
      assert.equal(sameEmail.status, 409);
      assert.equal(sameEmail.body.code, 'email_taken');

      const sameHandle = await t.api
        .post('/api/auth/register')
        .send({ ...valid, email: 'other@example.com', handle: 'ASHA_K' });
      assert.equal(sameHandle.status, 409);
      assert.equal(sameHandle.body.code, 'handle_taken');
    });

    for (const [name, patch, message] of [
      ['an invalid handle', { handle: 'a!' }, /Handle must be/],
      ['a reserved handle', { handle: 'admin' }, /not available/],
      ['a short password', { password: 'short' }, /at least 8/],
      ['an invalid email', { email: 'not-an-email' }, /valid email/],
      ['an unknown city', { city: 'Atlantis' }, /City must be/],
      ['a missing age confirmation', { ageConfirmed: false }, /18 or older/],
      ['a non-string password (NoSQL injection attempt)', { password: { $gt: '' } }, /Password is required/],
    ]) {
      it(`rejects ${name}`, async () => {
        const res = await t.api.post('/api/auth/register').send({ ...valid, ...patch });
        assert.equal(res.status, 400);
        assert.match(res.body.error, message);
      });
    }

    it('enforces the invite code when configured', async () => {
      const closed = t.apiWith({ inviteCodes: ['MEERUT-BETA'] });

      const missing = await closed.post('/api/auth/register').send(valid);
      assert.equal(missing.status, 403);
      assert.equal(missing.body.code, 'invite_required');

      const wrong = await closed.post('/api/auth/register').send({ ...valid, inviteCode: 'nope' });
      assert.equal(wrong.status, 403);

      const ok = await closed.post('/api/auth/register').send({ ...valid, inviteCode: 'MEERUT-BETA' });
      assert.equal(ok.status, 201);
    });

    it('throttles repeated attempts against the same account', async () => {
      const strict = t.apiWith({ rateLimit: { windowMs: 60_000, userMax: 100, authMax: 3 } });
      const attempt = () => strict.post('/api/auth/login').send({ identifier: 'victim', password: 'guessguess' });
      for (let i = 0; i < 3; i += 1) assert.equal((await attempt()).status, 401);
      assert.equal((await attempt()).status, 429);

      // A different account from the same IP is unaffected.
      const other = await strict.post('/api/auth/login').send({ identifier: 'someone_else', password: 'guessguess' });
      assert.equal(other.status, 401);
    });
  });

  describe('login', () => {
    it('signs in by email or by handle', async () => {
      await t.api.post('/api/auth/register').send(valid);

      const byEmail = await t.api.post('/api/auth/login').send({ identifier: 'ASHA@example.com', password: valid.password });
      assert.equal(byEmail.status, 200);
      assert.ok(byEmail.body.token);

      const byHandle = await t.api.post('/api/auth/login').send({ identifier: '@asha_k', password: valid.password });
      assert.equal(byHandle.status, 200);
      assert.equal(byHandle.body.user.handle, 'asha_k');
    });

    it('gives the same error for a wrong password and an unknown account', async () => {
      await t.api.post('/api/auth/register').send(valid);
      const wrongPassword = await t.api.post('/api/auth/login').send({ identifier: 'asha_k', password: 'wrongwrong' });
      const unknown = await t.api.post('/api/auth/login').send({ identifier: 'nobody', password: 'wrongwrong' });
      assert.equal(wrongPassword.status, 401);
      assert.equal(unknown.status, 401);
      assert.equal(wrongPassword.body.error, unknown.body.error);
    });

    it('refuses banned accounts', async () => {
      const { user } = await register(t.api, { handle: 'banned_one', password: 'password123' });
      await User.updateOne({ _id: user.id }, { isBanned: true, banReason: 'spam' });
      const res = await t.api.post('/api/auth/login').send({ identifier: 'banned_one', password: 'password123' });
      assert.equal(res.status, 403);
      assert.equal(res.body.code, 'banned');
    });
  });

  describe('session', () => {
    it('returns the private profile for a valid token only', async () => {
      const { token } = await register(t.api, { email: 'me@example.com' });
      const ok = await t.api.get('/api/auth/me').set(bearer(token));
      assert.equal(ok.status, 200);
      assert.equal(ok.body.user.email, 'me@example.com');

      assert.equal((await t.api.get('/api/auth/me')).status, 401);
      assert.equal((await t.api.get('/api/auth/me').set(bearer('garbage'))).status, 401);
    });

    it('rejects tokens for deleted or banned accounts', async () => {
      const { token, user } = await register(t.api);
      await User.updateOne({ _id: user.id }, { isBanned: true });
      assert.equal((await t.api.get('/api/auth/me').set(bearer(token))).status, 403);

      await User.deleteOne({ _id: user.id });
      assert.equal((await t.api.get('/api/auth/me').set(bearer(token))).status, 401);
    });
  });

  describe('delete account', () => {
    it('requires the password, then removes the user and retires their chats', async () => {
      const alice = await register(t.api);
      const bob = await register(t.api);

      const chat = await Chat.getOrCreateDirect(alice.user.id, bob.user.id);
      await Message.create({ chatId: chat._id, sender: alice.user.id, text: 'hello bob' });

      const wrong = await t.api.delete('/api/auth/me').set(bearer(alice.token)).send({ password: 'nope-nope' });
      assert.equal(wrong.status, 401);
      assert.ok(await User.exists({ _id: alice.user.id }));

      const ok = await t.api.delete('/api/auth/me').set(bearer(alice.token)).send({ password: alice.password });
      assert.equal(ok.status, 200);
      assert.equal(await User.exists({ _id: alice.user.id }), null);

      const retired = await Chat.findById(chat._id);
      assert.equal(retired.isActive, false);
      const scrubbed = await Message.findOne({ chatId: chat._id });
      assert.equal(scrubbed.text, '[deleted]');

      // Bob no longer sees the chat.
      const list = await t.api.get('/api/chats').set(bearer(bob.token));
      assert.deepEqual(list.body.chats, []);
    });
  });
});
