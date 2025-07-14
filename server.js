const express = require('express')
const app = express()

// Load environment variables first
require('dotenv').config()

// 🚀 NEW: Validate environment before starting anything
const { validateEnvironment } = require('./config/validateEnv');
validateEnvironment();

const port = process.env.PORT
const connectdb = require('./config/connectdb')

// Connect to database
connectdb()

// Start the Discord bot
const { startBot } = require('./app');
startBot();

// Start Express server
app.listen(port, () => {
    console.log(`🌐 Express server running on port ${port}`)
})








