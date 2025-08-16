// utils/pointCalculator.js - UPDATED with new Warrant Execution events
class PointCalculator {
    // UPDATED point values for each event type
    static eventPoints = {
        'patrol_30min': 1,
        'attend_event': 2,
        'attend_swat_event': 3,
        'host_swat_event': 4,
        'backup_request': 3,
        'ghost_protection_good': 4, 
        'ghost_protection_bad': 2,
        'tet_private': 2,              
        'tet_public': 3,               
        'slrpd_inspection': 2,
        'combat_training': 2,          
        'swat_inspection': 3,
        'gang_deployment': 4,
        // NEW: Warrant Execution events
        'warrant_execution_arrest': 10,  // High-value target arrested alive
        'warrant_execution_kill': 6      // High-value target killed
    };

    // Human-readable names for each event type
    static eventNames = {
        'patrol_30min': '30-Minute Patrol',
        'attend_event': 'Attending an Event',
        'attend_swat_event': 'Attending SWAT Event',
        'host_swat_event': 'Co-Hosting/Hosting SWAT Event',
        'backup_request': 'Backup Request',
        'ghost_protection_good': 'GHOST Protection [Good Rating]',
        'ghost_protection_bad': 'GHOST Protection [Bad Rating]',
        'tet_private': 'TET [Private Tryout]',
        'tet_public': 'TET [Public Tryout]',
        'slrpd_inspection': 'SLRPD Inspection Ceremony',
        'combat_training': 'Combat Training',
        'swat_inspection': 'SWAT Inspection Ceremony',
        'gang_deployment': 'Gang Deployment',
        // NEW: Warrant Execution events
        'warrant_execution_arrest': 'Warrant Execution [Arrest]',
        'warrant_execution_kill': 'Warrant Execution [Kill]'
    };

    // Calculate base points for an event (without booster multiplier)
    static calculateBasePoints(eventType) {
        return this.eventPoints[eventType] || 0;
    }

    // Calculate points for an event with optional booster bonus
    static calculatePoints(eventType, isBooster = false) {
        const basePoints = this.calculateBasePoints(eventType);
        return isBooster ? basePoints * 2 : basePoints;
    }

    // NEW: Calculate total points including attendees bonus
    static calculatePointsWithAttendeesBonus(eventType, isBooster = false, attendeesPassed = 0) {
        const basePoints = this.calculateBasePoints(eventType);
        
        // Only tryouts get attendees bonus
        const isTryoutEvent = eventType === 'tet_private' || eventType === 'tet_public';
        const attendeesBonus = isTryoutEvent ? attendeesPassed : 0;
        
        // Total points before booster multiplier
        const totalBeforeBooster = basePoints + attendeesBonus;
        
        // Apply booster multiplier to the total (base + bonus)
        return isBooster ? totalBeforeBooster * 2 : totalBeforeBooster;
    }

    // NEW: Check if event type supports attendees bonus
    static supportsTryoutBonus(eventType) {
        return eventType === 'tet_private' || eventType === 'tet_public';
    }

    // NEW: Check if event type is a warrant execution
    static isWarrantExecution(eventType) {
        return eventType === 'warrant_execution_arrest' || eventType === 'warrant_execution_kill';
    }

    // Get human-readable name for an event type
    static getEventName(eventType) {
        return this.eventNames[eventType] || eventType;
    }

    // Get all available event types (for command choices)
    static getAllEventTypes() {
        return Object.keys(this.eventPoints);
    }

    // NEW: Get tryout-specific event types
    static getTryoutEventTypes() {
        return ['tet_private', 'tet_public'];
    }

    // NEW: Get warrant execution event types
    static getWarrantExecutionEventTypes() {
        return ['warrant_execution_arrest', 'warrant_execution_kill'];
    }

    // NEW: Calculate detailed breakdown for display purposes
    static getPointsBreakdown(eventType, isBooster = false, attendeesPassed = 0, quantity = 1) {
        const basePoints = this.calculateBasePoints(eventType);
        const isTryoutEvent = this.supportsTryoutBonus(eventType);
        const attendeesBonus = isTryoutEvent ? attendeesPassed : 0;
        
        const pointsPerEvent = basePoints + attendeesBonus;
        const multiplier = isBooster ? 2 : 1;
        const finalPointsPerEvent = pointsPerEvent * multiplier;
        const totalPoints = finalPointsPerEvent * quantity;
        
        return {
            basePoints,
            attendeesBonus,
            pointsPerEvent,
            multiplier,
            finalPointsPerEvent,
            quantity,
            totalPoints,
            isBooster,
            isTryoutEvent,
            isWarrantExecution: this.isWarrantExecution(eventType)
        };
    }

    // NEW: Format points breakdown for display
    static formatPointsBreakdown(breakdown) {
        let explanation = `${breakdown.basePoints} base`;
        
        if (breakdown.attendeesBonus > 0) {
            explanation += ` + ${breakdown.attendeesBonus} bonus (${breakdown.attendeesBonus} attendees passed)`;
        }
        
        explanation += ` = ${breakdown.pointsPerEvent} pts`;
        
        if (breakdown.isBooster) {
            explanation += ` × 2 (booster) = ${breakdown.finalPointsPerEvent} pts`;
        }
        
        if (breakdown.quantity > 1) {
            explanation += ` × ${breakdown.quantity} events = ${breakdown.totalPoints} total pts`;
        }
        
        return explanation;
    }
}

module.exports = PointCalculator;