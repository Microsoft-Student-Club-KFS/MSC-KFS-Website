const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 10;

function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

function comparePassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

module.exports = { hashPassword, comparePassword };
