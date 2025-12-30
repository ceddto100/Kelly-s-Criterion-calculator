import { z } from 'zod';

/**
 * Widget state defaults and validation for the Betgistics input widget.
 * Mirrors the JSON schema used by the Widget Builder.
 */
export const WidgetState = z.strictObject({
  initialUserText: z.string(),
  initialBankroll: z.string(),
  initialOdds: z.string(),
  defaultKelly: z.enum(['0.25', '0.5', '1.0']),
  defaultLogBet: z.boolean(),
  initialUserId: z.string()
});

export type WidgetStateType = z.infer<typeof WidgetState>;

export const defaultState: WidgetStateType = {
  initialUserText: '',
  initialBankroll: '',
  initialOdds: '',
  defaultKelly: '0.5',
  defaultLogBet: true,
  initialUserId: ''
};

export default WidgetState;
