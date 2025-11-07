/**
 * Memory Manager
 * Handles memory cleanup, caching, and optimization to reduce CPU usage
 */

var memoryManager = {

    /**
     * Clean up memory from dead creeps
     * Should be run periodically (every 10-50 ticks)
     */
    cleanDeadCreeps: function() {
        for(var name in Memory.creeps) {
            if(!Game.creeps[name]) {
                delete Memory.creeps[name];
            }
        }
    },

    /**
     * Clean up old cached paths that haven't been used recently
     * @param {number} maxAge - Maximum age in ticks (default 1000)
     */
    cleanOldPaths: function(maxAge = 1000) {
        for(var name in Memory.creeps) {
            if(Memory.creeps[name].path &&
               Memory.creeps[name].pathAge &&
               Game.time - Memory.creeps[name].pathAge > maxAge) {
                delete Memory.creeps[name].path;
                delete Memory.creeps[name].pathAge;
            }
        }
    },

    /**
     * Clean up room memory for rooms we no longer have visibility in
     */
    cleanRoomMemory: function() {
        for(var roomName in Memory.rooms) {
            if(!Game.rooms[roomName]) {
                delete Memory.rooms[roomName];
            }
        }
    },

    /**
     * Initialize room memory if it doesn't exist
     * @param {Room} room
     */
    initRoomMemory: function(room) {
        if(!Memory.rooms[room.name]) {
            Memory.rooms[room.name] = {
                sourceIds: [],
                containerIds: [],
                stats: {}
            };
        }

        // Cache source IDs if not already cached
        if(!Memory.rooms[room.name].sourceIds || Memory.rooms[room.name].sourceIds.length === 0) {
            var sources = room.find(FIND_SOURCES);
            Memory.rooms[room.name].sourceIds = sources.map(s => s.id);
        }
    },

    /**
     * Get cached data with TTL (Time To Live)
     * @param {string} key - Cache key
     * @param {number} ttl - Time to live in ticks (default 10)
     * @returns {any|null} Cached data or null if expired
     */
    getCached: function(key, ttl = 10) {
        if(!global.cache) {
            global.cache = {};
        }

        var entry = global.cache[key];
        if(entry && Game.time - entry.time < ttl) {
            return entry.data;
        }

        return null;
    },

    /**
     * Set cached data
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     */
    setCached: function(key, data) {
        if(!global.cache) {
            global.cache = {};
        }

        global.cache[key] = {
            data: data,
            time: Game.time
        };
    },

    /**
     * Clear all global cache (useful for reset)
     */
    clearCache: function() {
        global.cache = {};
    },

    /**
     * Get memory usage statistics
     * @returns {object} Memory stats
     */
    getMemoryStats: function() {
        var memoryUsed = RawMemory.get().length;
        var memoryLimit = 2048 * 1024; // 2 MB in bytes

        return {
            used: memoryUsed,
            limit: memoryLimit,
            percentage: ((memoryUsed / memoryLimit) * 100).toFixed(2) + '%',
            creepCount: Object.keys(Memory.creeps).length,
            roomCount: Object.keys(Memory.rooms).length
        };
    },

    /**
     * Run all cleanup tasks
     * Should be called periodically from main loop
     */
    runCleanup: function() {
        // Clean dead creeps every 10 ticks
        if(Game.time % 10 === 0) {
            this.cleanDeadCreeps();
        }

        // Clean old paths every 100 ticks
        if(Game.time % 100 === 0) {
            this.cleanOldPaths();
        }

        // Clean room memory every 1000 ticks
        if(Game.time % 1000 === 0) {
            this.cleanRoomMemory();
        }
    }
};

module.exports = memoryManager;
