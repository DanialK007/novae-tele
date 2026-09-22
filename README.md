# NOVAE Telegram Bot

Interactive Telegram bot for NOVAE store management.

## Features

- `/orders` - View recent orders
- `/pending` - View pending orders  
- `/shipped` - View shipped orders
- `/delivered` - View delivered orders
- `/stats` - View store statistics
- `/help` - Show available commands
- `/show` - Show reply keyboard above text input
- `/hide` - Hide reply keyboard

**Inline Keyboard**: Buttons appear under bot messages for quick access
**Reply Keyboard**: Buttons appear above the text input for quick access to all commands

## Setup

### 1. Install Dependencies
```bash
npm install
```

### 2. Environment Variables
Create a `.env` file with:
```
TELEGRAM_BOT_TOKEN=your-bot-token-from-botfather
FIREBASE_SERVICE_ACCOUNT=your-firebase-service-account-json
AUTHORIZED_USER_IDS=your-telegram-user-id
PORT=3000
```

**Get your Telegram User ID:**
- Message @userinfobot in Telegram
- It will reply with your user ID
- Add it to `AUTHORIZED_USER_IDS` (comma-separated for multiple users)
- Leave empty to allow all users (NOT SECURE - only for development)

### 3. Local Testing
```bash
npm start
```

## Render Deployment

### 1. Create New Web Service
- Go to [Render.com](https://render.com)
- Click "New +" → "Web Service"
- Connect your GitHub repository
- Select "NOVAE-telegram-bot" folder

### 2. Configure Environment Variables
Add these in Render dashboard:
- `TELEGRAM_BOT_TOKEN` - Your bot token from @BotFather
- `FIREBASE_SERVICE_ACCOUNT` - Your Firebase service account JSON
- `AUTHORIZED_USER_IDS` - Your Telegram user ID (comma-separated for multiple admins)
- `PORT` - Render sets this automatically

### 3. Set Telegram Webhook
After deployment, set the webhook:
```
https://api.telegram.org/botYOUR_BOT_TOKEN/setWebhook?url=https://your-app.onrender.com/webhook/YOUR_BOT_TOKEN
```

### 4. Test Commands
Send `/start` to your bot to see available commands.
