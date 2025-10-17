import { NextFunction, Request, Response } from 'express';
import User from '../models/User';

export const checkTokens = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const user = await User.findById(req.user.id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.tokens <= 0) {
      res.status(403).json({ error: 'No tokens left' });
      return;
    }

    user.tokens -= 1;
    await user.save();

    req.dbUser = user;
    next();
  } catch (error) {
    console.error('Token check error:', error);
    res.status(500).json({ error: 'Failed to verify tokens' });
  }
};

export default checkTokens;
