// config/validateEnv.js
function validateEnvironment() {
    console.log('🔍 Validating environment configuration...');
    
    // Required environment variables
    const requiredVars = [
        'BOT_TOKEN',
        'CLIENT_ID', 
        'GUILD_ID',
        'URI', // MongoDB connection string
        'PORT'
    ];

    // Check for missing variables
    const missing = requiredVars.filter(varName => !process.env[varName]);
    
    if (missing.length > 0) {
        console.error('❌ CONFIGURATION ERROR: Missing required environment variables:');
        missing.forEach(varName => {
            console.error(`   - ${varName}`);
        });
        console.error('\n💡 Please check your .env file and ensure all required variables are set!');
        console.error('\n📋 Required .env file format:');
        console.error('BOT_TOKEN=your_bot_token_here');
        console.error('CLIENT_ID=your_client_id_here');
        console.error('GUILD_ID=your_guild_id_here');
        console.error('URI=mongodb://your_connection_string');
        console.error('PORT=6000');
        process.exit(1);
    }

    // Validate format of specific variables
    const validationErrors = [];

    // Validate Discord IDs (should be numeric strings)
    if (process.env.CLIENT_ID && !/^\d+$/.test(process.env.CLIENT_ID)) {
        validationErrors.push('CLIENT_ID must be a numeric Discord ID');
    }

    if (process.env.GUILD_ID && !/^\d+$/.test(process.env.GUILD_ID)) {
        validationErrors.push('GUILD_ID must be a numeric Discord ID');
    }

    // Validate PORT (should be a number)
    if (process.env.PORT && (isNaN(process.env.PORT) || parseInt(process.env.PORT) < 1 || parseInt(process.env.PORT) > 65535)) {
        validationErrors.push('PORT must be a valid port number (1-65535)');
    }

    // Validate MongoDB URI format
    if (process.env.URI && !process.env.URI.startsWith('mongodb')) {
        validationErrors.push('URI must be a valid MongoDB connection string (starting with mongodb:// or mongodb+srv://)');
    }

    // Validate BOT_TOKEN format (basic check)
    if (process.env.BOT_TOKEN && process.env.BOT_TOKEN.length < 50) {
        validationErrors.push('BOT_TOKEN appears to be invalid (too short)');
    }

    if (validationErrors.length > 0) {
        console.error('❌ CONFIGURATION ERROR: Invalid environment variables:');
        validationErrors.forEach(error => {
            console.error(`   - ${error}`);
        });
        console.error('\n💡 Please check your .env file values!');
        process.exit(1);
    }

    // Success message
    console.log('✅ Environment variables validated successfully');
    console.log(`   🤖 Bot Token: ${process.env.BOT_TOKEN.substring(0, 10)}...`);
    console.log(`   🆔 Client ID: ${process.env.CLIENT_ID}`);
    console.log(`   🏠 Guild ID: ${process.env.GUILD_ID}`);
    console.log(`   🗄️ Database: ${process.env.URI.includes('localhost') ? 'Local MongoDB' : 'Remote MongoDB'}`);
    console.log(`   🌐 Port: ${process.env.PORT}`);
}

// Optional: Validate at runtime (useful for checking if environment changed)
function validateRuntimeEnvironment() {
    try {
        validateEnvironment();
        return true;
    } catch (error) {
        console.error('❌ Runtime environment validation failed:', error.message);
        return false;
    }
}

// Export functions
module.exports = { 
    validateEnvironment,
    validateRuntimeEnvironment 
};