// utils/automationScheduler.js - Daily automation scheduler
const DailyAutomation = require('./dailyAutomation');

class AutomationScheduler {
    constructor(client) {
        this.client = client;
        this.dailyInterval = null;
        this.isRunning = false;
    }

    // Start the daily automation scheduler
    start() {
        if (this.isRunning) {
            console.log('⚠️ Automation scheduler is already running');
            return;
        }

        console.log('🤖 Starting automation scheduler...');
        
        // Calculate time until next 6 AM
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(6, 0, 0, 0); // 6:00 AM
        
        // If it's already past 6 AM today, schedule for tomorrow
        if (now >= nextRun) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        
        const timeUntilNext = nextRun.getTime() - now.getTime();
        
        console.log(`⏰ Next automation scheduled for: ${nextRun.toLocaleString()}`);
        console.log(`⏰ Time until next run: ${Math.round(timeUntilNext / (1000 * 60 * 60))} hours`);
        
        // Set initial timeout to first 6 AM
        setTimeout(() => {
            this.runDailyAutomation();
            
            // Then set up daily interval (24 hours)
            this.dailyInterval = setInterval(() => {
                this.runDailyAutomation();
            }, 24 * 60 * 60 * 1000); // 24 hours
            
        }, timeUntilNext);
        
        this.isRunning = true;
        console.log('✅ Automation scheduler started successfully');
    }

    // Stop the automation scheduler
    stop() {
        if (!this.isRunning) {
            console.log('⚠️ Automation scheduler is not running');
            return;
        }

        if (this.dailyInterval) {
            clearInterval(this.dailyInterval);
            this.dailyInterval = null;
        }

        this.isRunning = false;
        console.log('🛑 Automation scheduler stopped');
    }

    // Run the daily automation
    async runDailyAutomation() {
        try {
            console.log('🤖 Running scheduled daily automation...');
            const results = await DailyAutomation.runDailyAutomation(this.client);
            
            if (results) {
                console.log('✅ Scheduled automation completed successfully');
            } else {
                console.error('❌ Scheduled automation failed');
            }
        } catch (error) {
            console.error('❌ Scheduled automation error:', error);
        }
    }

    // Get scheduler status
    getStatus() {
        return {
            isRunning: this.isRunning,
            nextRun: this.getNextRunTime(),
            hasInterval: !!this.dailyInterval
        };
    }

    // Calculate next run time
    getNextRunTime() {
        if (!this.isRunning) return null;

        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(6, 0, 0, 0);
        
        if (now >= nextRun) {
            nextRun.setDate(nextRun.getDate() + 1);
        }
        
        return nextRun;
    }

    // Manual trigger for testing
    async triggerManual(interaction) {
        console.log(`🔧 Manual automation triggered by ${interaction.user.username}`);
        await DailyAutomation.runManualAutomation(this.client, interaction);
    }
}

module.exports = AutomationScheduler;