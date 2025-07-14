// This class handles all point calculations
class PointCalculator {
    // Point values for each event type (based on your requirements)
    static eventPoints = {
        'patrol_30min': 1,
        'attend_event': 2,
        'attend_swat_event': 3,
        'host_swat_event': 4,
        'backup_request': 3,
        'ghost_protection_good': 4,
        'ghost_protection_bad': 2,
        'tet_private': 1,
        'tet_public': 2,
        'slrpd_inspection': 2,
        'combat_training': 1,
        'swat_inspection': 3,
        'gang_deployment': 4
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
        'gang_deployment': 'Gang Deployment'
    };

    // Calculate points for an event (with optional booster bonus)
    static calculatePoints(eventType, isBooster = false) {
        const basePoints = this.eventPoints[eventType] || 0;
        return isBooster ? basePoints * 2 : basePoints;
    }

    // Get human-readable name for an event type
    static getEventName(eventType) {
        return this.eventNames[eventType] || eventType;
    }

    // Get all available event types (for command choices)
    static getAllEventTypes() {
        return Object.keys(this.eventPoints);
    }
}

module.exports = PointCalculator;