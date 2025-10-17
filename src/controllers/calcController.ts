import { Request, Response } from 'express';
import { z } from 'zod';
import User from '../models/User';
import { calculateKelly } from '../utils/kelly';
import { calculateCoverProbability } from '../utils/coverProbability';

const kellySchema = z.object({
  winProb: z
    .number({ required_error: 'winProb is required' })
    .gt(0, 'winProb must be greater than 0')
    .lt(1, 'winProb must be less than 1'),
  odds: z
    .number({ required_error: 'odds is required' })
    .gt(1, 'odds must be greater than 1'),
  bankroll: z
    .number({ required_error: 'bankroll is required' })
    .gt(0, 'bankroll must be greater than 0'),
});

const coverSchema = z.object({
  spread: z.number({ required_error: 'spread is required' }),
  projectedMargin: z.number({ required_error: 'projectedMargin is required' }),
  standardDeviation: z
    .number()
    .positive('standardDeviation must be positive')
    .optional(),
});

export const kelly = async (req: Request, res: Response): Promise<void> => {
  const parsed = kellySchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = calculateKelly(parsed.data);

  try {
    if (req.user) {
      const user = req.dbUser ?? (await User.findById(req.user.id));
      if (user) {
        user.calculations.push({
          type: 'kelly',
          input: parsed.data,
          output: result,
          createdAt: new Date(),
        });
        await user.save();
        res.json({ ...result, tokensRemaining: user.tokens });
        return;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Failed to store Kelly calculation:', error);
    res.status(500).json({ error: 'Failed to store calculation result' });
  }
};

export const coverProbability = async (req: Request, res: Response): Promise<void> => {
  const parsed = coverSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request body',
      details: parsed.error.flatten(),
    });
    return;
  }

  const result = calculateCoverProbability(parsed.data);

  try {
    if (req.user) {
      const user = req.dbUser ?? (await User.findById(req.user.id));
      if (user) {
        user.calculations.push({
          type: 'cover',
          input: parsed.data,
          output: result,
          createdAt: new Date(),
        });
        await user.save();
        res.json({ ...result, tokensRemaining: user.tokens });
        return;
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Failed to store cover probability calculation:', error);
    res.status(500).json({ error: 'Failed to store calculation result' });
  }
};

export default { kelly, coverProbability };
