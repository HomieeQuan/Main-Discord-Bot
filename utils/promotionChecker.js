// utils/promotionChecker.js - Automatic promotion eligibility detection and management
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const RankSystem = require('./rankSystem');

class PromotionChecker {
    // Check and update promotion eligibility for a user after event submission
    static async checkPromotionEligibility(userId) {
        try {
            const user = await SWATUser.findOne({ discordId: userId });
            if (!user) return null;

            const eligibility = RankSystem.checkPromotionEligibility(user);
            
            // Update eligibility status
            const wasEligible = user.promotionEligible;
            const isNowEligible = eligibility.eligible;
            
            user.promotionEligible = isNowEligible;
            user.lastPromotionCheck = new Date();
            
            if (!wasEligible && isNowEligible) {
                // User just became eligible for promotion!
                await user.save();
                
                console.log(`🎯 PROMOTION ELIGIBLE: ${user.username} is now eligible for promotion to ${eligibility.nextRank.name}`);
                
                return {
                    newlyEligible: true,
                    user: user,
                    currentRank: eligibility.currentRank,
                    nextRank: eligibility.nextRank,
                    requirements: eligibility.requirements
                };
                
            } else if (wasEligible && !isNowEligible) {
                // User lost eligibility (shouldn't happen often, but handle it)
                await user.save();
                
                console.log(`⚠️ PROMOTION LOST: ${user.username} is no longer eligible for promotion`);
                
                return {
                    lostEligibility: true,
                    user: user,
                    reason: eligibility.reason
                };
            } else {
                // No change in eligibility status
                await user.save();
                return {
                    newlyEligible: false,
                    eligible: isNowEligible,
                    user: user,
                    eligibility: eligibility
                };
            }
            
        } catch (error) {
            console.error('❌ Promotion eligibility check error:', error);
            return null;
        }
    }

    // Bulk check all users for promotion eligibility (run daily)
    static async checkAllUsersEligibility() {
        try {
            console.log('🔄 Running bulk promotion eligibility check...');
            
            const users = await SWATUser.find({});
            let newlyEligible = 0;
            let totalEligible = 0;
            let rankLockExpired = 0;
            const eligibleUsers = [];
            const lockExpiredUsers = [];
            
            for (const user of users) {
                // Check promotion eligibility
                const result = await this.checkPromotionEligibility(user.discordId);
                
                if (result && result.newlyEligible) {
                    newlyEligible++;
                    eligibleUsers.push({
                        username: user.username,
                        currentRank: result.currentRank.name,
                        nextRank: result.nextRank.name
                    });
                }
                
                if (result && result.eligible) {
                    totalEligible++;
                }
                
                // Check rank lock expiry
                const lockStatus = RankSystem.checkRankLockExpiry(user);
                if (lockStatus.expired && lockStatus.needsNotification) {
                    rankLockExpired++;
                    lockExpiredUsers.push(user);
                    
                    // Mark as notified to prevent spam
                    user.rankLockNotified = true;
                    await user.save();
                }
            }
            
            console.log(`✅ Bulk eligibility check complete:`);
            console.log(`   - Total users checked: ${users.length}`);
            console.log(`   - Currently eligible: ${totalEligible}`);
            console.log(`   - Newly eligible: ${newlyEligible}`);
            console.log(`   - Rank locks expired: ${rankLockExpired}`);
            
            if (eligibleUsers.length > 0) {
                console.log('🎯 Newly eligible users:');
                eligibleUsers.forEach(user => {
                    console.log(`   - ${user.username}: ${user.currentRank} → ${user.nextRank}`);
                });
            }
            
            return {
                totalChecked: users.length,
                totalEligible,
                newlyEligible,
                rankLockExpired,
                eligibleUsers,
                lockExpiredUsers
            };
            
        } catch (error) {
            console.error('❌ Bulk eligibility check error:', error);
            return null;
        }
    }

    // Process a promotion (called by HR commands)
    static async processPromotion(user, hrUser, promotionType = 'standard', reason = 'Standard promotion') {
        try {
            const unit = user.unit || 'SWAT';
            const oldRank = RankSystem.getRankByLevel(user.rankLevel, unit);
            const eligibility = RankSystem.checkPromotionEligibility(user);
            
            if (!eligibility.nextRank) {
                throw new Error('User is already at maximum rank');
            }
            
            const newRank = eligibility.nextRank;
            
            // Store promotion in history before updating
            const promotionRecord = {
                fromRank: {
                    name: oldRank.name,
                    level: oldRank.level
                },
                toRank: {
                    name: newRank.name,
                    level: newRank.level
                },
                promotedAt: new Date(),
                promotedBy: {
                    hrUserId: hrUser.id,
                    hrUsername: hrUser.username
                },
                promotionType: promotionType,
                reason: reason,
                rankPointsAtPromotion: user.rankPoints,
                allTimePointsAtPromotion: user.allTimePoints
            };
            
            // Apply rank lock
            const lockResult = RankSystem.applyRankLock(user, newRank.level);
            if (lockResult.locked) {
                promotionRecord.rankLockApplied = {
                    days: lockResult.lockDays,
                    until: lockResult.lockUntil
                };
            }
            
            // Update user rank
            user.rankName = newRank.name;
            user.rankLevel = newRank.level;
            user.rankPoints = 0; // RESET rank points for next promotion
            user.promotionEligible = false;
            
            // Apply rank lock
            if (lockResult.locked) {
                user.rankLockUntil = lockResult.lockUntil;
                user.rankLockNotified = false;
            }
            
            // Add to promotion history
            user.promotionHistory.push(promotionRecord);
            
            await user.save();
            
            // Create audit log
            const auditLog = new EventLog({
                userId: user.discordId,
                username: user.username,
                eventType: 'promotion',
                description: `PROMOTED: ${oldRank.name} → ${newRank.name} (${promotionType})`,
                pointsAwarded: 0,
                boostedPoints: false,
                screenshotUrl: 'HR_PROMOTION',
                hrAction: {
                    hrUser: hrUser.id,
                    hrUsername: hrUser.username,
                    action: `promotion_${promotionType}`,
                    reason: reason,
                    oldRank: oldRank.name,
                    newRank: newRank.name,
                    rankLockApplied: lockResult.locked ? lockResult.lockDays : 0
                }
            });
            
            await auditLog.save();
            
            console.log(`🎖️ PROMOTION: ${user.username} promoted from ${oldRank.name} to ${newRank.name} by ${hrUser.username} (${promotionType})`);
            
            return {
                success: true,
                oldRank,
                newRank,
                promotionRecord,
                lockResult
            };
            
        } catch (error) {
            console.error('❌ Process promotion error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    // Get summary of all users eligible for promotion
    // Get summary of all users eligible for promotion - FIXED VERSION
    static async getEligibilityReport() {
        try {
            console.log('🔍 Starting eligibility report generation...');
            
            // Get ALL users and check eligibility in real-time (don't rely on promotionEligible field)
            const allUsers = await SWATUser.find({
                rankLevel: { $lt: 10 } // Don't include max rank (level 10 for both divisions)
            });
            
            console.log(`📊 Checking ${allUsers.length} users for eligibility...`);
            
            const report = {
                totalEligible: 0,
                byRank: {},
                eligibleUsers: []
            };
            
            for (const user of allUsers) {
                // Check eligibility in real-time using the same logic as review command
                const eligibility = RankSystem.checkPromotionEligibility(user);
                
                console.log(`🔍 ${user.username}: eligible=${eligibility.eligible}, locked=${eligibility.rankLocked}, reason="${eligibility.reason}"`);
                
                // Include users who are eligible OR have enough points but are rank-locked
                const hasEnoughPoints = eligibility.requirements && eligibility.requirements.met;
                const isRankLocked = eligibility.rankLocked;
                
                if ((eligibility.eligible || (hasEnoughPoints && isRankLocked)) && eligibility.nextRank) {
                    report.totalEligible++;
                    
                    // Group by target rank
                    const targetRank = eligibility.nextRank.name;
                    if (!report.byRank[targetRank]) {
                        report.byRank[targetRank] = 0;
                    }
                    report.byRank[targetRank]++;
                    
                    report.eligibleUsers.push({
                        username: user.username,
                        discordId: user.discordId,
                        division: user.unit || 'SWAT',
                        currentRank: eligibility.currentRank.name,
                        nextRank: eligibility.nextRank.name,
                        rankPoints: user.rankPoints || 0,
                        allTimePoints: user.allTimePoints || 0,
                        isRankLocked: isRankLocked,
                        lockExpiry: isRankLocked ? user.rankLockUntil : null,
                        readySince: user.lastPromotionCheck || user.updatedAt
                    });
                    
                    console.log(`✅ ${user.username} is ELIGIBLE for promotion to ${targetRank}`);
                }
            }
            
            // Sort by rank level (lowest first) then by points (highest first)
            report.eligibleUsers.sort((a, b) => {
                const rankA = RankSystem.getRankByName(a.currentRank);
                const rankB = RankSystem.getRankByName(b.currentRank);
                
                if (rankA.level !== rankB.level) {
                    return rankA.level - rankB.level;
                }
                return b.allTimePoints - a.allTimePoints;
            });
            
            console.log(`✅ Eligibility report complete: ${report.totalEligible} users eligible`);
            if (report.eligibleUsers.length > 0) {
                console.log('🎯 Eligible users:');
                report.eligibleUsers.forEach(user => {
                    console.log(`   - ${user.username}: ${user.currentRank} → ${user.nextRank} (${user.rankPoints} pts)`);
                });
            }
            
            return report;
            
        } catch (error) {
            console.error('❌ Eligibility report error:', error);
            return {
                totalEligible: 0,
                byRank: {},
                eligibleUsers: [],
                error: error.message
            };
        }
    }

    // Create promotion notification for newly eligible users
    static createEligibilityNotification(result) {
        if (!result || !result.newlyEligible) return null;
        
        const nextRank = result.nextRank;
        const currentRank = result.currentRank;
        const rankEmoji = RankSystem.getRankEmoji(nextRank.level);
        
        return {
            title: '🎯 Promotion Eligible!',
            description: `Congratulations! You're now eligible for promotion from **${RankSystem.formatRank(result.user)}** to **${rankEmoji} ${nextRank.name}**!`,
            fields: [
                {
                    name: '📋 Next Steps',
                    value: 'HR has been notified. Your promotion will be reviewed and processed by the HR team.',
                    inline: false
                },
                {
                    name: '✅ Requirements Met',
                    value: `Rank Points: ${result.requirements.currentPoints}/${result.requirements.pointsRequired}`,
                    inline: false
                }
            ],
            color: '#00ff00'
        };
    }

    // Create rank lock expiry notification
    static createLockExpiryNotification(user) {
        const eligibility = RankSystem.checkPromotionEligibility(user);
        
        if (!eligibility.nextRank) {
            return {
                title: '🔓 Rank Lock Expired',
                description: `Your rank lock has expired! You are now at the maximum rank: **${RankSystem.formatRank(user)}**`,
                color: '#gold'
            };
        }
        
        return {
            title: '🔓 Rank Lock Expired',
            description: `Your rank lock has expired! You can now work toward promotion to **${RankSystem.getRankEmoji(eligibility.nextRank.level)} ${eligibility.nextRank.name}**`,
            fields: [
                {
                    name: '🎯 Next Promotion',
                    value: `You need ${eligibility.nextRank.pointsRequired} rank points for promotion to ${eligibility.nextRank.name}`,
                    inline: false
                }
            ],
            color: '#00ff00'
        };
    }
}

module.exports = PromotionChecker;