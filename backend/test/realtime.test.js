import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Chat, Message, User, bearer, emitWithAck, register, startTestServer, stays, waitFor } from './helpers.js';

describe('realtime', () => {
  let t;
  let alice;
  let bob;
  let chatId;

  before(async () => {
    t = await startTestServer();
  });
  after(() => t.stop());
  beforeEach(async () => {
    await t.reset();
    alice = await register(t.api, { handle: 'alice_a' });
    bob = await register(t.api, { handle: 'bob_b' });
    const res = await t.api.post('/api/chats').set(bearer(alice.token)).send({ handle: 'bob_b' });
    chatId = res.body.chat.id;
  });

  describe('connection', () => {
    it('rejects missing, invalid and banned credentials', async () => {
      await assert.rejects(t.socket(undefined), /Authentication required/);
      await assert.rejects(t.socket('garbage'), (error) => {
        assert.match(error.message, /Invalid token/);
        assert.equal(error.data.code, 'auth');
        return true;
      });
      await User.updateOne({ _id: bob.user.id }, { isBanned: true });
      await assert.rejects(t.socket(bob.token), (error) => {
        assert.match(error.message, /suspended/);
        assert.equal(error.data.code, 'banned');
        return true;
      });
    });

    it('tracks online status across several devices', async () => {
      const phone = await t.socket(alice.token);
      const tablet = await t.socket(alice.token);
      assert.equal((await User.findById(alice.user.id)).isOnline, true);

      phone.close();
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal((await User.findById(alice.user.id)).isOnline, true, 'still online on the tablet');

      tablet.close();
      await new Promise((resolve) => setTimeout(resolve, 150));
      assert.equal((await User.findById(alice.user.id)).isOnline, false);
    });
  });

  describe('messaging', () => {
    it('delivers a message to both people, acknowledges it and updates unread counts', async () => {
      const aliceSocket = await t.socket(alice.token);
      const bobSocket = await t.socket(bob.token);

      const bobGets = waitFor(bobSocket, 'message:new');
      const bobChat = waitFor(bobSocket, 'chat:updated');
      const aliceGets = waitFor(aliceSocket, 'message:new');

      const ack = await emitWithAck(aliceSocket, 'message:send', { chatId, text: '  hello bob  ', clientId: 'a-1' });
      assert.equal(ack.ok, true);
      assert.equal(ack.message.text, 'hello bob');
      assert.equal(ack.duplicate, false);

      const received = (await bobGets).message;
      assert.equal(received.text, 'hello bob');
      assert.equal(received.sender, alice.user.id);
      assert.equal((await aliceGets).message.id, received.id, 'sender gets it too, for their other devices');

      const update = await bobChat;
      assert.equal(update.chatId, chatId);
      assert.equal(update.unread, 1);
      assert.equal(update.lastMessage.text, 'hello bob');

      const stored = await Chat.findById(chatId);
      assert.equal(stored.lastMessage.text, 'hello bob');
      assert.equal(stored.unread.get(bob.user.id), 1);
      assert.equal(stored.unread.get(alice.user.id), 0);
    });

    it('persists the message so it is there after reconnecting', async () => {
      const aliceSocket = await t.socket(alice.token);
      await emitWithAck(aliceSocket, 'message:send', { chatId, text: 'saved?', clientId: 'p-1' });
      aliceSocket.close();

      const history = await t.api.get(`/api/chats/${chatId}/messages`).set(bearer(bob.token));
      assert.deepEqual(history.body.messages.map((m) => m.text), ['saved?']);
    });

    it('does not deliver a retried send twice', async () => {
      const aliceSocket = await t.socket(alice.token);
      const bobSocket = await t.socket(bob.token);
      const seen = [];
      bobSocket.on('message:new', (payload) => seen.push(payload.message.id));

      const first = await emitWithAck(aliceSocket, 'message:send', { chatId, text: 'once', clientId: 'same' });
      const retry = await emitWithAck(aliceSocket, 'message:send', { chatId, text: 'once', clientId: 'same' });
      await new Promise((resolve) => setTimeout(resolve, 200));

      assert.equal(retry.duplicate, true);
      assert.equal(retry.message.id, first.message.id);
      assert.equal(seen.length, 1);
      assert.equal(await Message.countDocuments(), 1);
    });

    it('rejects bad input with a readable error and a code', async () => {
      const aliceSocket = await t.socket(alice.token);
      const empty = await emitWithAck(aliceSocket, 'message:send', { chatId, text: '   ' });
      assert.deepEqual([empty.ok, empty.code], [false, 'invalid_text']);

      const long = await emitWithAck(aliceSocket, 'message:send', { chatId, text: 'x'.repeat(1001) });
      assert.equal(long.ok, false);

      const noPayload = await emitWithAck(aliceSocket, 'message:send', undefined);
      assert.equal(noPayload.ok, false);

      const badChat = await emitWithAck(aliceSocket, 'message:send', { chatId: 'nope', text: 'hi' });
      assert.deepEqual([badChat.ok, badChat.code], [false, 'not_found']);
      assert.equal(await Message.countDocuments(), 0);
    });

    it('does not let outsiders send into someone else\'s chat or read it', async () => {
      const carol = await register(t.api, { handle: 'carol_c' });
      const carolSocket = await t.socket(carol.token);
      const bobSocket = await t.socket(bob.token);

      const quiet = stays(bobSocket, 'message:new');
      const ack = await emitWithAck(carolSocket, 'message:send', { chatId, text: 'let me in' });
      assert.deepEqual([ack.ok, ack.code], [false, 'not_found']);
      assert.equal(await quiet, true);

      const read = await emitWithAck(carolSocket, 'chat:read', { chatId });
      assert.equal(read.ok, false);
    });

    it('stops messages in both directions once blocked', async () => {
      const aliceSocket = await t.socket(alice.token);
      const bobSocket = await t.socket(bob.token);
      await t.api.post('/api/users/alice_a/block').set(bearer(bob.token));

      const fromAlice = await emitWithAck(aliceSocket, 'message:send', { chatId, text: 'hello?' });
      const fromBob = await emitWithAck(bobSocket, 'message:send', { chatId, text: 'go away' });
      assert.equal(fromAlice.ok, false);
      assert.equal(fromBob.ok, false);
      assert.equal(await Message.countDocuments(), 0);
    });

    it('rate-limits a flood of messages', async () => {
      const aliceSocket = await t.socket(alice.token);
      const results = [];
      for (let i = 0; i < 25; i += 1) {
        results.push(await emitWithAck(aliceSocket, 'message:send', { chatId, text: `spam ${i}`, clientId: `f${i}` }));
      }
      assert.equal(results.filter((r) => r.ok).length, 20);
      assert.equal(results[24].code, 'rate_limited');
    });
  });

  describe('read state and typing', () => {
    it('clears unread and tells the sender it was read', async () => {
      const aliceSocket = await t.socket(alice.token);
      const bobSocket = await t.socket(bob.token);
      const unreadUpdate = waitFor(bobSocket, 'chat:updated');
      await emitWithAck(aliceSocket, 'message:send', { chatId, text: 'did you see this?', clientId: 'rd-1' });
      assert.equal((await unreadUpdate).unread, 1);

      const seen = waitFor(aliceSocket, 'chat:read');
      const mine = waitFor(bobSocket, 'chat:updated');
      const ack = await emitWithAck(bobSocket, 'chat:read', { chatId });

      assert.equal(ack.ok, true);
      assert.equal((await mine).unread, 0);
      const receipt = await seen;
      assert.equal(receipt.userId, bob.user.id);
      assert.equal(receipt.chatId, chatId);
      assert.equal((await Chat.findById(chatId)).unread.get(bob.user.id), 0);
    });

    it('relays typing only to the other person in the chat', async () => {
      const aliceSocket = await t.socket(alice.token);
      const bobSocket = await t.socket(bob.token);
      const carol = await register(t.api, { handle: 'carol_c' });
      const carolSocket = await t.socket(carol.token);

      const bobSees = waitFor(bobSocket, 'typing');
      const carolQuiet = stays(carolSocket, 'typing');
      aliceSocket.emit('typing', { chatId, isTyping: true });

      assert.deepEqual(await bobSees, { chatId, userId: alice.user.id, isTyping: true });
      assert.equal(await carolQuiet, true);
    });
  });

  describe('presence', () => {
    it('tells only people who share a chat, never everyone', async () => {
      const stranger = await register(t.api, { handle: 'stranger_s' });
      const bobSocket = await t.socket(bob.token);
      const strangerSocket = await t.socket(stranger.token);

      const bobSees = waitFor(bobSocket, 'presence');
      const strangerQuiet = stays(strangerSocket, 'presence', 400);
      await t.socket(alice.token);

      const payload = await bobSees;
      assert.equal(payload.userId, alice.user.id);
      assert.equal(payload.isOnline, true);
      assert.equal(await strangerQuiet, true);
    });

    it('stays silent for users who hide their online status', async () => {
      await User.updateOne({ _id: alice.user.id }, { 'preferences.showOnlineStatus': false });
      const bobSocket = await t.socket(bob.token);
      const quiet = stays(bobSocket, 'presence', 400);
      await t.socket(alice.token);
      assert.equal(await quiet, true);
    });
  });
});
