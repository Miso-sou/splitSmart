import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Expense from './models/expense.model.js';

dotenv.config();

mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/splitsmart')
  .then(async () => {
    console.log('Connected to DB');
    const result = await Expense.deleteMany({ category: 'settlement' });
    console.log(`Deleted ${result.deletedCount} legacy settlement expenses`);
    process.exit(0);
  })
  .catch(err => {
    console.error('Error:', err);
    process.exit(1);
  });
