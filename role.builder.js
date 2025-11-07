/**
 * Role: Builder
 * Purpose: Harvest energy and use it to build construction sites
 * Optimized with path caching and container/storage support
 */

var roleBuilder = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // State management: switch between building and harvesting
        if(creep.memory.building && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
            delete creep.memory.path;
            delete creep.memory.target;
        }
        if(!creep.memory.building && creep.store.getFreeCapacity() == 0) {
            creep.memory.building = true;
            creep.say('🚧 build');
            delete creep.memory.path;
            delete creep.memory.target;
        }

        // Build if carrying energy
        if(creep.memory.building) {
            var targets = creep.room.find(FIND_CONSTRUCTION_SITES);

            if(targets.length) {
                // Prioritize important structures
                var target = this.findBestConstructionSite(targets);

                if(creep.build(target) == ERR_NOT_IN_RANGE) {
                    this.moveToTarget(creep, target);
                }
            }
            // If nothing to build, act like an upgrader
            else {
                if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                    this.moveToTarget(creep, creep.room.controller);
                }
            }
        }
        // Otherwise, collect energy
        else {
            this.collectEnergy(creep);
        }
    },

    /**
     * Find the best construction site to build
     * Priority: Spawn > Towers > Extensions > Containers > Roads > Others
     * @param {array} sites
     * @returns {ConstructionSite}
     */
    findBestConstructionSite: function(sites) {
        var priorities = [
            STRUCTURE_SPAWN,
            STRUCTURE_TOWER,
            STRUCTURE_EXTENSION,
            STRUCTURE_CONTAINER,
            STRUCTURE_STORAGE,
            STRUCTURE_ROAD,
            STRUCTURE_RAMPART,
            STRUCTURE_WALL
        ];

        for (var type of priorities) {
            var site = sites.find(s => s.structureType === type);
            if (site) {
                return site;
            }
        }

        return sites[0];
    },

    /**
     * Collect energy from containers, storage, or sources
     * @param {Creep} creep
     */
    collectEnergy: function(creep) {
        // Try to withdraw from containers or storage first
        var container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) => {
                return (s.structureType === STRUCTURE_CONTAINER ||
                        s.structureType === STRUCTURE_STORAGE) &&
                       s.store[RESOURCE_ENERGY] > 0;
            }
        });

        if(container) {
            if(creep.withdraw(container, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveToTarget(creep, container);
            }
        } else {
            // Fall back to harvesting from source
            var sources = creep.room.find(FIND_SOURCES);
            if(sources.length > 0) {
                if(creep.harvest(sources[0]) == ERR_NOT_IN_RANGE) {
                    this.moveToTarget(creep, sources[0]);
                }
            }
        }
    },

    /**
     * Move to target using cached path for CPU efficiency
     * @param {Creep} creep
     * @param {Object} target
     */
    moveToTarget: function(creep, target) {
        // Use cached path if available
        if (creep.memory.path) {
            var result = creep.moveByPath(creep.memory.path);

            if (result === ERR_NOT_FOUND || result === ERR_INVALID_ARGS) {
                // Path is invalid, recalculate
                delete creep.memory.path;
            } else {
                return;
            }
        }

        // Calculate and cache new path
        if (!creep.memory.path) {
            var path = creep.pos.findPathTo(target, {
                ignoreCreeps: true,
                visualizePathStyle: {stroke: '#ffffff'}
            });

            if (path.length > 0) {
                creep.memory.path = Room.serializePath(path);
                creep.memory.pathAge = Game.time;
                creep.moveByPath(path);
            }
        }
    }
};

module.exports = roleBuilder;