// utils/rankSystem.js - Complete SWAT Rank Progression System
class RankSystem {
    // Complete 15-rank SWAT progression with your exact specifications
    static ranks = [
        // Junior Ranks (No Emojis)
        { 
            level: 1, 
            name: 'Probationary Operator', 
            pointsRequired: 0, 
            rankLockDays: 0,
            emoji: ''
        },
        { 
            level: 2, 
            name: 'Junior Operator', 
            pointsRequired: 25, 
            rankLockDays: 1,
            emoji: ''
        },
        { 
            level: 3, 
            name: 'Experienced Operator', 
            pointsRequired: 30, 
            rankLockDays: 3,
            emoji: ''
        },
        { 
            level: 4, 
            name: 'Senior Operator', 
            pointsRequired: 40, 
            rankLockDays: 3,
            emoji: ''
        },
        { 
            level: 5, 
            name: 'Specialized Operator', 
            pointsRequired: 50, 
            rankLockDays: 3,
            emoji: ''
        },
        
        // Elite Ranks (Thunder Bolt Progression)
        { 
            level: 6, 
            name: 'Elite Operator', 
            pointsRequired: 60, 
            rankLockDays: 5,
            emoji: '⚡'
        },
        { 
            level: 7, 
            name: 'Elite Operator I Class', 
            pointsRequired: 80, 
            rankLockDays: 5,
            emoji: '⚡⚡'
        },
        { 
            level: 8, 
            name: 'Elite Operator II Class', 
            pointsRequired: 90, 
            rankLockDays: 5,
            emoji: '⚡⚡⚡'
        },
        { 
            level: 9, 
            name: 'Elite Operator III Class', 
            pointsRequired: 100, 
            rankLockDays: 7,
            emoji: '⚡⚡⚡⚡'
        },
        { 
            level: 10, 
            name: 'Elite Operator IV Class', 
            pointsRequired: 120, 
            rankLockDays: 7,
            emoji: '⚡⚡⚡⚡⚡'
        },
        
        // Executive Ranks (Star System)
        { 
            level: 11, 
            name: 'Executive Operator', 
            pointsRequired: 300, 
            rankLockDays: 0,  // Hand-picked, no lock
            emoji: '⭐'
        },
        { 
            level: 12, 
            name: 'Senior Executive Operator', 
            pointsRequired: 0,  // Hand-picked only
            rankLockDays: 0,
            emoji: '⭐⭐'
        },
        
        // Command Ranks (Leadership Symbols)
        { 
            level: 13, 
            name: 'Operations Chief', 
            pointsRequired: 0,  // Hand-picked only
            rankLockDays: 0,
            emoji: '🎖️'
        },
        { 
            level: 14, 
            name: 'Deputy Commander', 
            pointsRequired: 0,  // Hand-picked only
            rankLockDays: 0,
            emoji: '🎖️⚔️'
        },
        { 
            level: 15, 
            name: 'SWAT Commander', 
            pointsRequired: 0,  // Hand-picked only
            rankLockDays: 0,
            emoji: '👑'
        }
    ];

    // Get rank information by level
    static getRankByLevel(level) {
        return this.ranks.find(rank => rank.level === level) || this.ranks[0];
    }

    // Get rank information by name
    static getRankByName(name) {
        return this.ranks.find(rank => rank.name === name) || this.ranks[0];
    }

    // Get next rank for a user
    static getNextRank(currentLevel) {
        const nextLevel = currentLevel + 1;
        if (nextLevel > 15) return null; // Already at max rank
        return this.getRankByLevel(nextLevel);
    }

    // Check if user can be promoted based on rank points (separate from all-time points)
    static checkPromotionEligibility(user) {
        const currentRank = this.getRankByLevel(user.rankLevel || 1);
        const nextRank = this.getNextRank(user.rankLevel || 1);
        
        if (!nextRank) {
            return {
                eligible: false,
                reason: 'Already at maximum rank',
                maxRank: true,
                currentRank,
                nextRank: null
            };
        }

        // Check if user is rank locked
        const now = new Date();
        const isRankLocked = user.rankLockUntil && user.rankLockUntil > now;
        
        if (isRankLocked) {
            const daysRemaining = Math.ceil((user.rankLockUntil - now) / (1000 * 60 * 60 * 24));
            return {
                eligible: false,
                reason: `Rank locked for ${daysRemaining} more days`,
                rankLocked: true,
                daysRemaining,
                currentRank,
                nextRank
            };
        }

        // For Executive+ ranks (hand-picked only)
        if (nextRank.level >= 11) {
            return {
                eligible: false,
                reason: 'Executive ranks are hand-picked only',
                handPickedOnly: true,
                currentRank,
                nextRank
            };
        }

        // Check rank points (separate from all-time points)
        const rankPoints = user.rankPoints || 0;
        const pointsRequired = nextRank.pointsRequired;
        const hasEnoughPoints = rankPoints >= pointsRequired;
        
        return {
            eligible: hasEnoughPoints,
            reason: hasEnoughPoints ? 'Ready for promotion!' : `Need ${pointsRequired - rankPoints} more rank points`,
            currentRank,
            nextRank,
            requirements: {
                pointsRequired,
                currentPoints: rankPoints,
                pointsRemaining: Math.max(0, pointsRequired - rankPoints),
                met: hasEnoughPoints
            }
        };
    }

    // Format rank display with emoji
    static formatRank(user) {
        const rank = this.getRankByLevel(user.rankLevel || 1);
        return rank.emoji ? `${rank.emoji} ${rank.name}` : rank.name;
    }

    // Get just the emoji for a rank level
    static getRankEmoji(level) {
        const rank = this.getRankByLevel(level);
        return rank.emoji || '';
    }

    // Get all ranks (for display/reference)
    static getAllRanks() {
        return this.ranks;
    }

    // Check if rank is elite or higher (has emoji)
    static isEliteOrHigher(level) {
        return level >= 6; // Elite Operator and above
    }

    // Check if rank is executive or higher (hand-picked)
    static isExecutiveOrHigher(level) {
        return level >= 11; // Executive Operator and above
    }

    // Calculate rank progress percentage
    static getRankProgress(user) {
        const eligibility = this.checkPromotionEligibility(user);
        
        if (eligibility.maxRank) return { percentage: 100, isMaxRank: true };
        if (eligibility.handPickedOnly) return { percentage: 100, isHandPicked: true };
        if (!eligibility.requirements) return { percentage: 0 };
        
        const percentage = Math.min(100, 
            (eligibility.requirements.currentPoints / eligibility.requirements.pointsRequired) * 100
        );
        
        return { 
            percentage: Math.round(percentage),
            current: eligibility.requirements.currentPoints,
            required: eligibility.requirements.pointsRequired,
            remaining: eligibility.requirements.pointsRemaining
        };
    }

    // Create progress bar for rank progression
    static createRankProgressBar(user, length = 10) {
        const progress = this.getRankProgress(user);
        
        if (progress.isMaxRank) return '[████████████] MAX RANK';
        if (progress.isHandPicked) return '[████████████] HAND-PICKED';
        
        const filledLength = Math.floor((progress.percentage / 100) * length);
        const emptyLength = length - filledLength;
        
        const filledBar = '█'.repeat(filledLength);
        const emptyBar = '░'.repeat(emptyLength);
        
        return `[${filledBar}${emptyBar}] ${progress.current}/${progress.required} pts (${progress.percentage}%)`;
    }

    // Apply rank lock when user gets promoted
    static applyRankLock(user, newRankLevel) {
        const newRank = this.getRankByLevel(newRankLevel);
        
        if (newRank.rankLockDays > 0) {
            const lockDate = new Date();
            lockDate.setDate(lockDate.getDate() + newRank.rankLockDays);
            
            user.rankLockUntil = lockDate;
            user.rankLockNotified = false; // Reset notification flag
            
            return {
                locked: true,
                lockUntil: lockDate,
                lockDays: newRank.rankLockDays
            };
        }
        
        return { locked: false };
    }

    // Check if user's rank lock has expired
    static checkRankLockExpiry(user) {
        if (!user.rankLockUntil) return { expired: false };
        
        const now = new Date();
        const hasExpired = user.rankLockUntil <= now;
        
        if (hasExpired) {
            const wasNotified = user.rankLockNotified;
            return {
                expired: true,
                needsNotification: !wasNotified
            };
        }
        
        const daysRemaining = Math.ceil((user.rankLockUntil - now) / (1000 * 60 * 60 * 24));
        return {
            expired: false,
            daysRemaining
        };
    }
}

module.exports = RankSystem;