// models/EventLog.js - Updated to store multiple screenshot URLs
const mongoose = require('mongoose');

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
        default: false
    },
    // UPDATED: Support both single URL (backward compatibility) and multiple URLs
    screenshotUrl: {
        type: String,
        required: false  // Made optional for backward compatibility
    },
    // NEW: Multiple screenshot URLs (array)
    screenshotUrls: {
        type: [String],
        default: undefined,
        validate: {
            validator: function(urls) {
                // Must have at least 1 screenshot, max 3 screenshots
                return urls && urls.length >= 1 && urls.length <= 3;
            },
            message: 'Must provide 1-3 screenshot URLs'
        }
    },
    quantity: {
        type: Number,
        default: 1
    },
    attendeesPassed: {
        type: Number,
        default: undefined,
        min: 0,
        max: 50,
        sparse: true
    },
    submittedAt: {
        type: Date,
        default: Date.now
    },
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

// Add method to get all screenshot URLs (handles both old and new format)
eventLogSchema.methods.getAllScreenshotUrls = function() {
    if (this.screenshotUrls && this.screenshotUrls.length > 0) {
        return this.screenshotUrls; // New format
    } else if (this.screenshotUrl) {
        return [this.screenshotUrl]; // Old format - convert to array
    }
    return []; // No screenshots
};

// Add method to get primary screenshot URL (for backward compatibility)
eventLogSchema.methods.getPrimaryScreenshotUrl = function() {
    const urls = this.getAllScreenshotUrls();
    return urls.length > 0 ? urls[0] : null;
};

// Add method to check if event has valid screenshots
eventLogSchema.methods.hasValidScreenshots = function() {
    const urls = this.getAllScreenshotUrls();
    return urls.length > 0 && urls.every(url => 
        url && 
        !url.startsWith('HR_') && 
        !url.startsWith('SYSTEM_')
    );
};

// Add method to get screenshot count
eventLogSchema.methods.getScreenshotCount = function() {
    return this.getAllScreenshotUrls().length;
};

// UPDATED: Performance indexes
console.log('📊 Adding EventLog database indexes...');

eventLogSchema.index({ userId: 1, submittedAt: -1 }, { 
    name: 'user_events_idx',
    background: true 
});

eventLogSchema.index({ submittedAt: -1 }, { 
    name: 'recent_events_idx',
    background: true 
});

eventLogSchema.index({ eventType: 1, submittedAt: -1 }, { 
    name: 'event_type_idx',
    background: true 
});

eventLogSchema.index({ 'hrAction.hrUser': 1, submittedAt: -1 }, { 
    name: 'hr_audit_idx',
    background: true,
    sparse: true
});

eventLogSchema.index({ pointsAwarded: 1, submittedAt: -1 }, { 
    name: 'points_analysis_idx',
    background: true 
});

eventLogSchema.index({ boostedPoints: 1, pointsAwarded: 1 }, { 
    name: 'booster_analysis_idx',
    background: true 
});

eventLogSchema.index({ submittedAt: 1, eventType: 1 }, { 
    name: 'date_range_idx',
    background: true 
});

eventLogSchema.index({ eventType: 1, attendeesPassed: 1 }, { 
    name: 'tryout_analysis_idx',
    background: true,
    sparse: true
});

console.log('✅ EventLog indexes configured successfully');

module.exports = mongoose.model('EventLog', eventLogSchema);