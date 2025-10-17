import mongoose from 'mongoose';

export const connectDB = async (): Promise<void> => {
  const uri = process.env.MONGO_URI;

  if (!uri) {
    throw new Error('MONGO_URI is not defined in environment variables');
  }

  try {
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });
    const connection = mongoose.connection;
    connection.on('error', (err) => {
      console.error('MongoDB connection error:', err);
    });
    console.info('MongoDB connected');
  } catch (error) {
    console.error('MongoDB connection failed');
    throw error;
  }
};

export default connectDB;
