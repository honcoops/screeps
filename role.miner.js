/**
 * Role: Miner
 * Purpose: Static harvester that stays at a source and mines continuously
 * Builds and maintains containers for efficient energy collection
 */

var roleMiner = {

    /** @param {Creep} creep **/
    run: function(creep) {

        // Get assigned source
        if (!creep.memory.sourceId) {
            console.log(`Miner ${creep.name} has no assigned source!`);
            return;
        }

        var source = Game.getObjectById(creep.memory.sourceId);
        if (!source) {
            console.log(`Miner ${creep.name} cannot find source ${creep.memory.sourceId}`);
            return;
        }

        // Move to source if not adjacent
        if (!creep.pos.isNearTo(source)) {
            this.moveToSource(creep, source);
            return;
        }

        // Miner is at source - perform mining tasks

        // Check for container at or near this position
        var container = this.findContainer(creep, source);

        // Priority 1: Repair container if damaged
        if (container && container.hits < container.hitsMax * 0.9) {
            if (creep.store[RESOURCE_ENERGY] > 0) {
                creep.repair(container);
            }
        }

        // Priority 2: Build container if construction site exists
        if (!container) {
            var constructionSite = creep.pos.findInRange(FIND_CONSTRUCTION_SITES, 1, {
                filter: {structureType: STRUCTURE_CONTAINER}
            })[0];

            if (constructionSite && creep.store[RESOURCE_ENERGY] > 0) {
                creep.build(constructionSite);
            }
        }

        // Priority 3: Mine continuously
        var result = creep.harvest(source);

        if (result === ERR_NOT_ENOUGH_RESOURCES) {
            // Source is empty, wait for regeneration
            creep.say('⏳');
        } else if (result === OK) {
            creep.say('⛏️');
        }

        // If container is full and miner is full, transfer to nearby structures
        if (container && container.store.getFreeCapacity(RESOURCE_ENERGY) === 0 &&
            creep.store.getFreeCapacity() === 0) {

            // Look for nearby spawns or extensions
            var nearbyStructures = creep.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s) => {
                    return (s.structureType === STRUCTURE_SPAWN ||
                            s.structureType === STRUCTURE_EXTENSION) &&
                           s.store.getFreeCapacity(RESOURCE_ENERGY) > 0;
                }
            });

            if (nearbyStructures.length > 0) {
                creep.transfer(nearbyStructures[0], RESOURCE_ENERGY);
            }
        }
    },

    /**
     * Move to source using cached path
     * @param {Creep} creep
     * @param {Source} source
     */
    moveToSource: function(creep, source) {
        // Use cached path if available
        if (creep.memory.path) {
            var result = creep.moveByPath(creep.memory.path);

            if (result === ERR_NOT_FOUND || result === ERR_INVALID_ARGS) {
                // Path is invalid, recalculate
                delete creep.memory.path;
            }
        }

        // Calculate and cache new path
        if (!creep.memory.path) {
            var path = creep.pos.findPathTo(source, {
                ignoreCreeps: true
            });

            if (path.length > 0) {
                creep.memory.path = Room.serializePath(path);
                creep.memory.pathAge = Game.time;
                creep.moveByPath(path);
            }
        }
    },

    /**
     * Find container at or near the creep's position
     * @param {Creep} creep
     * @param {Source} source
     * @returns {StructureContainer|null}
     */
    findContainer: function(creep, source) {
        // First check if standing on container
        var container = creep.pos.lookFor(LOOK_STRUCTURES).find(
            s => s.structureType === STRUCTURE_CONTAINER
        );

        if (container) {
            return container;
        }

        // Check adjacent tiles
        var containers = creep.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: {structureType: STRUCTURE_CONTAINER}
        });

        if (containers.length > 0) {
            return containers[0];
        }

        // Check near source as fallback
        var sourceContainers = source.pos.findInRange(FIND_STRUCTURES, 1, {
            filter: {structureType: STRUCTURE_CONTAINER}
        });

        if (sourceContainers.length > 0) {
            return sourceContainers[0];
        }

        return null;
    }
};

module.exports = roleMiner;
