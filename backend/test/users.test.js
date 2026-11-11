import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { bearer, register, startTestServer, User } from './helpers.js';

describe('users', () => {
  let t;
  before(async () => {
    t = await startTestServer({ cities: ['Meerut', 'Delhi'] });
  });
  after(() => t.stop());
  beforeEach(() => t.reset());

  describe('profile', () => {
    it('updates allowed fields, normalises interests and rejects bad input', async () => {
      const { token } = await register(t.api);
      const res = await t.api
        .put('/api/users/me')
        .set(bearer(token))
        .send({
          displayName: 'Asha',
          bio: 'hello',
          interests: ['Cricket ', 'coffee', 'cricket'],
          area: 'Shastri Nagar',
          preferences: { showLastSeen: false, language: 'hi' },
        });
      assert.equal(res.status, 200);
      assert.deepEqual(res.body.user.interests, ['cricket', 'coffee']);
      assert.equal(res.body.user.preferences.showLastSeen, false);
      assert.equal(res.body.user.preferences.language, 'hi');

      const tooMany = await t.api
        .put('/api/users/me')
        .set(bearer(token))
        .send({ interests: Array.from({ length: 11 }, (_, i) => `tag${i}`) });
      assert.equal(tooMany.status, 400);

      const badLang = await t.api.put('/api/users/me').set(bearer(token)).send({ preferences: { language: 'xx' } });
      assert.equal(badLang.status, 400);

      const badCity = await t.api.put('/api/users/me').set(bearer(token)).send({ city: 'Atlantis' });
      assert.equal(badCity.status, 400);
    });

    it('cannot change protected fields such as email, handle or ban status', async () => {
      const { token, user } = await register(t.api);
      await t.api
        .put('/api/users/me')
        .set(bearer(token))
        .send({ email: 'x@y.com', handle: 'hacked', isAdmin: true, isBanned: true, blockedUsers: [] });
      const stored = await User.findById(user.id);
      assert.equal(stored.handle, user.handle);
      assert.equal(stored.email, user.email);
      assert.equal(stored.isAdmin, false);
      assert.equal(stored.isBanned, false);
    });

    it('never exposes email or password data on public profiles', async () => {
      const a = await register(t.api);
      const b = await register(t.api, { handle: 'bee_one' });
      const res = await t.api.get('/api/users/bee_one').set(bearer(a.token));
      assert.equal(res.status, 200);
      assert.equal(res.body.user.handle, 'bee_one');
      const raw = JSON.stringify(res.body);
      assert.ok(!raw.includes(b.user.email));
      assert.ok(!raw.includes('passwordHash'));
      assert.ok(!raw.includes('blockedUsers'));
    });

    it('honours privacy toggles for online status and last seen', async () => {
      const viewer = await register(t.api);
      const hidden = await register(t.api, { handle: 'private_pal' });
      await User.updateOne(
        { _id: hidden.user.id },
        { isOnline: true, 'preferences.showOnlineStatus': false, 'preferences.showLastSeen': false }
      );
      const res = await t.api.get('/api/users/private_pal').set(bearer(viewer.token));
      assert.equal(res.body.user.isOnline, false);
      assert.equal(res.body.user.lastSeen, null);
    });
  });

  describe('discover', () => {
    it('ranks by shared interests and excludes self, other cities and blocked users', async () => {
      const me = await register(t.api, { interests: ['cricket', 'coffee', 'music'] });
      await register(t.api, { handle: 'two_shared', interests: ['cricket', 'music'] });
      await register(t.api, { handle: 'one_shared', interests: ['coffee'] });
      await register(t.api, { handle: 'none_shared', interests: ['chess'] });
      await register(t.api, { handle: 'elsewhere', interests: ['cricket', 'coffee', 'music'], city: 'Delhi' });
      const blockedByMe = await register(t.api, { handle: 'i_blocked', interests: ['cricket'] });
      const blocksMe = await register(t.api, { handle: 'blocks_me', interests: ['cricket'] });

      await t.api.post('/api/users/i_blocked/block').set(bearer(me.token));
      await t.api.post(`/api/users/${me.user.handle}/block`).set(bearer(blocksMe.token));

      const res = await t.api.get('/api/users/discover').set(bearer(me.token));
      assert.equal(res.status, 200);
      const handles = res.body.users.map((u) => u.handle);
      assert.deepEqual(handles, ['two_shared', 'one_shared', 'none_shared']);
      assert.deepEqual(res.body.users[0].sharedInterests.sort(), ['cricket', 'music']);
      assert.ok(!handles.includes(me.user.handle), 'must not discover yourself');
      assert.ok(!handles.includes(blockedByMe.user.handle));
    });

    it('filters by tag and paginates', async () => {
      const me = await register(t.api, { interests: ['cricket'] });
      for (let i = 0; i < 3; i += 1) await register(t.api, { handle: `player_${i}`, interests: ['cricket'] });
      await register(t.api, { handle: 'chess_fan', interests: ['chess'] });

      const tagged = await t.api.get('/api/users/discover?tag=Chess').set(bearer(me.token));
      assert.deepEqual(tagged.body.users.map((u) => u.handle), ['chess_fan']);

      const first = await t.api.get('/api/users/discover?limit=2').set(bearer(me.token));
      assert.equal(first.body.users.length, 2);
      assert.equal(first.body.hasMore, true);
      const second = await t.api.get('/api/users/discover?limit=2&skip=2').set(bearer(me.token));
      assert.equal(second.body.users.length, 2);
      assert.equal(second.body.hasMore, false);
    });

    it('skips banned users but not those whose ban has expired', async () => {
      const me = await register(t.api);
      const banned = await register(t.api, { handle: 'still_banned' });
      const expired = await register(t.api, { handle: 'ban_over' });
      await User.updateOne({ _id: banned.user.id }, { isBanned: true });
      await User.updateOne({ _id: expired.user.id }, { isBanned: true, banExpiresAt: new Date(Date.now() - 1000) });

      const res = await t.api.get('/api/users/discover').set(bearer(me.token));
      assert.deepEqual(res.body.users.map((u) => u.handle), ['ban_over']);
    });
  });

  describe('search', () => {
    it('finds by handle prefix, name and interest', async () => {
      const me = await register(t.api);
      await register(t.api, { handle: 'ravi_k', displayName: 'Ravi Kumar', interests: ['chess'] });
      await register(t.api, { handle: 'someone', displayName: 'Priya' });

      const byHandle = await t.api.get('/api/users/search?q=rav').set(bearer(me.token));
      assert.deepEqual(byHandle.body.users.map((u) => u.handle), ['ravi_k']);
      const byName = await t.api.get('/api/users/search?q=kumar').set(bearer(me.token));
      assert.deepEqual(byName.body.users.map((u) => u.handle), ['ravi_k']);
      const byInterest = await t.api.get('/api/users/search?q=chess').set(bearer(me.token));
      assert.deepEqual(byInterest.body.users.map((u) => u.handle), ['ravi_k']);
    });

    it('treats regex characters literally and rejects too-short queries', async () => {
      const me = await register(t.api);
      await register(t.api, { handle: 'plain_user' });

      for (const q of ['.*', '((', '[a-', '\\\\', 'a|b', '^$']) {
        const res = await t.api.get('/api/users/search').query({ q }).set(bearer(me.token));
        assert.equal(res.status, 200, `query ${q} should not error`);
        assert.deepEqual(res.body.users, [], `query ${q} must not match everyone`);
      }
      assert.equal((await t.api.get('/api/users/search?q=a').set(bearer(me.token))).status, 400);
    });
  });

  describe('blocking', () => {
    it('makes users invisible to each other and can be undone', async () => {
      const a = await register(t.api, { handle: 'alice_a' });
      const b = await register(t.api, { handle: 'bob_b' });

      assert.equal((await t.api.get('/api/users/bob_b').set(bearer(a.token))).status, 200);
      assert.equal((await t.api.post('/api/users/bob_b/block').set(bearer(a.token))).status, 200);

      assert.equal((await t.api.get('/api/users/bob_b').set(bearer(a.token))).status, 404);
      assert.equal((await t.api.get('/api/users/alice_a').set(bearer(b.token))).status, 404);
      const search = await t.api.get('/api/users/search?q=alice').set(bearer(b.token));
      assert.deepEqual(search.body.users, []);

      const list = await t.api.get('/api/users/blocked').set(bearer(a.token));
      assert.deepEqual(list.body.users.map((u) => u.handle), ['bob_b']);

      await t.api.delete('/api/users/bob_b/block').set(bearer(a.token));
      assert.equal((await t.api.get('/api/users/bob_b').set(bearer(a.token))).status, 200);
    });

    it('does not allow blocking yourself or unknown handles', async () => {
      const a = await register(t.api, { handle: 'alice_a' });
      assert.equal((await t.api.post('/api/users/alice_a/block').set(bearer(a.token))).status, 404);
      assert.equal((await t.api.post('/api/users/ghost_user/block').set(bearer(a.token))).status, 404);
    });
  });
});
