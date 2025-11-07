/**
 * Room Manager
 * Handles room-level operations including tower defense, repair, and room analysis
 */

var linkManager = require('manager.links');
var terminalManager = require('manager.terminal');
var labManager = require('manager.labs');

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
     * Build roads automatically based on creep movement patterns
     * Creates roads on frequently traveled paths
     * @param {Room} room
     */
    planRoads: function(room) {
        if (!room.controller || !room.controller.my) {
            return;
        }

        // Only plan roads at RCL 3+
        if (room.controller.level < 3) {
            return;
        }

        // Limit road planning to prevent spam
        if (!room.memory.roadPlanning) {
            room.memory.roadPlanning = {lastPlanned: 0};
        }

        // Only plan roads every 1000 ticks
        if (Game.time - room.memory.roadPlanning.lastPlanned < 1000) {
            return;
        }

        room.memory.roadPlanning.lastPlanned = Game.time;

        // Count existing roads and construction sites
        var existingRoads = room.find(FIND_STRUCTURES, {
            filter: {structureType: STRUCTURE_ROAD}
        }).length;

        var roadSites = room.find(FIND_CONSTRUCTION_SITES, {
            filter: {structureType: STRUCTURE_ROAD}
        }).length;

        // Don't create too many road sites at once
        if (roadSites > 5) {
            return;
        }

        // Find important locations
        var spawns = room.find(FIND_MY_SPAWNS);
        var sources = room.find(FIND_SOURCES);
        var controller = room.controller;
        var storage = room.storage;
        var mineral = room.find(FIND_MINERALS)[0];

        if (spawns.length === 0) {
            return;
        }

        var spawn = spawns[0];
        var pathsToCreate = [];

        // Priority 1: Spawn to sources
        for (var source of sources) {
            pathsToCreate.push({from: spawn.pos, to: source.pos});
        }

        // Priority 2: Spawn to controller
        pathsToCreate.push({from: spawn.pos, to: controller.pos});

        // Priority 3: Sources to controller
        for (var source of sources) {
            pathsToCreate.push({from: source.pos, to: controller.pos});
        }

        // Priority 4: Spawn/Storage to mineral (if RCL 6+)
        if (room.controller.level >= 6 && mineral) {
            pathsToCreate.push({from: spawn.pos, to: mineral.pos});
            if (storage) {
                pathsToCreate.push({from: storage.pos, to: mineral.pos});
            }
        }

        // Priority 5: Storage connections (if exists)
        if (storage) {
            pathsToCreate.push({from: spawn.pos, to: storage.pos});
            for (var source of sources) {
                pathsToCreate.push({from: source.pos, to: storage.pos});
            }
        }

        // Create roads along paths
        for (var pathInfo of pathsToCreate) {
            this.createRoadPath(room, pathInfo.from, pathInfo.to);
        }
    },

    /**
     * Create road construction sites along a path
     * @param {Room} room
     * @param {RoomPosition} from
     * @param {RoomPosition} to
     */
    createRoadPath: function(room, from, to) {
        var path = from.findPathTo(to, {
            ignoreCreeps: true,
            swampCost: 1, // Roads make swamps passable
            plainCost: 1
        });

        var roadsPlaced = 0;

        for (var i = 0; i < path.length && roadsPlaced < 3; i++) {
            var pos = room.getPositionAt(path[i].x, path[i].y);

            // Don't place roads on structures (except roads)
            var structures = pos.lookFor(LOOK_STRUCTURES);
            var hasNonRoadStructure = structures.some(s => s.structureType !== STRUCTURE_ROAD);

            if (hasNonRoadStructure) {
                continue;
            }

            // Check if road or construction site already exists
            var hasRoad = structures.some(s => s.structureType === STRUCTURE_ROAD);
            var hasRoadSite = pos.lookFor(LOOK_CONSTRUCTION_SITES).some(
                s => s.structureType === STRUCTURE_ROAD
            );

            if (!hasRoad && !hasRoadSite) {
                var result = room.createConstructionSite(pos, STRUCTURE_ROAD);
                if (result === OK) {
                    roadsPlaced++;
                }
            }
        }
    },

    /**
     * Run power spawn to process power
     * @param {Room} room
     */
    runPowerSpawn: function(room) {
        // Only for RCL 8 rooms with power spawn
        if (!room.controller || room.controller.level < 8) {
            return;
        }

        var powerSpawn = room.find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_POWER_SPAWN}
        })[0];

        if (!powerSpawn) {
            return;
        }

        // Check if power spawn has resources to process
        if (powerSpawn.store[RESOURCE_ENERGY] >= 50 && powerSpawn.store[RESOURCE_POWER] >= 1) {
            powerSpawn.processPower();
        }
    },

    /**
     * Main room management function
     * @param {Room} room
     */
    run: function(room) {
        // Run towers every tick
        this.runTowers(room);

        // Run link management every tick
        linkManager.run(room);

        // Run terminal management every tick
        terminalManager.run(room);

        // Run lab management every tick
        labManager.run(room);

        // Run power spawn every tick
        this.runPowerSpawn(room);

        // Periodic operations
        if (Game.time % 50 === 0) {
            this.analyzeRoom(room);
            this.placeSourceContainers(room);
        }

        // Road planning (less frequent)
        if (Game.time % 100 === 0) {
            this.planRoads(room);
        }
    }
};

module.exports = roomManager;
