// utils/rankSystem.js - SWAT Division with two units: SWAT Unit and CMU Unit
class RankSystem {
    // ================================
    // SWAT RANK PROGRESSION (10 RANKS)
    // ================================
    static swatRanks = [
        // === OPERATIONAL TIER (Regular Progression) ===
        { 
            level: 1, 
            name: 'Probationary Operator', 
            pointsRequired: 0,  // Entry rank
            rankLockDays: 1,
            weeklyQuota: 10,
            emoji: '',
            unit: 'SWAT',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 2, 
            name: 'Junior Operator', 
            pointsRequired: 65,
            rankLockDays: 3,
            weeklyQuota: 15,
            emoji: '',
            unit: 'SWAT',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 3, 
            name: 'Experienced Operator', 
            pointsRequired: 100,
            rankLockDays: 5,
            weeklyQuota: 20,
            emoji: '',
            unit: 'SWAT',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 4, 
            name: 'Senior Operator', 
            pointsRequired: 140,
            rankLockDays: 7,
            weeklyQuota: 20,
            emoji: '',
            unit: 'SWAT',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 5, 
            name: 'Specialized Operator', 
            pointsRequired: 190,
            rankLockDays: 7,
            weeklyQuota: 25,
            emoji: '',
            unit: 'SWAT',
            tier: 'operational',
            handPicked: false
        },
        
        // === SUPERVISOR TIER (Hand-picked entry, then earn progression) ===
        { 
            level: 6, 
            name: 'Tactical Operator', 
            pointsRequired: 0,  // HAND-PICKED (entry to supervisor track)
            rankLockDays: 0,    // No lock for hand-picked rank
            weeklyQuota: 30,
            emoji: '⚡',
            unit: 'SWAT',
            tier: 'supervisor',
            handPicked: true,
            description: 'Hand-picked for supervisor track'
        },
        { 
            level: 7, 
            name: 'Advanced Operator', 
            pointsRequired: 250,  // Must earn from Tactical
            rankLockDays: 10,
            weeklyQuota: 30,
            emoji: '⚡⚡',
            unit: 'SWAT',
            tier: 'supervisor',
            handPicked: false
        },
        { 
            level: 8, 
            name: 'Elite Operator', 
            pointsRequired: 320,  // Must earn from Advanced
            rankLockDays: 14,
            weeklyQuota: 30,
            emoji: '⚡⚡⚡',
            unit: 'SWAT',
            tier: 'supervisor',
            handPicked: false
        },
        
        // === HR TIER (Hand-picked only - NO RANK LOCKS) ===
        { 
            level: 9, 
            name: 'Executive Operator', 
            pointsRequired: 0,  // HAND-PICKED ONLY
            rankLockDays: 0,    // No lock for hand-picked HR
            weeklyQuota: 20,    // Level 9 has 20 point weekly quota
            emoji: '⭐',
            unit: 'SWAT',
            tier: 'hr',
            handPicked: true,
            description: 'Hand-picked by Administration ONLY'
        },
        { 
            level: 10, 
            name: 'Senior Executive Operator', 
            pointsRequired: 0,  // HAND-PICKED ONLY
            rankLockDays: 0,    // No lock for hand-picked HR
            weeklyQuota: 20,    // Level 10 has 20 point weekly quota
            emoji: '⭐⭐',
            unit: 'SWAT',
            tier: 'hr',
            handPicked: true,
            description: 'Hand-picked by Administration ONLY'
        }
    ];

    // ================================
    // CMU RANK PROGRESSION (10 RANKS)
    // ================================
    static cmuRanks = [
        // === OPERATIONAL TIER (Regular Progression) ===
        { 
            level: 1, 
            name: 'Responder In Training', 
            pointsRequired: 0,  // Entry rank
            rankLockDays: 1,
            weeklyQuota: 10,
            emoji: '',
            unit: 'CMU',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 2, 
            name: 'Field Medic', 
            pointsRequired: 65,
            rankLockDays: 3,
            weeklyQuota: 15,
            emoji: '',
            unit: 'CMU',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 3, 
            name: 'Junior Field Medic', 
            pointsRequired: 100,
            rankLockDays: 5,
            weeklyQuota: 20,
            emoji: '',
            unit: 'CMU',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 4, 
            name: 'Senior Field Medic', 
            pointsRequired: 140,
            rankLockDays: 7,
            weeklyQuota: 20,
            emoji: '',
            unit: 'CMU',
            tier: 'operational',
            handPicked: false
        },
        { 
            level: 5, 
            name: 'Specialist', 
            pointsRequired: 190,
            rankLockDays: 7,
            weeklyQuota: 25,
            emoji: '',
            unit: 'CMU',
            tier: 'operational',
            handPicked: false
        },
        
        // === SUPERVISOR TIER (Hand-picked entry, then earn progression) ===
        { 
            level: 6, 
            name: 'Medical Master Sergeant', 
            pointsRequired: 0,  // HAND-PICKED (entry to supervisor track)
            rankLockDays: 0,    // No lock for hand-picked rank
            weeklyQuota: 30,
            emoji: '⚕️',
            unit: 'CMU',
            tier: 'supervisor',
            handPicked: true,
            description: 'Hand-picked for supervisor track'
        },
        { 
            level: 7, 
            name: 'Emergency Coordinator', 
            pointsRequired: 250,  // Must earn from Medical Master Sergeant
            rankLockDays: 10,
            weeklyQuota: 30,
            emoji: '⚕️⚕️',
            unit: 'CMU',
            tier: 'supervisor',
            handPicked: false
        },
        { 
            level: 8, 
            name: 'Chief Medical Officer', 
            pointsRequired: 320,  // Must earn from Emergency Coordinator
            rankLockDays: 14,
            weeklyQuota: 30,
            emoji: '⚕️⚕️⚕️',
            unit: 'CMU',
            tier: 'supervisor',
            handPicked: false
        },
        
        // === HR TIER (Hand-picked only - NO RANK LOCKS) ===
        { 
            level: 9, 
            name: 'Board of Medicine', 
            pointsRequired: 0,  // HAND-PICKED ONLY
            rankLockDays: 0,    // No lock for hand-picked HR
            weeklyQuota: 20,    // Level 9 has 20 point weekly quota
            emoji: '🏥',
            unit: 'CMU',
            tier: 'hr',
            handPicked: true,
            description: 'Hand-picked by Administration ONLY'
        },
        { 
            level: 10, 
            name: 'Medical Director', 
            pointsRequired: 0,  // HAND-PICKED ONLY
            rankLockDays: 0,    // No lock for hand-picked HR
            weeklyQuota: 20,    // Level 10 has 20 point weekly quota
            emoji: '🏥⭐',
            unit: 'CMU',
            tier: 'hr',
            handPicked: true,
            description: 'Hand-picked by Administration ONLY'
        }
    ];

    // ================================
    // HELPER FUNCTIONS
    // ================================

    // Get rank by level and division
    static getRankByLevel(level, unit = 'SWAT') {
        const ranks = unit === 'CMU' ? this.cmuRanks : this.swatRanks;
        return ranks.find(rank => rank.level === level) || ranks[0];
    }

    // Get rank by name (auto-detect division)
    static getRankByName(name) {
        // Try SWAT first
        let rank = this.swatRanks.find(rank => rank.name === name);
        if (rank) return rank;
        
        // Try CMU
        rank = this.cmuRanks.find(rank => rank.name === name);
        if (rank) return rank;
        
        // Default to SWAT Probationary
        return this.swatRanks[0];
    }

    // Get next rank for a user
    static getNextRank(currentLevel, unit = 'SWAT') {
        const nextLevel = currentLevel + 1;
        const ranks = unit === 'CMU' ? this.cmuRanks : this.swatRanks;
        
        if (nextLevel > 10) return null; // Already at max rank
        return ranks.find(rank => rank.level === nextLevel) || null;
    }

    // Get all ranks for a division
    static getAllRanks(unit = 'SWAT') {
        return unit === 'CMU' ? this.cmuRanks : this.swatRanks;
    }

    // Get both division ranks (for admin reference)
    static getAllDivisionRanks() {
        return {
            SWAT: this.swatRanks,
            CMU: this.cmuRanks
        };
    }

    // ================================
    // PROMOTION ELIGIBILITY CHECKING
    // ================================

    // Check if user meets point requirements (regardless of rank lock)
    static checkPointRequirements(user) {
        const currentRank = this.getRankByLevel(user.rankLevel || 1, user.unit || 'SWAT');
        const nextRank = this.getNextRank(user.rankLevel || 1, user.unit || 'SWAT');
        
        if (!nextRank) {
            return {
                pointsMet: false,
                reason: 'Already at maximum rank',
                maxRank: true,
                currentRank,
                nextRank: null
            };
        }

        // For hand-picked ranks
        if (nextRank.handPicked) {
            return {
                pointsMet: false,
                reason: `${nextRank.name} is hand-picked only`,
                handPickedOnly: true,
                currentRank,
                nextRank
            };
        }

        // Check rank points
        const rankPoints = user.rankPoints || 0;
        const pointsRequired = nextRank.pointsRequired;
        const hasEnoughPoints = rankPoints >= pointsRequired;
        
        console.log(`📊 Point requirements check for ${user.username}: ${rankPoints}/${pointsRequired} rank points, met: ${hasEnoughPoints}`);
        
        return {
            pointsMet: hasEnoughPoints,
            rankPoints,
            pointsRequired,
            currentRank,
            nextRank,
            reason: hasEnoughPoints ? 'Point requirements met!' : `Need ${pointsRequired - rankPoints} more rank points`
        };
    }

    // FIXED: Check promotion eligibility with corrected rank lock logic
    static checkPromotionEligibility(user) {
        const currentRank = this.getRankByLevel(user.rankLevel || 1, user.unit || 'SWAT');
        const nextRank = this.getNextRank(user.rankLevel || 1, user.unit || 'SWAT');
        
        if (!nextRank) {
            return {
                eligible: false,
                reason: 'Already at maximum rank',
                maxRank: true,
                currentRank,
                nextRank: null
            };
        }
    
        // ALWAYS calculate requirements for progress bar display
        const rankPoints = user.rankPoints || 0;
        const pointsRequired = nextRank.pointsRequired;
        const hasEnoughPoints = rankPoints >= pointsRequired;
        
        const requirements = {
            pointsRequired,
            currentPoints: rankPoints,
            pointsRemaining: Math.max(0, pointsRequired - rankPoints),
            met: hasEnoughPoints
        };
    
        // Check if user is rank locked
        const isRankLocked = this.isUserRankLocked(user);
        
        if (isRankLocked) {
            const lockStatus = this.checkRankLockExpiry(user);
            const lockExpiry = new Date(user.rankLockUntil);
            const estTime = lockExpiry.toLocaleString('en-US', { 
                timeZone: 'America/New_York',
                weekday: 'short',
                month: 'short', 
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
                timeZoneName: 'short'
            });
            
            console.log(`🔒 User ${user.username} is rank locked until ${estTime}`);
            
            return {
                eligible: false,
                reason: `Rank locked until ${estTime}`,
                rankLocked: true,
                daysRemaining: lockStatus.daysRemaining,
                hoursRemaining: lockStatus.hoursRemaining,
                lockExpiryFormatted: estTime,
                discordTimestamp: lockStatus.discordTimestamp,
                currentRank,
                nextRank,
                requirements
            };
        }
    
        // For hand-picked ranks
        if (nextRank.handPicked) {
            return {
                eligible: false,
                reason: `${nextRank.name} is hand-picked only`,
                handPickedOnly: true,
                currentRank,
                nextRank,
                requirements
            };
        }
        
        console.log(`📊 Eligibility check for ${user.username}: ${rankPoints}/${pointsRequired} rank points, locked: false, eligible: ${hasEnoughPoints}`);
        
        return {
            eligible: hasEnoughPoints,
            reason: hasEnoughPoints ? 'Ready for promotion!' : `Need ${pointsRequired - rankPoints} more rank points`,
            currentRank,
            nextRank,
            requirements
        };
    }

    // Check if user is currently rank locked
    static isUserRankLocked(user) {
        if (!user.rankLockUntil) return false;
        
        const nowUTC = new Date();
        const lockExpiryUTC = new Date(user.rankLockUntil);
        
        return lockExpiryUTC > nowUTC;
    }

    // ================================
    // RANK FORMATTING & DISPLAY
    // ================================

    // Format rank display with emoji
    static formatRank(user) {
        const rank = this.getRankByLevel(user.rankLevel || 1, user.unit || 'SWAT');
        return rank.emoji ? `${rank.emoji} ${rank.name}` : rank.name;
    }

    // Get just the emoji for a rank level
    static getRankEmoji(level, unit = 'SWAT') {
        const rank = this.getRankByLevel(level, unit);
        return rank.emoji || '';
    }

    // Check if rank is supervisor or higher (has emoji)
    static isSupervisorOrHigher(level) {
        return level >= 6; // Tactical Operator / Medical Master Sergeant and above
    }

    // Check if rank is HR (hand-picked leadership)
    static isHRRank(level) {
        return level >= 9; // Executive Operator / Board of Medicine and above
    }

    // ================================
    // RANK PROGRESS & BARS
    // ================================

    // Calculate rank progress percentage
    static getRankProgress(user) {
        const eligibility = this.checkPromotionEligibility(user);
        
        if (eligibility.maxRank) return { percentage: 100, isMaxRank: true };
        if (eligibility.handPickedOnly) return { percentage: 100, isHandPicked: true };
        
        if (!eligibility.requirements) {
            return { 
                percentage: 0,
                current: 0,
                required: 0,
                remaining: 0
            };
        }
        
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
        
        const currentPoints = progress.current || 0;
        const requiredPoints = progress.required || 1;
        const percentage = progress.percentage || 0;
        
        const filledLength = Math.floor((percentage / 100) * length);
        const emptyLength = length - filledLength;
        
        const filledBar = '█'.repeat(Math.max(0, filledLength));
        const emptyBar = '░'.repeat(Math.max(0, emptyLength));
        
        return `[${filledBar}${emptyBar}] ${currentPoints}/${requiredPoints} pts (${percentage}%)`;
    }

    // ================================
    // RANK LOCK MANAGEMENT
    // ================================

    // Apply rank lock when user gets promoted
    static applyRankLock(user, newRankLevel) {
        const newRank = this.getRankByLevel(newRankLevel, user.unit || 'SWAT');
        
        if (newRank.rankLockDays > 0) {
            const lockDate = new Date();
            lockDate.setUTCDate(lockDate.getUTCDate() + newRank.rankLockDays);
            lockDate.setUTCHours(6, 0, 0, 0); // 6 AM UTC for consistency
            
            console.log(`🔒 Applied ${newRank.rankLockDays} day lock until ${lockDate.toISOString()}`);
            
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
        if (!user.rankLockUntil) {
            return { 
                expired: true,
                needsNotification: false
            };
        }
        
        const nowUTC = new Date();
        const lockExpiryUTC = new Date(user.rankLockUntil);
        
        const hasExpired = lockExpiryUTC <= nowUTC;
        
        if (hasExpired) {
            return {
                expired: true,
                needsNotification: !user.rankLockNotified
            };
        }
        
        // Lock is still active
        const timeDiffMs = lockExpiryUTC.getTime() - nowUTC.getTime();
        const hoursRemaining = Math.ceil(timeDiffMs / (1000 * 60 * 60));
        const daysRemaining = Math.ceil(timeDiffMs / (1000 * 60 * 60 * 24));
        
        const discordTimestamp = Math.floor(lockExpiryUTC.getTime() / 1000);
        
        const estTime = lockExpiryUTC.toLocaleString('en-US', { 
            timeZone: 'America/New_York',
            weekday: 'short',
            month: 'short', 
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZoneName: 'short'
        });
        
        return {
            expired: false,
            daysRemaining,
            hoursRemaining,
            exactExpiryTime: lockExpiryUTC,
            discordTimestamp,
            estTimeFormatted: estTime
        };
    }

    // ================================
    // UNIT UTILITIES
    // ================================

    // Get unit color for embeds
    static getUnitColor(unit) {
        return unit === 'CMU' ? '#ff0000' : '#0099ff'; // Red for CMU, Blue for SWAT
    }

    // Get unit emoji
    static getUnitEmoji(unit) {
        return unit === 'CMU' ? '🏥' : '🛡️';
    }

    // Validate unit
    static isValidUnit(unit) {
        return unit === 'SWAT' || unit === 'CMU';
    }

    // ================================
    // LEGACY COMPATIBILITY FUNCTIONS
    // ================================

    // Check if rank is Executive or higher (HR tier)
    static isExecutiveOrHigher(rankLevel, unit = 'SWAT') {
        // HR tier is levels 9-10 for both divisions
        return rankLevel >= 9;
    }

    // Check if a rank is hand-picked
    static isHandPickedRank(rankLevel, unit = 'SWAT') {
        const rank = this.getRankByLevel(rankLevel, unit);
        return rank ? rank.handPicked : false;
    }
}

module.exports = RankSystem;