import { badRequest } from './http.js';
import { HANDLE_REGEX } from '../models/User.js';

// Handles that could impersonate the product or staff.
const RESERVED_HANDLES = new Set([
  'admin', 'administrator', 'root', 'support', 'help', 'textsy', 'official', 'moderator', 'mod',
  'staff', 'team', 'system', 'security', 'null', 'undefined', 'me', 'api',
]);

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const requireString = (value, label) => {
  if (typeof value !== 'string') throw badRequest(`${label} is required`);
  return value;
};

export const validateEmail = (value) => {
  const email = requireString(value, 'Email').trim().toLowerCase();
  if (email.length > 254 || !EMAIL_REGEX.test(email)) throw badRequest('Enter a valid email address');
  return email;
};

export const validateHandle = (value) => {
  const handle = requireString(value, 'Handle').trim().toLowerCase().replace(/^@/, '');
  if (!HANDLE_REGEX.test(handle)) {
    throw badRequest('Handle must be 3-20 characters: letters, numbers, dot or underscore');
  }
  if (RESERVED_HANDLES.has(handle)) throw badRequest('That handle is not available');
  return handle;
};

export const validatePassword = (value) => {
  const password = requireString(value, 'Password');
  if (password.length < 8) throw badRequest('Password must be at least 8 characters');
  // bcrypt only uses the first 72 bytes; reject rather than silently truncating.
  if (Buffer.byteLength(password, 'utf8') > 72) throw badRequest('Password is too long (max 72 bytes)');
  return password;
};

/** Returns the canonical spelling of an allowed city, or throws. */
export const validateCity = (value, allowedCities) => {
  const input = requireString(value, 'City').trim().toLowerCase();
  const match = allowedCities.find((city) => city.toLowerCase() === input);
  if (!match) throw badRequest(`City must be one of: ${allowedCities.join(', ')}`);
  return match;
};
