import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';

const addTokensSchema = z.object({
  amount: z
    .number({ required_error: 'amount is required' })
    .int('amount must be an integer')
    .positive('amount must be positive'),
});

export const addTokens = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const parsed = addTokensSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid request body', details: parsed.error.flatten() });
    return;
  }

  try {
    const user = await User.findByIdAndUpdate(
      req.user.id,
      { $inc: { tokens: parsed.data.amount } },
      { new: true }
    );

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ tokens: user.tokens });
  } catch (error) {
    console.error('Failed to add tokens:', error);
    res.status(500).json({ error: 'Failed to add tokens' });
  }
};

export const getUserInfo = async (req: Request, res: Response): Promise<void> => {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({
      email: user.email,
      tokens: user.tokens,
      calculations: user.calculations,
    });
  } catch (error) {
    console.error('Failed to retrieve user info:', error);
    res.status(500).json({ error: 'Failed to retrieve user info' });
  }
};

export default { addTokens, getUserInfo };
