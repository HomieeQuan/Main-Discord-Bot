// models/EventLog.js
const mongoose = require('mongoose');

// This defines what an event submission looks like
const eventLogSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true
    },
    username: {
        type: String,
        required: true
    },
    eventType: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    pointsAwarded: {
        type: Number,
        required: true
    },
    boostedPoints: {
        type: Boolean,
        default: false        // Was this boosted (2x points)?
    },
    screenshotUrl: {
        type: String,
        required: true        // Must have proof
    },
    quantity: {           // NEW: Track how many events
        type: Number,
        default: 1
    },
    submittedAt: {
        type: Date,
        default: Date.now     // Automatically set current time
    },
    // HR Action tracking (for audit logs)
    hrAction: {
        hrUser: String,
        hrUsername: String,
        action: String,
        amount: Number,
        reason: String,
        oldWeeklyPoints: Number,
        newWeeklyPoints: Number,
        oldAllTimePoints: Number,
        newAllTimePoints: Number
    }
}, {
    timestamps: true
});

// 🚀 PERFORMANCE INDEXES - Critical for fast log queries!
console.log('📊 Adding EventLog database indexes...');

// Primary index for user event history (most common query)
eventLogSchema.index({ userId: 1, submittedAt: -1 }, { 
    name: 'user_events_idx',
    background: true 
});

// Recent events index (for dashboards and recent activity)
eventLogSchema.index({ submittedAt: -1 }, { 
    name: 'recent_events_idx',
    background: true 
});

// Event type filtering index (for HR reports)
eventLogSchema.index({ eventType: 1, submittedAt: -1 }, { 
    name: 'event_type_idx',
    background: true 
});

// HR audit trail index
eventLogSchema.index({ 'hrAction.hrUser': 1, submittedAt: -1 }, { 
    name: 'hr_audit_idx',
    background: true,
    sparse: true  // Only index documents that have hrAction
});

// Points analysis index (for statistics)
eventLogSchema.index({ pointsAwarded: 1, submittedAt: -1 }, { 
    name: 'points_analysis_idx',
    background: true 
});

// Booster analysis index
eventLogSchema.index({ boostedPoints: 1, pointsAwarded: 1 }, { 
    name: 'booster_analysis_idx',
    background: true 
});

// Date range queries (for weekly/monthly reports)
eventLogSchema.index({ submittedAt: 1, eventType: 1 }, { 
    name: 'date_range_idx',
    background: true 
});

console.log('✅ EventLog indexes configured successfully');

module.exports = mongoose.model('EventLog', eventLogSchema);