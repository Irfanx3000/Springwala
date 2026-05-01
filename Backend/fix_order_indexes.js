const mongoose = require('mongoose');
require('dotenv').config({ path: './Backend/.env' });

async function fixIndexes() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://localhost:27017/springwala');
    console.log('Connected to MongoDB');
    
    const db = mongoose.connection.db;
    const collection = db.collection('orders');
    
    const indexes = await collection.indexes();
    console.log('Current indexes:', indexes.map(i => i.name));
    
    if (indexes.find(i => i.name === 'orderId_1')) {
      console.log('Dropping old orderId_1 index...');
      await collection.dropIndex('orderId_1');
    }
    
    console.log('Ensuring orderNumber_1 index...');
    await collection.createIndex({ orderNumber: 1 }, { unique: true });
    
    console.log('Indexes updated successfully');
    process.exit(0);
  } catch (error) {
    console.error('Error fixing indexes:', error);
    process.exit(1);
  }
}

fixIndexes();
