const jwt = require('jsonwebtoken');
const secret = 'CHANGE_ME_TO_A_LONG_RANDOM_SECRET'; // même valeur que ton .env
const payload = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'admin',
  email: 'admin@etika.local',
};
const token = jwt.sign(payload, secret, { expiresIn: '12h' });
process.stdout.write(token);
