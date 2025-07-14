// utils/healthMonitor.js
const SWATUser = require('../models/SWATUser');
const EventLog = require('../models/EventLog');
const mongoose = require('mongoose');

class HealthMonitor {
    // Check overall system health
    static async performHealthCheck() {
        const health = {
            timestamp: new Date().toISOString(),
            overall: 'healthy',
            checks: {}
        };

        try {
            // Database connectivity check
            health.checks.database = await this.checkDatabase();
            
            // Data integrity checks
            health.checks.dataIntegrity = await this.checkDataIntegrity();
            
            // Performance checks
            health.checks.performance = await this.checkPerformance();
            
            // Recent activity check
            health.checks.activity = await this.checkRecentActivity();
            
            // Determine overall health
            const failedChecks = Object.values(health.checks).filter(check => check.status !== 'healthy');
            if (failedChecks.length > 0) {
                health.overall = failedChecks.some(check => check.severity === 'critical') ? 'critical' : 'warning';
            }
            
            return health;
            
        } catch (error) {
            console.error('❌ Health check error:', error);
            return {
                timestamp: new Date().toISOString(),
                overall: 'critical',
                error: error.message
            };
        }
    }

    // Check database connectivity and status
    static async checkDatabase() {
        try {
            const dbState = mongoose.connection.readyState;
            const stateNames = ['disconnected', 'connected', 'connecting', 'disconnecting'];
            
            if (dbState === 1) {
                // Check response time
                const start = Date.now();
                await SWATUser.findOne().limit(1);
                const responseTime = Date.now() - start;
                
                return {
                    status: 'healthy',
                    details: {
                        state: stateNames[dbState],
                        responseTime: `${responseTime}ms`,
                        host: mongoose.connection.host,
                        name: mongoose.connection.name
                    }
                };
            } else {
                return {
                    status: 'critical',
                    severity: 'critical',
                    details: {
                        state: stateNames[dbState] || 'unknown',
                        message: 'Database not connected'
                    }
                };
            }
        } catch (error) {
            return {
                status: 'critical',
                severity: 'critical',
                error: error.message
            };
        }
    }

    // Check data integrity
    static async checkDataIntegrity() {
        try {
            const issues = [];
            
            // Check for users with negative points
            const negativeUsers = await SWATUser.countDocuments({
                $or: [
                    { weeklyPoints: { $lt: 0 } },
                    { allTimePoints: { $lt: 0 } }
                ]
            });
            
            if (negativeUsers > 0) {
                issues.push(`${negativeUsers} users with negative points`);
            }
            
            // Check for quota inconsistencies
            const quotaInconsistent = await SWATUser.countDocuments({
                $expr: {
                    $ne: [
                        '$quotaCompleted',
                        { $gte: ['$weeklyPoints', '$weeklyQuota'] }
                    ]
                }
            });
            
            if (quotaInconsistent > 0) {
                issues.push(`${quotaInconsistent} users with incorrect quota status`);
            }
            
            // Check for orphaned event logs (events without corresponding users)
            const userIds = await SWATUser.distinct('discordId');
            const orphanedEvents = await EventLog.countDocuments({
                userId: { $nin: userIds },
                eventType: { $ne: 'hr_point_adjustment' } // Exclude HR adjustments
            });
            
            if (orphanedEvents > 0) {
                issues.push(`${orphanedEvents} orphaned event logs`);
            }
            
            return {
                status: issues.length === 0 ? 'healthy' : 'warning',
                severity: issues.length > 5 ? 'critical' : 'warning',
                details: {
                    issuesFound: issues.length,
                    issues: issues
                }
            };
            
        } catch (error) {
            return {
                status: 'critical',
                severity: 'critical',
                error: error.message
            };
        }
    }

    // Check system performance
    static async checkPerformance() {
        try {
            const start = Date.now();
            
            // Test query performance
            await SWATUser.find({}).sort({ weeklyPoints: -1 }).limit(10);
            const queryTime = Date.now() - start;
            
            // Check memory usage
            const memUsage = process.memoryUsage();
            const memUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
            
            // Check collection sizes
            const userCount = await SWATUser.countDocuments();
            const eventCount = await EventLog.countDocuments();
            
            const warnings = [];
            if (queryTime > 1000) warnings.push('Slow database queries');
            if (memUsedMB > 512) warnings.push('High memory usage');
            if (eventCount > 50000) warnings.push('Large event log collection');
            
            return {
                status: warnings.length === 0 ? 'healthy' : 'warning',
                details: {
                    queryTime: `${queryTime}ms`,
                    memoryUsed: `${memUsedMB}MB`,
                    userCount,
                    eventCount,
                    warnings
                }
            };
            
        } catch (error) {
            return {
                status: 'critical',
                severity: 'critical',
                error: error.message
            };
        }
    }

    // Check recent activity
    static async checkRecentActivity() {
        try {
            const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            const recentEvents = await EventLog.countDocuments({
                submittedAt: { $gte: oneDayAgo }
            });
            
            const weeklyEvents = await EventLog.countDocuments({
                submittedAt: { $gte: oneWeekAgo }
            });
            
            const activeUsers = await EventLog.distinct('userId', {
                submittedAt: { $gte: oneWeekAgo }
            });
            
            const warnings = [];
            if (recentEvents === 0) warnings.push('No events in last 24 hours');
            if (weeklyEvents < 10) warnings.push('Low activity this week');
            
            return {
                status: warnings.length === 0 ? 'healthy' : 'warning',
                details: {
                    eventsToday: recentEvents,
                    eventsThisWeek: weeklyEvents,
                    activeUsersThisWeek: activeUsers.length,
                    warnings
                }
            };
            
        } catch (error) {
            return {
                status: 'critical',
                severity: 'critical',
                error: error.message
            };
        }
    }

    // Generate detailed health report
    static async generateHealthReport() {
        const health = await this.performHealthCheck();
        
        let report = `🏥 SWAT Bot Health Report - ${health.timestamp}\n`;
        report += `Overall Status: ${health.overall.toUpperCase()}\n\n`;
        
        if (health.checks) {
            for (const [checkName, result] of Object.entries(health.checks)) {
                report += `${checkName.toUpperCase()}:\n`;
                report += `  Status: ${result.status}\n`;
                
                if (result.details) {
                    for (const [key, value] of Object.entries(result.details)) {
                        if (Array.isArray(value)) {
                            report += `  ${key}: ${value.join(', ')}\n`;
                        } else {
                            report += `  ${key}: ${value}\n`;
                        }
                    }
                }
                
                if (result.error) {
                    report += `  Error: ${result.error}\n`;
                }
                
                report += '\n';
            }
        }
        
        return report;
    }
}

module.exports = HealthMonitor;