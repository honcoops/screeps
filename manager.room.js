/**
 * Room Manager
 * Handles room-level operations including tower defense, repair, and room analysis
 */

var roomManager = {

    /**
     * Run towers in the room
     * Priority: Attack hostiles > Heal friendlies > Repair critical structures > Maintain walls
     * @param {Room} room
     */
    runTowers: function(room) {
        var towers = room.find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_TOWER}
        });

        if (towers.length === 0) {
            return;
        }

        for (var tower of towers) {
            // Priority 1: Attack hostile creeps
            var hostiles = room.find(FIND_HOSTILE_CREEPS);
            if (hostiles.length > 0) {
                var target = this.findPriorityTarget(hostiles);
                tower.attack(target);
                continue;
            }

            // Priority 2: Heal damaged friendly creeps
            var damagedCreeps = room.find(FIND_MY_CREEPS, {
                filter: (c) => c.hits < c.hitsMax
            });
            if (damagedCreeps.length > 0) {
                var mostDamaged = _.min(damagedCreeps, (c) => c.hits);
                tower.heal(mostDamaged);
                continue;
            }

            // Priority 3: Repair critical structures (below 50% health)
            var criticalStructures = room.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return s.hits < s.hitsMax * 0.5 &&
                           s.structureType !== STRUCTURE_WALL &&
                           s.structureType !== STRUCTURE_RAMPART;
                }
            });

            if (criticalStructures.length > 0) {
                var mostDamagedStructure = _.min(criticalStructures, (s) => s.hits);
                tower.repair(mostDamagedStructure);
                continue;
            }

            // Priority 4: Maintain walls and ramparts to minimum level
            // Scale with RCL: 10k per level, max 300k
            var minWallHits = Math.min(10000 * room.controller.level, 300000);
            var damagedWalls = room.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_WALL ||
                            s.structureType === STRUCTURE_RAMPART) &&
                           s.hits < minWallHits;
                }
            });

            if (damagedWalls.length > 0) {
                var weakestWall = _.min(damagedWalls, (s) => s.hits);
                tower.repair(weakestWall);
                continue;
            }

            // Priority 5: Repair roads and containers (below 90% health)
            var damagedInfrastructure = room.find(FIND_STRUCTURES, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_ROAD ||
                            s.structureType === STRUCTURE_CONTAINER) &&
                           s.hits < s.hitsMax * 0.9;
                }
            });

            if (damagedInfrastructure.length > 0) {
                var mostDamagedInfra = _.min(damagedInfrastructure, (s) => s.hits / s.hitsMax);
                tower.repair(mostDamagedInfra);
            }
        }
    },

    /**
     * Find the most dangerous hostile creep to target
     * Priority: Healers > Ranged Attackers > Melee Attackers > Others
     * @param {array} hostiles - Array of hostile creeps
     * @returns {Creep} Target creep
     */
    findPriorityTarget: function(hostiles) {
        // Find healers first
        var healers = _.filter(hostiles, (c) => {
            return c.getActiveBodyparts(HEAL) > 0;
        });
        if (healers.length > 0) {
            return this.findClosestToSpawn(healers);
        }

        // Then ranged attackers
        var ranged = _.filter(hostiles, (c) => {
            return c.getActiveBodyparts(RANGED_ATTACK) > 0;
        });
        if (ranged.length > 0) {
            return this.findClosestToSpawn(ranged);
        }

        // Then melee attackers
        var melee = _.filter(hostiles, (c) => {
            return c.getActiveBodyparts(ATTACK) > 0;
        });
        if (melee.length > 0) {
            return this.findClosestToSpawn(melee);
        }

        // Default: closest to spawn
        return this.findClosestToSpawn(hostiles);
    },

    /**
     * Find the hostile creep closest to spawn
     * @param {array} hostiles
     * @returns {Creep}
     */
    findClosestToSpawn: function(hostiles) {
        var spawn = hostiles[0].room.find(FIND_MY_SPAWNS)[0];
        if (!spawn) {
            return hostiles[0];
        }
        return spawn.pos.findClosestByRange(hostiles);
    },

    /**
     * Analyze room and update statistics
     * Run periodically to update room memory
     * @param {Room} room
     */
    analyzeRoom: function(room) {
        if (!room.memory.stats) {
            room.memory.stats = {};
        }

        var stats = room.memory.stats;

        // Energy statistics
        stats.energyAvailable = room.energyAvailable;
        stats.energyCapacity = room.energyCapacityAvailable;
        stats.energyPercentage = (room.energyAvailable / room.energyCapacityAvailable * 100).toFixed(1);

        // Count structures
        var structures = room.find(FIND_STRUCTURES);
        stats.structureCount = structures.length;

        // Count construction sites
        var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        stats.constructionSiteCount = constructionSites.length;

        // Count creeps by role
        var creeps = room.find(FIND_MY_CREEPS);
        stats.creepsByRole = _.countBy(creeps, (c) => c.memory.role);
        stats.totalCreeps = creeps.length;

        // Controller info
        if (room.controller && room.controller.my) {
            stats.rcl = room.controller.level;
            stats.progress = room.controller.progress;
            stats.progressTotal = room.controller.progressTotal;
            stats.progressPercentage = (room.controller.progress / room.controller.progressTotal * 100).toFixed(1);
        }

        // Hostiles present
        var hostiles = room.find(FIND_HOSTILE_CREEPS);
        stats.hostileCount = hostiles.length;

        stats.lastUpdate = Game.time;
    },

    /**
     * Place construction sites for containers at sources
     * @param {Room} room
     */
    placeSourceContainers: function(room) {
        if (!room.controller || !room.controller.my) {
            return;
        }

        var sources = room.find(FIND_SOURCES);

        for (var source of sources) {
            // Check if container already exists or construction site placed
            var structures = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: {structureType: STRUCTURE_CONTAINER}
            });

            var sites = source.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: {structureType: STRUCTURE_CONTAINER}
            });

            if (structures.length === 0 && sites.length === 0) {
                // Find best position for container (adjacent to source)
                var positions = [
                    {x: source.pos.x - 1, y: source.pos.y},
                    {x: source.pos.x + 1, y: source.pos.y},
                    {x: source.pos.x, y: source.pos.y - 1},
                    {x: source.pos.x, y: source.pos.y + 1},
                    {x: source.pos.x - 1, y: source.pos.y - 1},
                    {x: source.pos.x + 1, y: source.pos.y - 1},
                    {x: source.pos.x - 1, y: source.pos.y + 1},
                    {x: source.pos.x + 1, y: source.pos.y + 1}
                ];

                for (var pos of positions) {
                    var terrain = room.getTerrain().get(pos.x, pos.y);
                    if (terrain !== TERRAIN_MASK_WALL) {
                        var result = room.createConstructionSite(pos.x, pos.y, STRUCTURE_CONTAINER);
                        if (result === OK) {
                            console.log(`Placed container site at source in ${room.name}`);
                            break;
                        }
                    }
                }
            }
        }
    },

    /**
     * Main room management function
     * @param {Room} room
     */
    run: function(room) {
        // Run towers every tick
        this.runTowers(room);

        // Periodic operations
        if (Game.time % 50 === 0) {
            this.analyzeRoom(room);
            this.placeSourceContainers(room);
        }
    }
};

module.exports = roomManager;
