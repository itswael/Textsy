import User from '../models/User.js';

/** True when either user has blocked the other. Blocking is mutual in effect. */
export const isBlockedEitherWay = async (userA, userB) =>
  Boolean(
    await User.exists({
      $or: [
        { _id: userA, blockedUsers: userB },
        { _id: userB, blockedUsers: userA },
      ],
    })
  );
