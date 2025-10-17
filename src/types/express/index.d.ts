import type { IUser } from '../../models/User';

declare global {
  namespace Express {
    interface UserPayload {
      id: string;
      email: string;
    }

    interface Request {
      user?: UserPayload;
      dbUser?: IUser;
    }
  }
}

export {};
