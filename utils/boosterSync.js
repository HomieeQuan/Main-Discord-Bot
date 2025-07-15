// utils/boosterSync.js - FIXED username display to use server nicknames
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const PermissionChecker = require('./permissionChecker');

class BoosterSync {
    // Sync booster status for a specific user
    static async syncUserBoosterStatus(member) {
        try {
            const user = await SWATUser.findOne({ discordId: member.id });
            if (!user) {
                // User not in database yet, they'll be created when they submit first event
                console.log(`ℹ️ User ${member.displayName || member.user.username} not in database yet, skipping booster sync`); // FIXED: Use server nickname
                return { changed: false, reason: 'user_not_found' };
            }

            const isCurrentlyBooster = PermissionChecker.isBooster(member);
            const wasBooster = user.isBooster;
            
            if (wasBooster !== isCurrentlyBooster) {
                // Status changed!
                user.isBooster = isCurrentlyBooster;
                
                // FIXED: Update username to current server nickname
                user.username = member.displayName || member.user.username;
                
                await user.save();
                
                // Log the change for audit purposes
                const auditLog = new EventLog({
                    userId: member.id,
                    username: member.displayName || member.user.username, // FIXED: Use server nickname
                    eventType: 'booster_status_change',
                    description: `Booster status ${isCurrentlyBooster ? 'GAINED' : 'LOST'} - Auto-sync`,
                    pointsAwarded: 0,
                    boostedPoints: false,
                    screenshotUrl: 'AUTO_BOOSTER_SYNC',
                    hrAction: {
                        hrUser: 'SYSTEM',
                        hrUsername: 'Auto-Sync',
                        action: isCurrentlyBooster ? 'booster_gained' : 'booster_lost',
                        reason: 'Automatic booster role synchronization'
                    }
                });
                
                await auditLog.save();
                
                console.log(`🔄 Booster status updated for ${user.username}: ${wasBooster ? 'WAS' : 'NOT'} booster → ${isCurrentlyBooster ? 'IS' : 'NOT'} booster`); // Uses updated server nickname
                
                return { 
                    changed: true, 
                    wasBooster, 
                    isBooster: isCurrentlyBooster,
                    username: user.username // Now contains server nickname
                };
            }
            
            // Even if booster status didn't change, update username to current server nickname
            const oldUsername = user.username;
            const newUsername = member.displayName || member.user.username;
            
            if (oldUsername !== newUsername) {
                user.username = newUsername;
                await user.save();
                console.log(`📝 Username updated for ${member.id}: ${oldUsername} → ${newUsername}`);
            }
            
            return { changed: false, reason: 'no_change' };
            
        } catch (error) {
            console.error('❌ Booster sync error for user:', member.displayName || member.user.username, error); // FIXED: Use server nickname
            return { changed: false, reason: 'error', error };
        }
    }

    // Sync all users' booster status (run periodically or on startup)
    static async syncAllBoosterStatuses(client) {
        try {
            console.log('🔄 Starting bulk booster status synchronization...');
            
            const guild = client.guilds.cache.first(); // Adjust if you have multiple guilds
            if (!guild) {
                console.error('❌ No guild found for booster sync');
                return { success: false, reason: 'no_guild' };
            }

            const users = await SWATUser.find({});
            let updatedCount = 0;
            let errorCount = 0;
            let usernameUpdates = 0;
            const updates = [];

            for (const user of users) {
                try {
                    const member = await guild.members.fetch(user.discordId);
                    const result = await this.syncUserBoosterStatus(member);
                    
                    if (result.changed) {
                        updatedCount++;
                        updates.push({
                            username: result.username,
                            change: result.isBooster ? 'gained' : 'lost'
                        });
                    }
                    
                    // Check if username was updated (even if booster status didn't change)
                    const currentDisplayName = member.displayName || member.user.username;
                    if (user.username !== currentDisplayName) {
                        usernameUpdates++;
                    }
                    
                } catch (fetchError) {
                    // User might have left the server
                    console.log(`⚠️ Could not fetch member ${user.username} (may have left server)`);
                    errorCount++;
                }
            }

            console.log(`✅ Bulk booster sync complete:`);
            console.log(`   - Total users checked: ${users.length}`);
            console.log(`   - Booster status updates: ${updatedCount}`);
            console.log(`   - Username updates: ${usernameUpdates}`);
            console.log(`   - Fetch errors (left server): ${errorCount}`);
            
            if (updates.length > 0) {
                console.log('📋 Booster status changes:');
                updates.forEach(update => {
                    console.log(`   - ${update.username}: ${update.change} booster status`);
                });
            }

            return {
                success: true,
                totalChecked: users.length,
                updated: updatedCount,
                usernameUpdates,
                errors: errorCount,
                changes: updates
            };
            
        } catch (error) {
            console.error('❌ Bulk booster sync error:', error);
            return { success: false, reason: 'error', error };
        }
    }

    // Check if a user's recent point calculations need adjustment due to booster status change
    static async auditBoosterPointCalculations(userId, wasBooster, isBooster) {
        try {
            if (wasBooster === isBooster) return; // No change, no audit needed
            
            // Get recent events (last 24 hours) to see if any need recalculation
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const recentEvents = await EventLog.find({
                userId: userId,
                submittedAt: { $gte: oneDayAgo },
                eventType: { $ne: 'booster_status_change' } // Exclude our own audit logs
            });

            if (recentEvents.length > 0) {
                // Get user for display name
                const user = await SWATUser.findOne({ discordId: userId });
                const displayName = user?.username || 'Unknown User';
                
                console.log(`⚠️ Booster status changed for user with ${recentEvents.length} recent events`);
                console.log(`   User: ${displayName}`); // Uses server nickname
                console.log(`   Note: Recent events may have been calculated with ${wasBooster ? 'boosted' : 'normal'} points`);
                console.log(`   Consider manual review if point recalculation is needed`);
            }
            
        } catch (error) {
            console.error('❌ Booster audit error:', error);
        }
    }

    // Utility: Get booster statistics
    static async getBoosterStatistics(client) {
        try {
            const users = await SWATUser.find({});
            const boosters = users.filter(u => u.isBooster);
            
            const stats = {
                totalUsers: users.length,
                totalBoosters: boosters.length,
                boosterPercentage: users.length > 0 ? Math.round((boosters.length / users.length) * 100) : 0,
                boosterTotalPoints: boosters.reduce((sum, u) => sum + u.weeklyPoints, 0),
                averageBoosterPoints: boosters.length > 0 ? Math.round(boosters.reduce((sum, u) => sum + u.weeklyPoints, 0) / boosters.length) : 0
            };
            
            return stats;
        } catch (error) {
            console.error('❌ Booster statistics error:', error);
            return null;
        }
    }

    // NEW: Utility method to sync usernames for all users (useful for maintenance)
    static async syncAllUsernames(client) {
        try {
            console.log('📝 Starting bulk username synchronization...');
            
            const guild = client.guilds.cache.first();
            if (!guild) {
                console.error('❌ No guild found for username sync');
                return { success: false, reason: 'no_guild' };
            }

            const users = await SWATUser.find({});
            let updatedCount = 0;
            let errorCount = 0;
            const updates = [];

            for (const user of users) {
                try {
                    const member = await guild.members.fetch(user.discordId);
                    const currentDisplayName = member.displayName || member.user.username;
                    
                    if (user.username !== currentDisplayName) {
                        const oldUsername = user.username;
                        user.username = currentDisplayName;
                        await user.save();
                        
                        updatedCount++;
                        updates.push({
                            discordId: user.discordId,
                            oldUsername,
                            newUsername: currentDisplayName
                        });
                        
                        console.log(`📝 Username updated: ${oldUsername} → ${currentDisplayName}`);
                    }
                    
                } catch (fetchError) {
                    console.log(`⚠️ Could not fetch member ${user.username} (may have left server)`);
                    errorCount++;
                }
            }

            console.log(`✅ Bulk username sync complete:`);
            console.log(`   - Total users checked: ${users.length}`);
            console.log(`   - Usernames updated: ${updatedCount}`);
            console.log(`   - Fetch errors (left server): ${errorCount}`);

            return {
                success: true,
                totalChecked: users.length,
                updated: updatedCount,
                errors: errorCount,
                updates
            };
            
        } catch (error) {
            console.error('❌ Bulk username sync error:', error);
            return { success: false, reason: 'error', error };
        }
    }
}

module.exports = BoosterSync;