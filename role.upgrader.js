/**
 * Role: Upgrader
 * Purpose: Harvest energy and use it to upgrade the room controller
 * Optimized with path caching and container/storage/link support
 */

var linkManager = require('manager.links');

var roleUpgrader = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // State management: switch between harvesting and upgrading
        if(creep.memory.upgrading && creep.store[RESOURCE_ENERGY] == 0) {
            creep.memory.upgrading = false;
            creep.say('🔄 harvest');
            delete creep.memory.path;
        }
        if(!creep.memory.upgrading && creep.store.getFreeCapacity() == 0) {
            creep.memory.upgrading = true;
            creep.say('⚡ upgrade');
            delete creep.memory.path;
        }

        // Upgrade the controller if carrying energy
        if(creep.memory.upgrading) {
            if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
                this.moveToTarget(creep, creep.room.controller);
            }
        }
        // Otherwise, go collect energy
        else {
            this.collectEnergy(creep);
        }
    },

    /**
     * Collect energy from containers, storage, links, or sources
     * @param {Creep} creep
     */
    collectEnergy: function(creep) {
        // Priority 1: Try controller link first (RCL 5+)
        var controllerLink = linkManager.getControllerLink(creep.room);
        if (controllerLink && controllerLink.store[RESOURCE_ENERGY] > 0) {
            if (creep.withdraw(controllerLink, RESOURCE_ENERGY) == ERR_NOT_IN_RANGE) {
                this.moveToTarget(creep, controllerLink);
            }
            return;
        }

        // Priority 2: Try to withdraw from containers or storage
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
                visualizePathStyle: {stroke: '#00ff00'}
            });

            if (path.length > 0) {
                creep.memory.path = Room.serializePath(path);
                creep.memory.pathAge = Game.time;
                creep.moveByPath(path);
            }
        }
    }
};

module.exports = roleUpgrader;