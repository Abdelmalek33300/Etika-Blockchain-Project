import jwt from 'jsonwebtoken';
import 'dotenv/config';

const payload = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: 'admin',
  email: 'admin@etika.local',
};

const token = jwt.sign(payload, process.env.JWT_SECRET, {
  expiresIn: process.env.JWT_EXPIRES_IN || '12h',
});

console.log(token);
