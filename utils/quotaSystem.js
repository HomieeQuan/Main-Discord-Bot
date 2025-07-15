// utils/quotaSystem.js - NEW rank-based quota management system
const RankSystem = require('./rankSystem');

class QuotaSystem {
    // Rank-based quota structure as specified in requirements
    static quotaByRankLevel = {
        // Probationary
        1: 10,   // Probationary Operator: 10 points
        
        // Junior-Senior ranks
        2: 20,   // Junior Operator: 20 points
        3: 20,   // Experienced Operator: 20 points
        4: 20,   // Senior Operator: 20 points
        
        // Specialized-Elite ranks
        5: 25,   // Specialized Operator: 25 points
        6: 25,   // Elite Operator: 25 points
        
        // Elite I-IV ranks
        7: 30,   // Elite Operator I Class: 30 points
        8: 30,   // Elite Operator II Class: 30 points
        9: 30,   // Elite Operator III Class: 30 points
        10: 30,  // Elite Operator IV Class: 30 points
        
        // Executive+ ranks (no quota)
        11: 0,   // Executive Operator: No quota
        12: 0,   // Senior Executive Operator: No quota
        13: 0,   // Operations Chief: No quota
        14: 0,   // Deputy Commander: No quota
        15: 0    // SWAT Commander: No quota
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
        
        // Executive+ ranks have no quota requirement
        if (userQuota === 0) return true;
        
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
            
            console.log('🔧 Starting bulk quota update...');
            
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
            
            console.log(`✅ Bulk quota update complete:`);
            console.log(`   - Total users: ${users.length}`);
            console.log(`   - Quotas updated: ${updatedCount}`);
            console.log(`   - Completion status changes: ${completionChanges}`);
            
            if (updateResults.length > 0) {
                console.log('📊 Quota changes:');
                updateResults.forEach(result => {
                    console.log(`   - ${result.username}: ${result.oldQuota} → ${result.newQuota} points`);
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

    // Get quota statistics for all ranks
    static getQuotaStatistics() {
        const stats = {
            byRank: {},
            totalRanks: 15,
            ranksWithQuota: 0,
            ranksWithoutQuota: 0,
            averageQuota: 0
        };

        let totalQuota = 0;
        let ranksWithQuota = 0;

        for (let level = 1; level <= 15; level++) {
            const rank = RankSystem.getRankByLevel(level);
            const quota = this.getQuotaForRank(level);
            
            stats.byRank[rank.name] = {
                level,
                quota,
                hasQuota: quota > 0
            };
            
            if (quota > 0) {
                totalQuota += quota;
                ranksWithQuota++;
                stats.ranksWithQuota++;
            } else {
                stats.ranksWithoutQuota++;
            }
        }

        stats.averageQuota = ranksWithQuota > 0 ? Math.round(totalQuota / ranksWithQuota) : 0;

        return stats;
    }

    // Get human-readable quota description for a rank
    static getQuotaDescription(rankLevel) {
        const quota = this.getQuotaForRank(rankLevel);
        const rank = RankSystem.getRankByLevel(rankLevel);
        
        if (quota === 0) {
            return `${RankSystem.formatRank({ rankLevel, rankName: rank.name })} - No quota required (Executive+)`;
        }
        
        return `${RankSystem.formatRank({ rankLevel, rankName: rank.name })} - ${quota} points required`;
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
}

module.exports = QuotaSystem;