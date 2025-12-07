// models/SWATUser.js - UPDATED: Dual-division support (SWAT + CMU)
const mongoose = require('mongoose')

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
    
    // Unit field (SWAT or CMU - both are units within the SWAT division)
    unit: {
        type: String,
        enum: ['SWAT', 'CMU'],
        default: 'SWAT',
        required: true
    },
    
    // NEW: Specialized Unit (SOG or TET badges)
    specializedUnit: {
        type: String,
        enum: ['SOG', 'TET', null],
        default: null
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

    active: {
        type: Boolean,
        default: true
    },
    deletedAt: {
        type: Date,
        default: null
    },
    deletedBy: {
        type: String,
        default: null
    },
    deletionReason: {
        type: String,
        default: null
    },
    
    // RANK PROGRESSION SYSTEM (now division-aware)
    rankName: {
        type: String,
        default: 'Probationary Operator'  // SWAT default - will be 'Responder In Training' for CMU
    },
    rankLevel: {
        type: Number,
        default: 1  // Level 1 for both divisions
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
            enum: ['standard', 'force', 'bypass_lock', 'hand_picked'],
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

// Rank system indexes
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

// Compound indexes
swatUserSchema.index({ rankLevel: -1, allTimePoints: -1 }, { 
    name: 'rank_performance_idx',
    background: true 
});

swatUserSchema.index({ promotionEligible: 1, rankLevel: 1 }, { 
    name: 'promotion_management_idx',
    background: true 
});

// NEW: Division-specific indexes
swatUserSchema.index({ division: 1, weeklyPoints: -1 }, { 
    name: 'division_weekly_leaderboard_idx',
    background: true 
});

swatUserSchema.index({ division: 1, allTimePoints: -1 }, { 
    name: 'division_alltime_leaderboard_idx',
    background: true 
});

swatUserSchema.index({ division: 1, rankLevel: -1 }, { 
    name: 'division_rank_idx',
    background: true 
});

swatUserSchema.index({ division: 1, quotaCompleted: 1 }, { 
    name: 'division_quota_idx',
    background: true 
});

// NEW: Specialized unit index
swatUserSchema.index({ specializedUnit: 1 }, { 
    name: 'specialized_unit_idx',
    background: true,
    sparse: true
});

console.log('✅ SWATUser indexes configured successfully');

// NEW: Pre-save hook to set default rank name based on division
swatUserSchema.pre('save', function(next) {
    // If this is a new user and rankName hasn't been set manually
    if (this.isNew && this.rankName === 'Probationary Operator' && this.unit === 'CMU') {
        this.rankName = 'Responder In Training';
    }
    next();
});

module.exports = mongoose.model('SWATUser', swatUserSchema);