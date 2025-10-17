import mongoose, { Document, Schema } from 'mongoose';

type CalculationEntry = {
  type: 'kelly' | 'cover';
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  createdAt: Date;
};

export interface IUser extends Document {
  email: string;
  tokens: number;
  calculations: CalculationEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const CalculationSchema = new Schema<CalculationEntry>(
  {
    type: {
      type: String,
      enum: ['kelly', 'cover'],
      required: true,
    },
    input: {
      type: Schema.Types.Mixed,
      required: true,
    },
    output: {
      type: Schema.Types.Mixed,
      required: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tokens: {
      type: Number,
      default: 100,
      min: 0,
    },
    calculations: {
      type: [CalculationSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

export const User = mongoose.models.User || mongoose.model<IUser>('User', UserSchema);

export default User;
