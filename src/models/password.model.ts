import mongoose, { Document, Schema } from 'mongoose';

export interface IPassword extends Document {
  password: string;
  strength: string;
  length: number;
  options: {
    upper: boolean;
    lower: boolean;
    numbers: boolean;
    symbols: boolean;
  };
  responseTime: number;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PasswordSchema = new Schema<IPassword>(
  {
    password: {
      type: String,
      required: true,
    },
    strength: {
      type: String,
      required: true,
      enum: ['Weak', 'Medium', 'Strong'],
    },
    length: {
      type: Number,
      required: true,
      min: 4,
      max: 64,
    },
    options: {
      upper: { type: Boolean, default: true },
      lower: { type: Boolean, default: true },
      numbers: { type: Boolean, default: true },
      symbols: { type: Boolean, default: false },
    },
    responseTime: {
      type: Number,
      required: true,
    },
    ipAddress: {
      type: String,
    },
    userAgent: {
      type: String,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better query performance
PasswordSchema.index({ createdAt: -1 });
PasswordSchema.index({ strength: 1 });

export default mongoose.model<IPassword>('Password', PasswordSchema);