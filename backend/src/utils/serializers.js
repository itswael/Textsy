const toObject = (doc) => (doc && typeof doc.toObject === 'function' ? doc.toObject() : doc);

/**
 * Fields needed to render a public profile, plus the privacy preferences and
 * block list used to decide what may be shown. Never includes email or password.
 */
export const PUBLIC_USER_FIELDS =
  'handle displayName bio avatar interests languages city area isOnline lastSeen preferences blockedUsers';

/** What any other signed-in user may see. Respects the owner's privacy toggles. */
export const publicUser = (doc) => {
  const user = toObject(doc);
  const prefs = user.preferences || {};
  return {
    id: String(user._id),
    handle: user.handle,
    displayName: user.displayName || user.handle,
    bio: user.bio || '',
    avatar: user.avatar,
    interests: user.interests || [],
    languages: user.languages || [],
    city: user.city,
    area: user.area || '',
    isOnline: prefs.showOnlineStatus === false ? false : Boolean(user.isOnline),
    lastSeen: prefs.showLastSeen === false ? null : user.lastSeen ?? null,
  };
};

/** What a user sees about themselves. Includes the private email and preferences. */
export const selfUser = (doc) => {
  const user = toObject(doc);
  return {
    ...publicUser({ ...user, preferences: undefined }),
    email: user.email,
    ageConfirmed: Boolean(user.ageConfirmed),
    preferences: {
      language: user.preferences?.language ?? 'en',
      notifications: user.preferences?.notifications ?? true,
      showOnlineStatus: user.preferences?.showOnlineStatus ?? true,
      showLastSeen: user.preferences?.showLastSeen ?? true,
    },
  };
};

export const serializeMessage = (doc) => {
  const message = toObject(doc);
  return {
    id: String(message._id),
    chatId: String(message.chatId),
    sender: String(message.sender),
    text: message.deletedAt ? '' : message.text,
    clientId: message.clientId ?? null,
    createdAt: message.createdAt,
  };
};

export const serializeLastMessage = (lastMessage) =>
  lastMessage
    ? {
        id: String(lastMessage.messageId),
        text: lastMessage.text,
        sender: String(lastMessage.sender),
        createdAt: lastMessage.createdAt,
      }
    : null;
