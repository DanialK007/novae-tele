require('dotenv').config();
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { cert } = require('firebase-admin/app');

const app = express();
app.use(express.json());

// ============================================================
// Authentication Configuration
// ============================================================
// Whitelist of authorized Telegram user IDs
// Get your user ID by messaging @userinfobot in Telegram
const AUTHORIZED_USER_IDS = process.env.AUTHORIZED_USER_IDS
  ? process.env.AUTHORIZED_USER_IDS.split(',').map(id => id.trim())
  : [];

console.log('🔐 Authorized User IDs:', AUTHORIZED_USER_IDS.length > 0 ? AUTHORIZED_USER_IDS : 'None configured - allowing all users (NOT SECURE)');

// Check if user is authorized
function isAuthorized(userId) {
  // If no authorized IDs are configured, allow all (development mode)
  if (AUTHORIZED_USER_IDS.length === 0) {
    console.warn('⚠️  No authorized user IDs configured - allowing all users. Set AUTHORIZED_USER_IDS in production!');
    return true;
  }
  return AUTHORIZED_USER_IDS.includes(userId.toString());
}

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

// Middleware to check authorization for all bot commands
function checkAuth(handler) {
  return async (msg) => {
    const userId = msg.from.id;
    
    if (!isAuthorized(userId)) {
      console.log(`❌ Unauthorized access attempt from user ID: ${userId}`);
      bot.sendMessage(msg.chat.id, '❌ You are not authorized to use this bot. Please contact the administrator.');
      return;
    }
    
    console.log(`✅ Authorized user: ${userId} (${msg.from.username || 'no username'})`);
    return handler(msg);
  };
}

// Helper function to get inline keyboard (for messages)
function getInlineKeyboard() {
  return {
    reply_markup: {
      inline_keyboard: [
        [
          { text: '📦 Recent Orders', callback_data: '/orders' },
          { text: '📊 Statistics', callback_data: '/stats' }
        ],
        [
          { text: '⏳ Pending', callback_data: '/pending' },
          { text: '🚚 Shipped', callback_data: '/shipped' }
        ],
        [
          { text: '✅ Delivered', callback_data: '/delivered' },
          { text: '❓ Help', callback_data: '/help' }
        ]
      ]
    }
  };
}

// Helper function to get reply keyboard (appears below chat input)
function getReplyKeyboard() {
  return {
    reply_markup: {
      keyboard: [
        [
          { text: '📦 Orders' },
          { text: '📊 Stats' }
        ],
        [
          { text: '⏳ Pending' },
          { text: '🚚 Shipped' }
        ],
        [
          { text: '✅ Delivered' },
          { text: '❓ Help' }
        ]
      ],
      resize_keyboard: true,
      one_time_keyboard: false,
      persistent: true
    }
  };
}

// Helper function to hide keyboard
function hideKeyboard() {
  return {
    reply_markup: {
      remove_keyboard: true
    }
  };
}

// Command handlers
async function handleOrdersCommand(chatId) {
  if (!db) {
    bot.sendMessage(chatId, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    console.log('📦 Fetching recent orders...');
    const ordersSnapshot = await db.collection('orders')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    console.log('📦 Orders fetched:', ordersSnapshot.size);
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(chatId, '📦 No orders found', getInlineKeyboard());
      return;
    }

    let message = '📦 Recent Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber} - ${order.status}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n`;
      message += `  Customer: ${order.customer.name}\n\n`;
    });

    bot.sendMessage(chatId, message, getInlineKeyboard());
  } catch (error) {
    console.error('Error fetching orders:', error);
    console.error('Error details:', error.message);
    bot.sendMessage(chatId, `❌ Error fetching orders: ${error.message}`, getInlineKeyboard());
  }
}

async function handlePendingCommand(chatId) {
  if (!db) {
    bot.sendMessage(chatId, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    console.log('📦 Fetching pending orders...');
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'Pending')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    console.log('📦 Pending orders fetched:', ordersSnapshot.size);
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(chatId, '📦 No pending orders', getInlineKeyboard());
      return;
    }

    let message = '📦 Pending Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber}\n`;
      message += `  Customer: ${order.customer.name}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n\n`;
    });

    bot.sendMessage(chatId, message, getInlineKeyboard());
  } catch (error) {
    console.error('Error fetching pending orders:', error);
    console.error('Error details:', error.message);
    bot.sendMessage(chatId, `❌ Error fetching pending orders: ${error.message}`, getInlineKeyboard());
  }
}

async function handleShippedCommand(chatId) {
  if (!db) {
    bot.sendMessage(chatId, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    console.log('📦 Fetching shipped orders...');
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'Shipped')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    console.log('📦 Shipped orders fetched:', ordersSnapshot.size);
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(chatId, '📦 No shipped orders', getInlineKeyboard());
      return;
    }

    let message = '📦 Shipped Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber}\n`;
      message += `  Customer: ${order.customer.name}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n\n`;
    });

    bot.sendMessage(chatId, message, getInlineKeyboard());
  } catch (error) {
    console.error('Error fetching shipped orders:', error);
    console.error('Error details:', error.message);
    bot.sendMessage(chatId, `❌ Error fetching shipped orders: ${error.message}`, getInlineKeyboard());
  }
}

async function handleDeliveredCommand(chatId) {
  if (!db) {
    bot.sendMessage(chatId, '❌ Firebase not initialized. Please check environment variables.');
    return;
  }
  
  try {
    console.log('📦 Fetching delivered orders...');
    const ordersSnapshot = await db.collection('orders')
      .where('status', '==', 'Delivered')
      .orderBy('createdAt', 'desc')
      .limit(10)
      .get();
    
    console.log('📦 Delivered orders fetched:', ordersSnapshot.size);
    
    if (ordersSnapshot.empty) {
      bot.sendMessage(chatId, '📦 No delivered orders', getInlineKeyboard());
      return;
    }

    let message = '📦 Delivered Orders:\n\n';
    ordersSnapshot.forEach((doc) => {
      const order = doc.data();
      message += `• ${order.orderNumber}\n`;
      message += `  Customer: ${order.customer.name}\n`;
      message += `  Total: Ks ${order.total.toLocaleString()}\n\n`;
    });

    bot.sendMessage(chatId, message, getInlineKeyboard());
  } catch (error) {
    console.error('Error fetching delivered orders:', error);
    console.error('Error details:', error.message);
    bot.sendMessage(chatId, `❌ Error fetching delivered orders: ${error.message}`, getInlineKeyboard());
  }
}

async function handleStatsCommand(chatId) {
  if (!db) {
    bot.sendMessage(chatId, '❌ Firebase not initialized. Please check environment variables.');
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

    bot.sendMessage(chatId, message, getInlineKeyboard());
  } catch (error) {
    console.error('Error fetching stats:', error);
    bot.sendMessage(chatId, '❌ Error fetching statistics', getInlineKeyboard());
  }
}

function handleHelpCommand(chatId) {
  bot.sendMessage(chatId, `
🛒 NOVAE Store Bot Commands:

/orders - View recent orders
/pending - View pending orders
/shipped - View shipped orders
/delivered - View delivered orders
/stats - View store statistics
/help - Show this help message

📱 Or use the buttons below the chat box!
  `.trim(), getInlineKeyboard());
}

// Commands
bot.onText(/\/start/, checkAuth((msg) => {
  // Show both inline keyboard (above) and reply keyboard (below)
  bot.sendMessage(msg.chat.id, `
🛒 Welcome to NOVAE Store Bot!

👋 Hi! I'm here to help you manage your store.

🔽 Use the buttons below or tap the options under the chat box:
  `, getInlineKeyboard());
  
  // Set persistent reply keyboard (appears below chat input)
  bot.sendMessage(msg.chat.id, 'Keyboard options added below 👇', getReplyKeyboard());
}));

// Callback query handler for inline keyboard buttons
bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const userId = query.from.id;
  const data = query.data;
  
  // Check authorization
  if (!isAuthorized(userId)) {
    console.log(`❌ Unauthorized callback from user ID: ${userId}`);
    bot.answerCallbackQuery(query.id);
    bot.sendMessage(chatId, '❌ You are not authorized to use this bot. Please contact the administrator.');
    return;
  }
  
  // Answer the callback query
  bot.answerCallbackQuery(query.id);
  
  // Call the appropriate command handler based on callback data
  if (data === '/orders') {
    await handleOrdersCommand(chatId);
  } else if (data === '/stats') {
    await handleStatsCommand(chatId);
  } else if (data === '/pending') {
    await handlePendingCommand(chatId);
  } else if (data === '/shipped') {
    await handleShippedCommand(chatId);
  } else if (data === '/delivered') {
    await handleDeliveredCommand(chatId);
  } else if (data === '/help') {
    handleHelpCommand(chatId);
  }
});

bot.onText(/\/orders/, checkAuth(async (msg) => {
  await handleOrdersCommand(msg.chat.id);
}));

bot.onText(/\/pending/, checkAuth(async (msg) => {
  await handlePendingCommand(msg.chat.id);
}));

bot.onText(/\/shipped/, checkAuth(async (msg) => {
  await handleShippedCommand(msg.chat.id);
}));

bot.onText(/\/delivered/, checkAuth(async (msg) => {
  await handleDeliveredCommand(msg.chat.id);
}));

bot.onText(/\/stats/, checkAuth(async (msg) => {
  await handleStatsCommand(msg.chat.id);
}));

bot.onText(/\/help/, checkAuth((msg) => {
  handleHelpCommand(msg.chat.id);
}));

// Handle reply keyboard button taps (text messages)
bot.onText(/📦 Orders/, checkAuth(async (msg) => {
  await handleOrdersCommand(msg.chat.id);
}));

bot.onText(/📊 Stats/, checkAuth(async (msg) => {
  await handleStatsCommand(msg.chat.id);
}));

bot.onText(/⏳ Pending/, checkAuth(async (msg) => {
  await handlePendingCommand(msg.chat.id);
}));

bot.onText(/🚚 Shipped/, checkAuth(async (msg) => {
  await handleShippedCommand(msg.chat.id);
}));

bot.onText(/✅ Delivered/, checkAuth(async (msg) => {
  await handleDeliveredCommand(msg.chat.id);
}));

bot.onText(/❓ Help/, checkAuth((msg) => {
  handleHelpCommand(msg.chat.id);
}));

// Command to hide the reply keyboard
bot.onText(/\/hide/, checkAuth((msg) => {
  bot.sendMessage(msg.chat.id, 'Keyboard hidden. Type /start to show it again.', hideKeyboard());
}));

// Command to show the reply keyboard
bot.onText(/\/show/, checkAuth((msg) => {
  bot.sendMessage(msg.chat.id, 'Keyboard shown below 👇', getReplyKeyboard());
}));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`🤖 Telegram bot webhook: https://your-app.onrender.com/webhook/${process.env.TELEGRAM_BOT_TOKEN}`);
});
