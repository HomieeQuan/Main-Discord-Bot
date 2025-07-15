const mongoose = require('mongoose')

// SWAT User model with complete rank progression system
const swatUserSchema = new mongoose.Schema({
    discordId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true
    },
    
    // EXISTING POINT SYSTEM (for leaderboards and quota)
    weeklyPoints: {
        type: Number,
        default: 0
    },
    allTimePoints: {
        type: Number,
        default: 0
    },
    weeklyQuota: {
        type: Number,
        default: 10
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
    
    // EXISTING TREND TRACKING
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
    },
    
    // NEW: RANK PROGRESSION SYSTEM
    rankName: {
        type: String,
        default: 'Probationary Operator'  // Starting rank
    },
    rankLevel: {
        type: Number,
        default: 1  // Level 1 = Probationary Operator
    },
    rankPoints: {
        type: Number,
        default: 0  // Points toward NEXT rank (resets on promotion)
    },
    
    // RANK LOCK SYSTEM
    rankLockUntil: {
        type: Date,
        default: null  // When rank lock expires
    },
    rankLockNotified: {
        type: Boolean,
        default: false  // Has user been notified that lock expired?
    },
    
    // PROMOTION TRACKING
    promotionEligible: {
        type: Boolean,
        default: false  // Is user currently eligible for promotion?
    },
    lastPromotionCheck: {
        type: Date,
        default: Date.now
    },
    
    // PROMOTION HISTORY - Complete career tracking
    promotionHistory: [{
        fromRank: {
            name: String,
            level: Number
        },
        toRank: {
            name: String,
            level: Number
        },
        promotedAt: {
            type: Date,
            default: Date.now
        },
        promotedBy: {
            hrUserId: String,
            hrUsername: String
        },
        promotionType: {
            type: String,
            enum: ['standard', 'force', 'bypass_lock'],
            default: 'standard'
        },
        reason: String,
        rankPointsAtPromotion: Number,
        allTimePointsAtPromotion: Number,
        rankLockApplied: {
            days: Number,
            until: Date
        }
    }],
    
    // USER LIFECYCLE
    joinedSWATAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// 🚀 PERFORMANCE INDEXES
console.log('📊 Adding SWATUser database indexes...');

// Existing indexes
swatUserSchema.index({ weeklyPoints: -1 }, { 
    name: 'weekly_leaderboard_idx',
    background: true 
});

swatUserSchema.index({ allTimePoints: -1 }, { 
    name: 'alltime_leaderboard_idx',
    background: true 
});

swatUserSchema.index({ discordId: 1 }, { 
    name: 'discord_lookup_idx',
    background: true 
});

swatUserSchema.index({ quotaCompleted: 1 }, { 
    name: 'quota_stats_idx',
    background: true 
});

swatUserSchema.index({ isBooster: 1, weeklyPoints: -1 }, { 
    name: 'booster_performance_idx',
    background: true 
});

// NEW: Rank system indexes
swatUserSchema.index({ rankLevel: -1 }, { 
    name: 'rank_level_idx',
    background: true 
});

swatUserSchema.index({ promotionEligible: 1 }, { 
    name: 'promotion_eligible_idx',
    background: true 
});

swatUserSchema.index({ rankLockUntil: 1 }, { 
    name: 'rank_lock_idx',
    background: true,
    sparse: true
});

// Compound indexes for advanced queries
swatUserSchema.index({ rankLevel: -1, allTimePoints: -1 }, { 
    name: 'rank_performance_idx',
    background: true 
});

swatUserSchema.index({ promotionEligible: 1, rankLevel: 1 }, { 
    name: 'promotion_management_idx',
    background: true 
});

console.log('✅ SWATUser indexes configured successfully');

module.exports = mongoose.model('SWATUser', swatUserSchema);