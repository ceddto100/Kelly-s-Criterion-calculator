/**
 * MongoDB connection configuration for Betgistics MCP server
 */

import mongoose from 'mongoose';

let isConnected = false;

/**
 * Connect to MongoDB
 * Uses MONGODB_URI environment variable
 */
export async function connectToDatabase(): Promise<typeof mongoose> {
  if (isConnected) {
    console.log('[MongoDB] Using existing connection');
    return mongoose;
  }

  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    throw new Error('MONGODB_URI environment variable is not set');
  }

  try {
    console.log('[MongoDB] Connecting to database...');

    await mongoose.connect(mongoUri, {
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    console.log('[MongoDB] Connected successfully');

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.log('[MongoDB] Disconnected');
      isConnected = false;
    });

    return mongoose;
  } catch (error) {
    console.error('[MongoDB] Connection failed:', error);
    throw error;
  }
}

/**
 * Disconnect from MongoDB
 */
export async function disconnectFromDatabase(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    console.log('[MongoDB] Disconnected successfully');
  } catch (error) {
    console.error('[MongoDB] Disconnect error:', error);
    throw error;
  }
}

/**
 * Check if database is connected
 */
export function isDatabaseConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

/**
 * Ensure an active database connection is available
 */
export async function ensureDatabaseConnection(): Promise<void> {
  if (isDatabaseConnected()) {
    return;
  }

  try {
    await connectToDatabase();
  } catch (error) {
    console.error('[MongoDB] Unable to establish connection:', error);
    throw error;
  }
}

/**
 * Get the mongoose connection
 */
export function getConnection(): mongoose.Connection {
  return mongoose.connection;
}
