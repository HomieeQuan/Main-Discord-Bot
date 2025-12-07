// utils/quotaSystem.js - UPDATED: Dual-division quota system with new requirements
const RankSystem = require('./rankSystem');

class QuotaSystem {
    // NEW: Rank-based quota structure (same for both SWAT and CMU)
    static quotaByRankLevel = {
        // Operational Tier
        1: 10,   // Probationary / Responder In Training: 10 points
        2: 15,   // Junior Operator / Field Medic: 15 points
        3: 20,   // Experienced Operator / Junior Field Medic: 20 points
        4: 20,   // Senior Operator / Senior Field Medic: 20 points
        5: 25,   // Specialized Operator / Specialist: 25 points
        
        // Supervisor Tier
        6: 30,   // Tactical Operator / Medical Master Sergeant: 30 points
        7: 30,   // Advanced Operator / Emergency Coordinator: 30 points
        8: 30,   // Elite Operator / Chief Medical Officer: 30 points
        
        // HR Tier (Both have 20 point quota)
        9: 20,   // Executive Operator / Board of Medicine: 20 POINTS
        10: 20   // Senior Executive Operator / Medical Director: 20 POINTS
    };

    // Get quota for a specific rank level
    static getQuotaForRank(rankLevel) {
        return this.quotaByRankLevel[rankLevel] || 10; // Default to 10 if rank not found
    }

    // Get quota for a user based on their current rank
    static getUserQuota(user) {
        const rankLevel = user.rankLevel || 1;
        return this.getQuotaForRank(rankLevel);
    }

    // Check if user has completed their quota
    static isQuotaCompleted(user) {
        const userQuota = this.getUserQuota(user);
        return user.weeklyPoints >= userQuota;
    }

    // Update user's quota based on their current rank
    static updateUserQuota(user) {
        const newQuota = this.getUserQuota(user);
        const oldQuota = user.weeklyQuota;
        
        user.weeklyQuota = newQuota;
        user.quotaCompleted = this.isQuotaCompleted(user);
        
        return {
            updated: oldQuota !== newQuota,
            oldQuota,
            newQuota,
            completed: user.quotaCompleted
        };
    }

    // Bulk update all users' quotas (for system-wide quota fixes)
    static async updateAllUserQuotas() {
        try {
            const SWATUser = require('../models/SWATUser');
            
            console.log('🔧 Starting bulk quota update with NEW quota requirements...');
            
            const users = await SWATUser.find({});
            let updatedCount = 0;
            let completionChanges = 0;
            const updateResults = [];
            
            for (const user of users) {
                const result = this.updateUserQuota(user);
                
                if (result.updated) {
                    updatedCount++;
                    updateResults.push({
                        username: user.username,
                        division: user.division || 'SWAT',
                        rankLevel: user.rankLevel,
                        oldQuota: result.oldQuota,
                        newQuota: result.newQuota,
                        wasCompleted: user.weeklyPoints >= result.oldQuota,
                        nowCompleted: result.completed
                    });
                    
                    // Check if completion status changed
                    const wasCompleted = user.weeklyPoints >= result.oldQuota;
                    if (wasCompleted !== result.completed) {
                        completionChanges++;
                    }
                }
                
                await user.save();
            }
            
            console.log(`✅ Bulk quota update complete with NEW requirements:`);
            console.log(`   - Total users: ${users.length}`);
            console.log(`   - Quotas updated: ${updatedCount}`);
            console.log(`   - Completion status changes: ${completionChanges}`);
            
            if (updateResults.length > 0) {
                console.log('📊 Quota changes:');
                updateResults.forEach(result => {
                    console.log(`   - [${result.division}] ${result.username}: ${result.oldQuota} → ${result.newQuota} points`);
                });
            }
            
            return {
                success: true,
                totalUsers: users.length,
                updated: updatedCount,
                completionChanges,
                updateResults
            };
            
        } catch (error) {
            console.error('❌ Bulk quota update error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get quota statistics for all ranks and divisions
    static getQuotaStatistics() {
        const stats = {
            byDivision: {
                SWAT: {},
                CMU: {}
            },
            totalRanks: 20, // 10 SWAT + 10 CMU
            averageQuota: 0
        };

        let totalQuota = 0;
        let rankCount = 0;

        // SWAT ranks
        for (let level = 1; level <= 10; level++) {
            const rank = RankSystem.getRankByLevel(level, 'SWAT');
            const quota = this.getQuotaForRank(level);
            
            stats.byDivision.SWAT[rank.name] = {
                level,
                quota,
                tier: rank.tier
            };
            
            totalQuota += quota;
            rankCount++;
        }

        // CMU ranks
        for (let level = 1; level <= 10; level++) {
            const rank = RankSystem.getRankByLevel(level, 'CMU');
            const quota = this.getQuotaForRank(level);
            
            stats.byDivision.CMU[rank.name] = {
                level,
                quota,
                tier: rank.tier
            };
            
            totalQuota += quota;
            rankCount++;
        }

        stats.averageQuota = rankCount > 0 ? Math.round(totalQuota / rankCount) : 0;

        return stats;
    }

    // Get human-readable quota description for a rank
    static getQuotaDescription(rankLevel, division = 'SWAT') {
        const quota = this.getQuotaForRank(rankLevel);
        const rank = RankSystem.getRankByLevel(rankLevel, division);
        
        return `${RankSystem.formatRank({ rankLevel, rankName: rank.name, division })} - ${quota} points required`;
    }

    // Check if a user needs quota recalculation (after rank change)
    static needsQuotaRecalculation(user) {
        const expectedQuota = this.getUserQuota(user);
        return user.weeklyQuota !== expectedQuota;
    }

    // Get all users who need quota updates
    static async getUsersNeedingQuotaUpdate() {
        try {
            const SWATUser = require('../models/SWATUser');
            
            const users = await SWATUser.find({});
            const needingUpdate = [];
            
            for (const user of users) {
                if (this.needsQuotaRecalculation(user)) {
                    const expectedQuota = this.getUserQuota(user);
                    needingUpdate.push({
                        username: user.username,
                        division: user.division || 'SWAT',
                        currentQuota: user.weeklyQuota,
                        expectedQuota,
                        rankLevel: user.rankLevel
                    });
                }
            }
            
            return needingUpdate;
            
        } catch (error) {
            console.error('❌ Error checking users needing quota update:', error);
            return [];
        }
    }

    // Apply quota update for weekly reset with rank-based quotas
    static async applyWeeklyQuotaReset() {
        try {
            const SWATUser = require('../models/SWATUser');
            
            console.log('🔄 Applying weekly quota reset with rank-based quotas...');
            
            // Update all users with current rank-based quotas
            const users = await SWATUser.find({});
            let updatedCount = 0;
            
            for (const user of users) {
                const newQuota = this.getUserQuota(user);
                
                // Update quota and reset weekly stats
                user.weeklyQuota = newQuota;
                user.weeklyPoints = 0;
                user.weeklyEvents = 0;
                user.quotaCompleted = false;
                user.dailyPointsToday = 0;
                user.lastDailyReset = new Date();
                user.previousWeeklyPoints = 0;
                
                await user.save();
                updatedCount++;
            }
            
            console.log(`✅ Weekly quota reset complete: ${updatedCount} users updated with rank-based quotas`);
            console.log(`📊 Quota structure: Operational=10-25pts, Supervisor=30pts, HR=25pts`);
            
            return {
                success: true,
                usersUpdated: updatedCount
            };
            
        } catch (error) {
            console.error('❌ Weekly quota reset error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // NEW: Get quota breakdown by tier
    static getQuotaByTier() {
        return {
            operational: {
                levels: [1, 2, 3, 4, 5],
                quotas: [10, 15, 20, 20, 25],
                description: 'Entry to mid-level operators'
            },
            supervisor: {
                levels: [6, 7, 8],
                quotas: [30, 30, 30],
                description: 'Leadership and tactical supervision'
            },
            hr: {
                levels: [9, 10],
                quotas: [25, 25],
                description: 'Executive leadership (hand-picked)'
            }
        };
    }

    // NEW: Get division-specific quota info
    static getDivisionQuotaInfo(division = 'SWAT') {
        const ranks = RankSystem.getAllRanks(division);
        return ranks.map(rank => ({
            level: rank.level,
            name: rank.name,
            quota: this.getQuotaForRank(rank.level),
            tier: rank.tier,
            emoji: rank.emoji
        }));
    }
}

module.exports = QuotaSystem;