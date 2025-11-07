/**
 * Spawn Manager
 * Handles intelligent creep spawning with dynamic body sizing based on energy and RCL
 */

var spawnManager = {

    /**
     * Get optimized miner body based on available energy
     * Miners stay at sources and mine continuously
     * @param {number} energy - Available energy
     * @param {number} rcl - Room Control Level
     * @returns {array} Body parts array
     */
    getMinerBody: function(energy, rcl) {
        // 5 WORK parts mine exactly 10 energy/tick (max source output)
        if (energy >= 550) {
            return [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]; // 550 energy
        } else if (energy >= 450) {
            return [WORK, WORK, WORK, WORK, CARRY, MOVE]; // 450 energy
        } else if (energy >= 350) {
            return [WORK, WORK, WORK, CARRY, MOVE]; // 350 energy
        } else {
            return [WORK, WORK, CARRY, MOVE]; // 300 energy
        }
    },

    /**
     * Get optimized hauler body based on available energy
     * Haulers transport energy from containers to storage/spawn
     * @param {number} energy - Available energy
     * @param {number} rcl - Room Control Level
     * @returns {array} Body parts array
     */
    getHaulerBody: function(energy, rcl) {
        // Maximize CARRY parts, balance with MOVE for speed
        if (energy >= 1200) {
            // 16 CARRY, 8 MOVE = 800 capacity, 1 tile/tick on roads
            return [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ]; // 1200 energy
        } else if (energy >= 600) {
            // 8 CARRY, 4 MOVE = 400 capacity
            return [
                CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE
            ]; // 600 energy
        } else if (energy >= 300) {
            // 4 CARRY, 2 MOVE = 200 capacity
            return [CARRY, CARRY, CARRY, CARRY, MOVE, MOVE]; // 300 energy
        } else {
            // Minimum viable hauler
            return [CARRY, CARRY, MOVE]; // 150 energy
        }
    },

    /**
     * Get optimized upgrader body based on available energy
     * @param {number} energy - Available energy
     * @param {number} rcl - Room Control Level
     * @returns {array} Body parts array
     */
    getUpgraderBody: function(energy, rcl) {
        // At RCL 8, controller upgrade is limited to 15 energy/tick
        if (energy >= 1100 && rcl >= 7) {
            // 6 WORK, 3 CARRY, 6 MOVE
            return [
                WORK, WORK, WORK, WORK, WORK, WORK,
                CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ]; // 1050 energy
        } else if (energy >= 800) {
            // 4 WORK, 4 CARRY, 4 MOVE
            return [
                WORK, WORK, WORK, WORK,
                CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE
            ]; // 800 energy
        } else if (energy >= 550) {
            // 3 WORK, 2 CARRY, 3 MOVE
            return [WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE]; // 500 energy
        } else if (energy >= 300) {
            // 2 WORK, 1 CARRY, 2 MOVE
            return [WORK, WORK, CARRY, MOVE, MOVE]; // 300 energy
        } else {
            // Basic body
            return [WORK, CARRY, MOVE]; // 200 energy
        }
    },

    /**
     * Get optimized builder body based on available energy
     * @param {number} energy - Available energy
     * @param {number} rcl - Room Control Level
     * @returns {array} Body parts array
     */
    getBuilderBody: function(energy, rcl) {
        if (energy >= 800) {
            // 4 WORK, 4 CARRY, 4 MOVE
            return [
                WORK, WORK, WORK, WORK,
                CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE
            ]; // 800 energy
        } else if (energy >= 550) {
            // 3 WORK, 3 CARRY, 3 MOVE
            return [
                WORK, WORK, WORK,
                CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE
            ]; // 550 energy
        } else if (energy >= 400) {
            // 2 WORK, 2 CARRY, 2 MOVE
            return [WORK, WORK, CARRY, CARRY, MOVE, MOVE]; // 400 energy
        } else {
            // Basic body
            return [WORK, CARRY, MOVE]; // 200 energy
        }
    },

    /**
     * Get optimized mineral miner body based on available energy
     * @param {number} energy - Available energy
     * @param {number} rcl - Room Control Level
     * @returns {array} Body parts array
     */
    getMineralMinerBody: function(energy, rcl) {
        // Mineral miners need WORK parts to mine and CARRY to transport
        if (energy >= 1200) {
            // 8 WORK, 4 CARRY, 6 MOVE
            return [
                WORK, WORK, WORK, WORK, WORK, WORK, WORK, WORK,
                CARRY, CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE, MOVE, MOVE
            ]; // 1200 energy
        } else if (energy >= 800) {
            // 6 WORK, 3 CARRY, 4 MOVE
            return [
                WORK, WORK, WORK, WORK, WORK, WORK,
                CARRY, CARRY, CARRY,
                MOVE, MOVE, MOVE, MOVE
            ]; // 750 energy
        } else {
            // Basic mineral miner
            return [WORK, WORK, WORK, CARRY, MOVE, MOVE]; // 450 energy
        }
    },

    /**
     * Get spawn priority and determine which creep to spawn next
     * @param {Room} room
     * @returns {object|null} {role, body} or null if nothing to spawn
     */
    getSpawnPriority: function(room) {
        var creeps = room.find(FIND_MY_CREEPS);
        var sources = room.memory.sourceIds || [];
        var sourceCount = sources.length;

        // Count creeps by role
        var miners = _.filter(creeps, (c) => c.memory.role === 'miner');
        var haulers = _.filter(creeps, (c) => c.memory.role === 'hauler');
        var upgraders = _.filter(creeps, (c) => c.memory.role === 'upgrader');
        var builders = _.filter(creeps, (c) => c.memory.role === 'builder');
        var mineralMiners = _.filter(creeps, (c) => c.memory.role === 'mineralMiner');

        var rcl = room.controller.level;
        var energy = room.energyCapacityAvailable;

        // Emergency: If no haulers and no harvesters, spawn a basic harvester
        if (haulers.length === 0 && miners.length === 0) {
            return {
                role: 'harvester',
                body: [WORK, CARRY, MOVE],
                memory: {role: 'harvester'}
            };
        }

        // Priority 1: Miners (one per source)
        if (miners.length < sourceCount) {
            // Find which source needs a miner
            var assignedSources = miners.map(m => m.memory.sourceId);
            var unassignedSource = sources.find(id => !assignedSources.includes(id));

            return {
                role: 'miner',
                body: this.getMinerBody(energy, rcl),
                memory: {
                    role: 'miner',
                    sourceId: unassignedSource,
                    homeRoom: room.name
                }
            };
        }

        // Priority 2: Haulers (scale with sources and room size)
        var minHaulers = Math.max(2, sourceCount);
        if (haulers.length < minHaulers) {
            return {
                role: 'hauler',
                body: this.getHaulerBody(energy, rcl),
                memory: {
                    role: 'hauler',
                    homeRoom: room.name,
                    state: 'collecting'
                }
            };
        }

        // Priority 3: Upgraders (always need at least 1, more at lower RCLs)
        var minUpgraders = rcl < 8 ? 2 : 1;
        if (upgraders.length < minUpgraders) {
            return {
                role: 'upgrader',
                body: this.getUpgraderBody(energy, rcl),
                memory: {role: 'upgrader'}
            };
        }

        // Priority 4: Builders (only if construction sites exist)
        var constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        var minBuilders = constructionSites.length > 0 ? 2 : 0;
        if (builders.length < minBuilders) {
            return {
                role: 'builder',
                body: this.getBuilderBody(energy, rcl),
                memory: {role: 'builder'}
            };
        }

        // Priority 5: Mineral miner (RCL 6+ only, one per mineral)
        if (rcl >= 6) {
            var minerals = room.find(FIND_MINERALS);
            if (minerals.length > 0 && minerals[0].mineralAmount > 0) {
                // Check if extractor exists
                var extractor = minerals[0].pos.lookFor(LOOK_STRUCTURES).find(
                    s => s.structureType === STRUCTURE_EXTRACTOR
                );

                if (extractor && mineralMiners.length === 0) {
                    return {
                        role: 'mineralMiner',
                        body: this.getMineralMinerBody(energy, rcl),
                        memory: {
                            role: 'mineralMiner',
                            mineralId: minerals[0].id,
                            mining: true
                        }
                    };
                }
            }
        }

        // Priority 6: Extra haulers if energy is backing up
        // Check if containers are getting full
        if (haulers.length < sourceCount * 2) {
            var containers = room.find(FIND_STRUCTURES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            });

            var fullContainers = _.filter(containers,
                (c) => c.store.getFreeCapacity(RESOURCE_ENERGY) < 500
            );

            if (fullContainers.length > 0) {
                return {
                    role: 'hauler',
                    body: this.getHaulerBody(energy, rcl),
                    memory: {
                        role: 'hauler',
                        homeRoom: room.name,
                        state: 'collecting'
                    }
                };
            }
        }

        // Nothing urgent to spawn
        return null;
    },

    /**
     * Attempt to spawn a creep at the given spawn
     * @param {StructureSpawn} spawn
     */
    run: function(spawn) {
        // Don't try to spawn if already spawning
        if (spawn.spawning) {
            return;
        }

        var room = spawn.room;
        var priority = this.getSpawnPriority(room);

        if (priority) {
            var name = priority.role.charAt(0).toUpperCase() +
                      priority.role.slice(1) + Game.time;

            var result = spawn.spawnCreep(priority.body, name, {
                memory: priority.memory
            });

            if (result === OK) {
                console.log(`Spawning ${priority.role}: ${name} with ${priority.body.length} parts`);
            } else if (result === ERR_NOT_ENOUGH_ENERGY) {
                // Not enough energy yet, wait
            } else {
                console.log(`Failed to spawn ${priority.role}: ${result}`);
            }
        }
    }
};

module.exports = spawnManager;
