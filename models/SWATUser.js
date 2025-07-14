const mongoose = require('mongoose')

// This defines what a SWAT user looks like in the database
const swatUserSchema = new mongoose.Schema({
    discordId: {
        type: String,           // Discord user ID
        required: true,         // Must have this
        unique: true           // No duplicates
    },
    username: {
        type: String,
        required: true
    },
    weeklyPoints: {
        type: Number,
        default: 0             // Starts at 0
    },
    allTimePoints: {
        type: Number,
        default: 0
    },
    weeklyQuota: {
        type: Number,
        default: 10            // Default quota is 10 points
    },
    quotaCompleted: {
        type: Boolean,
        default: false
    },
    isBooster: {
        type: Boolean,
        default: false
    },
    totalEvents: {
        type: Number,
        default: 0
    },
    weeklyEvents: {
        type: Number,
        default: 0
    },
     // NEW: Trend tracking fields
     previousWeeklyPoints: {
        type: Number,
        default: 0
    },
    previousRank: {
        type: Number,
        default: 0
    },
    lastPointsUpdate: {
        type: Date,
        default: Date.now
    },
    // NEW: Statistics for enhanced features
    dailyPointsToday: {
        type: Number,
        default: 0
    },
    lastDailyReset: {
        type: Date,
        default: Date.now
    },
    quotaStreak: {
        type: Number,
        default: 0
    },
    lastQuotaCompletion: {
        type: Date,
        default: null
    }
    
}, {
    timestamps: true          // Automatically adds createdAt/updatedAt
});

// 🚀 PERFORMANCE INDEXES - Critical for fast leaderboards!
console.log('📊 Adding database indexes for optimal performance...');

// Primary indexes for leaderboard queries (most important)
swatUserSchema.index({ weeklyPoints: -1 }, { 
    name: 'weekly_leaderboard_idx',
    background: true 
});

swatUserSchema.index({ allTimePoints: -1 }, { 
    name: 'alltime_leaderboard_idx',
    background: true 
});

// User lookup index (for fast user searches)
swatUserSchema.index({ discordId: 1 }, { 
    name: 'discord_lookup_idx',
    background: true 
});

// Quota statistics index (for completion rates)
swatUserSchema.index({ quotaCompleted: 1 }, { 
    name: 'quota_stats_idx',
    background: true 
});

// Compound index for quota + points (advanced queries)
swatUserSchema.index({ quotaCompleted: 1, weeklyPoints: -1 }, { 
    name: 'quota_points_idx',
    background: true 
});

// Booster analysis index
swatUserSchema.index({ isBooster: 1, weeklyPoints: -1 }, { 
    name: 'booster_performance_idx',
    background: true 
});

// Daily activity index
swatUserSchema.index({ lastDailyReset: 1 }, { 
    name: 'daily_reset_idx',
    background: true 
});

console.log('✅ SWATUser indexes configured successfully');

// Export this so other files can use it
module.exports = mongoose.model('SWATUser', swatUserSchema);