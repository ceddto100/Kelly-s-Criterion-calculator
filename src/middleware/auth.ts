import { NextFunction, Request, Response } from 'express';
import User from '../models/User';

const parseBearerToken = (header?: string): string | null => {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!scheme || scheme.toLowerCase() !== 'bearer' || !value) {
    return null;
  }
  return value.trim();
};

export const authenticateUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const token = parseBearerToken(req.headers.authorization);

    if (!token) {
      res.status(401).json({ error: 'Unauthorized: missing bearer token' });
      return;
    }

    const email = token.toLowerCase();
    if (!email || !email.includes('@')) {
      res.status(401).json({ error: 'Unauthorized: invalid token format' });
      return;
    }

    let user = await User.findOne({ email });
    if (!user) {
      user = await User.create({ email });
    }

    req.user = { id: user.id, email: user.email };
    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Failed to authenticate user' });
  }
};

export default authenticateUser;
