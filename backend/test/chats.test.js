import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { sendMessage } from '../src/services/chatService.js';
import { bearer, Chat, Message, register, startTestServer, User } from './helpers.js';

describe('chats (REST)', () => {
  let t;
  let alice;
  let bob;

  before(async () => {
    t = await startTestServer();
  });
  after(() => t.stop());
  beforeEach(async () => {
    await t.reset();
    alice = await register(t.api, { handle: 'alice_a' });
    bob = await register(t.api, { handle: 'bob_b' });
  });

  const open = (as, handle) => t.api.post('/api/chats').set(bearer(as.token)).send({ handle });

  it('opens a chat by handle and returns the same chat the second time', async () => {
    const first = await open(alice, 'bob_b');
    assert.equal(first.status, 201);
    assert.equal(first.body.chat.other.handle, 'bob_b');
    assert.equal(first.body.chat.unread, 0);

    // Either side opening it again gets the same conversation, never a duplicate.
    const again = await open(bob, 'alice_a');
    assert.equal(again.body.chat.id, first.body.chat.id);
    assert.equal(await Chat.countDocuments(), 1);
  });

  it('survives two simultaneous creates without duplicating', async () => {
    const [x, y] = await Promise.all([open(alice, 'bob_b'), open(bob, 'alice_a')]);
    assert.equal(x.body.chat.id, y.body.chat.id);
    assert.equal(await Chat.countDocuments(), 1);
  });

  it('refuses to open chats with yourself, strangers who do not exist, blocked or banned users', async () => {
    assert.equal((await open(alice, 'alice_a')).status, 404);
    assert.equal((await open(alice, 'nobody_here')).status, 404);

    await t.api.post('/api/users/bob_b/block').set(bearer(alice.token));
    assert.equal((await open(alice, 'bob_b')).status, 404);
    assert.equal((await open(bob, 'alice_a')).status, 404);

    const carol = await register(t.api, { handle: 'carol_c' });
    await User.updateOne({ _id: carol.user.id }, { isBanned: true });
    assert.equal((await open(alice, 'carol_c')).status, 404);
  });

  it('is disabled when direct creation is turned off', async () => {
    const strict = t.apiWith({ allowDirectChatCreation: false });
    const res = await strict.post('/api/chats').set(bearer(alice.token)).send({ handle: 'bob_b' });
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'intro_required');
  });

  it('lists chats newest first with unread counts per user', async () => {
    const carol = await register(t.api, { handle: 'carol_c' });
    const withBob = (await open(alice, 'bob_b')).body.chat;
    const withCarol = (await open(alice, 'carol_c')).body.chat;

    await sendMessage(bob.user.id, { chatId: withBob.id, text: 'hi alice', clientId: 'c1' });
    await sendMessage(carol.user.id, { chatId: withCarol.id, text: 'hello there', clientId: 'c2' });
    await sendMessage(bob.user.id, { chatId: withBob.id, text: 'you there?', clientId: 'c3' });

    const list = await t.api.get('/api/chats').set(bearer(alice.token));
    assert.deepEqual(list.body.chats.map((c) => c.other.handle), ['bob_b', 'carol_c']);
    assert.equal(list.body.chats[0].unread, 2);
    assert.equal(list.body.chats[0].lastMessage.text, 'you there?');
    assert.equal(list.body.chats[1].unread, 1);

    // The sender has nothing unread in their own conversation.
    const bobList = await t.api.get('/api/chats').set(bearer(bob.token));
    assert.equal(bobList.body.chats[0].unread, 0);
  });

  it('keeps chats private to their two participants', async () => {
    const carol = await register(t.api, { handle: 'carol_c' });
    const chat = (await open(alice, 'bob_b')).body.chat;
    await sendMessage(alice.user.id, { chatId: chat.id, text: 'secret plans', clientId: 's1' });

    for (const path of [`/api/chats/${chat.id}`, `/api/chats/${chat.id}/messages`]) {
      assert.equal((await t.api.get(path).set(bearer(carol.token))).status, 404);
    }
    assert.equal((await t.api.post(`/api/chats/${chat.id}/read`).set(bearer(carol.token))).status, 404);
    assert.equal((await t.api.get('/api/chats/not-an-id').set(bearer(alice.token))).status, 404);
  });

  it('hides a chat from both sides after a block, and restores it on unblock', async () => {
    const chat = (await open(alice, 'bob_b')).body.chat;
    await t.api.post('/api/users/bob_b/block').set(bearer(alice.token));

    assert.deepEqual((await t.api.get('/api/chats').set(bearer(alice.token))).body.chats, []);
    assert.deepEqual((await t.api.get('/api/chats').set(bearer(bob.token))).body.chats, []);
    assert.equal((await t.api.get(`/api/chats/${chat.id}/messages`).set(bearer(bob.token))).status, 404);
    await assert.rejects(sendMessage(bob.user.id, { chatId: chat.id, text: 'still there?' }), /Chat not found/);

    await t.api.delete('/api/users/bob_b/block').set(bearer(alice.token));
    assert.equal((await t.api.get('/api/chats').set(bearer(bob.token))).body.chats.length, 1);
  });

  describe('messages', () => {
    it('pages through history oldest-to-newest using a cursor', async () => {
      const chat = (await open(alice, 'bob_b')).body.chat;
      for (let i = 1; i <= 7; i += 1) {
        await sendMessage(i % 2 ? alice.user.id : bob.user.id, { chatId: chat.id, text: `m${i}`, clientId: `k${i}` });
      }

      const latest = await t.api.get(`/api/chats/${chat.id}/messages?limit=3`).set(bearer(alice.token));
      assert.deepEqual(latest.body.messages.map((m) => m.text), ['m5', 'm6', 'm7']);
      assert.equal(latest.body.hasMore, true);

      const older = await t.api
        .get(`/api/chats/${chat.id}/messages?limit=3&before=${latest.body.nextBefore}`)
        .set(bearer(alice.token));
      assert.deepEqual(older.body.messages.map((m) => m.text), ['m2', 'm3', 'm4']);

      const oldest = await t.api
        .get(`/api/chats/${chat.id}/messages?limit=3&before=${older.body.nextBefore}`)
        .set(bearer(alice.token));
      assert.deepEqual(oldest.body.messages.map((m) => m.text), ['m1']);
      assert.equal(oldest.body.hasMore, false);
      assert.equal(oldest.body.nextBefore, null);
    });

    it('validates text and recognises a retried client id', async () => {
      const chat = (await open(alice, 'bob_b')).body.chat;
      await assert.rejects(sendMessage(alice.user.id, { chatId: chat.id, text: '   ' }), /empty/);
      await assert.rejects(sendMessage(alice.user.id, { chatId: chat.id, text: 'x'.repeat(1001) }), /too long/);
      await assert.rejects(sendMessage(alice.user.id, { chatId: chat.id, text: 'hi', clientId: 123 }), /client id/);

      const first = await sendMessage(alice.user.id, { chatId: chat.id, text: 'hi', clientId: 'dup-1' });
      const retry = await sendMessage(alice.user.id, { chatId: chat.id, text: 'hi', clientId: 'dup-1' });
      assert.equal(first.duplicate, false);
      assert.equal(retry.duplicate, true);
      assert.equal(String(first.message._id), String(retry.message._id));
      assert.equal(await Message.countDocuments(), 1);

      const stored = await Chat.findById(chat.id);
      assert.equal(stored.unread.get(bob.user.id), 1, 'a retry must not inflate the unread count');
    });

    it('counts unread correctly when messages are sent at the same time', async () => {
      const chat = (await open(alice, 'bob_b')).body.chat;
      await Promise.all(
        Array.from({ length: 10 }, (_, i) =>
          sendMessage(alice.user.id, { chatId: chat.id, text: `burst ${i}`, clientId: `burst-${i}` })
        )
      );
      const stored = await Chat.findById(chat.id);
      assert.equal(stored.unread.get(bob.user.id), 10);
      assert.equal(await Message.countDocuments(), 10);
    });

    it('marks a chat as read over REST', async () => {
      const chat = (await open(alice, 'bob_b')).body.chat;
      await sendMessage(alice.user.id, { chatId: chat.id, text: 'ping', clientId: 'r1' });
      assert.equal((await t.api.get('/api/chats').set(bearer(bob.token))).body.chats[0].unread, 1);

      assert.equal((await t.api.post(`/api/chats/${chat.id}/read`).set(bearer(bob.token))).status, 200);
      assert.equal((await t.api.get('/api/chats').set(bearer(bob.token))).body.chats[0].unread, 0);
    });
  });
});
