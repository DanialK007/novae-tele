require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { cert } = require('firebase-admin/app');

const app = express();
app.use(express.json());

// Initialize Firebase Admin
let db;
try {
  const serviceAccountString = process.env.FIREBASE_SERVICE_ACCOUNT;
  
  if (!serviceAccountString) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT environment variable is not set');
  }
  
  console.log('🔐 FIREBASE_SERVICE_ACCOUNT length:', serviceAccountString.length);
  
  const serviceAccount = JSON.parse(serviceAccountString);
  console.log('🔐 Firebase service account parsed successfully');
  
  const firebaseApp = initializeApp({
    credential: cert(serviceAccount),
  });
  
  db = getFirestore(firebaseApp);
  console.log('✅ Firebase initialized successfully');
  
  // Test connection
  db.collection('orders').limit(1).get()
    .then(() => console.log('✅ Firebase connection test successful'))
    .catch(err => console.error('❌ Firebase connection test failed:', err));
    
} catch (error) {
  console.error('❌ Firebase initialization failed:', error);
  console.error('❌ Error details:', error.message);
  db = null; // Explicitly set to null
}

// Initialize Telegram Bot
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: false });

// Webhook endpoint
app.post(`/webhook/${process.env.TELEGRAM_BOT_TOKEN}`, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Commands
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🛒 Welcome to NOVAE Store Bot!

Available commands:
/orders - View recent orders
/pending - View pending orders
/shipped - View shipped orders
/delivered - View delivered orders
/stats - View store statistics
/help - Show this help message
  `.trim());
});

bot.onText(/\/orders/, async (msg) => {
  if (!db) {
    bot.sendMessage(msg.chat.id, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(msg.chat.id, '📦 No orders found');
      return;
    }

    let message = '📦 Recent Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber} - ${order.status}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n`;
      message += `  Customer: ${order.customer.name}\n\n`;
    });

    bot.sendMessage(msg.chat.id, message);
  } catch (error) {
    console.error('Error fetching orders:', error);
    bot.sendMessage(msg.chat.id, '❌ Error fetching orders');
  }
});

bot.onText(/\/pending/, async (msg) => {
  if (!db) {
    bot.sendMessage(msg.chat.id, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'Pending')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(msg.chat.id, '📦 No pending orders');
      return;
    }

    let message = '📦 Pending Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber}\n`;
      message += `  Customer: ${order.customer.name}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n\n`;
    });

    bot.sendMessage(msg.chat.id, message);
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    bot.sendMessage(msg.chat.id, '❌ Error fetching pending orders');
  }
});

bot.onText(/\/shipped/, async (msg) => {
  if (!db) {
    bot.sendMessage(msg.chat.id, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'Shipped')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(msg.chat.id, '📦 No shipped orders');
      return;
    }

    let message = '📦 Shipped Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber}\n`;
      message += `  Customer: ${order.customer.name}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n\n`;
    });

    bot.sendMessage(msg.chat.id, message);
  } catch (error) {
    console.error('Error fetching shipped orders:', error);
    bot.sendMessage(msg.chat.id, '❌ Error fetching shipped orders');
  }
});

bot.onText(/\/delivered/, async (msg) => {
  if (!db) {
    bot.sendMessage(msg.chat.id, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'Delivered')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(msg.chat.id, '📦 No delivered orders');
      return;
    }

    let message = '📦 Delivered Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber}\n`;
      message += `  Customer: ${order.customer.name}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n\n`;
    });

    bot.sendMessage(msg.chat.id, message);
  } catch (error) {
    console.error('Error fetching delivered orders:', error);
    bot.sendMessage(msg.chat.id, '❌ Error fetching delivered orders');
  }
});

bot.onText(/\/stats/, async (msg) => {
  if (!db) {
    bot.sendMessage(msg.chat.id, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    const ordersSnapshot = await db.collection('orders').get();
    const orders = ordersSnapshot.docs.map(doc => doc.data());
    
    const totalRevenue = orders.reduce((sum, order) => sum + order.total, 0);
    const totalOrders = orders.length;
    
    const statusCounts = {
      Pending: 0,
      Processing: 0,
      Shipped: 0,
      Delivered: 0,
      Cancelled: 0,
    };
    
    orders.forEach(order => {
      if (statusCounts[order.status] !== undefined) {
        statusCounts[order.status]++;
      }
    });

    const message = `
📊 Store Statistics:

💰 Total Revenue: Ks ${totalRevenue.toLocaleString()}
📦 Total Orders: ${totalOrders}

📈 Order Status:
• Pending: ${statusCounts.Pending}
• Processing: ${statusCounts.Processing}
• Shipped: ${statusCounts.Shipped}
• Delivered: ${statusCounts.Delivered}
• Cancelled: ${statusCounts.Cancelled}
    `.trim();

    bot.sendMessage(msg.chat.id, message);
  } catch (error) {
    console.error('Error fetching stats:', error);
    bot.sendMessage(msg.chat.id, '❌ Error fetching statistics');
  }
});

bot.onText(/\/help/, (msg) => {
  bot.sendMessage(msg.chat.id, `
🛒 NOVAE Store Bot Commands:

/orders - View recent orders
/pending - View pending orders
/shipped - View shipped orders
/delivered - View delivered orders
/stats - View store statistics
/help - Show this help message
  `.trim());
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Telegram bot webhook: https://your-app.onrender.com/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
});
