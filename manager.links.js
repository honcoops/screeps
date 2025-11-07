/**
 * Link Manager
 * Handles efficient energy transfer using Links
 * Links are available at RCL 5+ and transfer energy instantly with 3% loss
 */

var linkManager = {

    /**
     * Initialize link roles in room memory
     * Categorizes links as: source, controller, or hub
     * @param {Room} room
     */
    initializeLinks: function(room) {
        if (!room.memory.links) {
            room.memory.links = {
                sourceLinks: [],
                controllerLink: null,
                hubLink: null,
                lastUpdate: 0
            };
        }

        // Update link roles every 500 ticks
        if (Game.time - room.memory.links.lastUpdate < 500) {
            return;
        }

        var links = room.find(FIND_MY_STRUCTURES, {
            filter: {structureType: STRUCTURE_LINK}
        });

        if (links.length === 0) {
            return;
        }

        var sourceLinks = [];
        var controllerLink = null;
        var hubLink = null;

        // Categorize links based on proximity
        for (var link of links) {
            // Check if near a source (within 2 tiles)
            var nearSource = link.pos.findInRange(FIND_SOURCES, 2);
            if (nearSource.length > 0) {
                sourceLinks.push(link.id);
                continue;
            }

            // Check if near controller (within 3 tiles)
            if (room.controller && link.pos.inRangeTo(room.controller, 3)) {
                controllerLink = link.id;
                continue;
            }

            // Check if near storage (hub link)
            if (room.storage && link.pos.inRangeTo(room.storage, 2)) {
                hubLink = link.id;
            }
        }

        // Update memory
        room.memory.links.sourceLinks = sourceLinks;
        room.memory.links.controllerLink = controllerLink;
        room.memory.links.hubLink = hubLink;
        room.memory.links.lastUpdate = Game.time;

        console.log(`[${room.name}] Links configured: ${sourceLinks.length} source, ` +
                    `${controllerLink ? 1 : 0} controller, ${hubLink ? 1 : 0} hub`);
    },

    /**
     * Transfer energy from source links to controller/hub links
     * @param {Room} room
     */
    runLinks: function(room) {
        if (!room.memory.links) {
            return;
        }

        var linkData = room.memory.links;

        // Get link objects
        var sourceLinks = linkData.sourceLinks.map(id => Game.getObjectById(id)).filter(l => l);
        var controllerLink = Game.getObjectById(linkData.controllerLink);
        var hubLink = Game.getObjectById(linkData.hubLink);

        // Transfer from source links
        for (var sourceLink of sourceLinks) {
            // Skip if on cooldown or empty
            if (sourceLink.cooldown > 0 || sourceLink.store[RESOURCE_ENERGY] < 400) {
                continue;
            }

            // Priority 1: Send to controller link if it's low
            if (controllerLink && controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                sourceLink.transferEnergy(controllerLink);
                continue;
            }

            // Priority 2: Send to hub link if available
            if (hubLink && hubLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                sourceLink.transferEnergy(hubLink);
                continue;
            }
        }

        // Transfer from hub to controller if needed
        if (hubLink && controllerLink && hubLink.cooldown === 0) {
            if (hubLink.store[RESOURCE_ENERGY] >= 400 &&
                controllerLink.store.getFreeCapacity(RESOURCE_ENERGY) >= 400) {
                hubLink.transferEnergy(controllerLink);
            }
        }
    },

    /**
     * Get the hub link for a room (near storage)
     * @param {Room} room
     * @returns {StructureLink|null}
     */
    getHubLink: function(room) {
        if (!room.memory.links || !room.memory.links.hubLink) {
            return null;
        }
        return Game.getObjectById(room.memory.links.hubLink);
    },

    /**
     * Get the controller link for a room
     * @param {Room} room
     * @returns {StructureLink|null}
     */
    getControllerLink: function(room) {
        if (!room.memory.links || !room.memory.links.controllerLink) {
            return null;
        }
        return Game.getObjectById(room.memory.links.controllerLink);
    },

    /**
     * Check if a position is near a source link
     * Useful for determining if miners should use links instead of containers
     * @param {RoomPosition} pos
     * @returns {StructureLink|null}
     */
    getNearbySourceLink: function(pos) {
        var links = pos.findInRange(FIND_MY_STRUCTURES, 2, {
            filter: {structureType: STRUCTURE_LINK}
        });

        if (links.length > 0) {
            var link = links[0];
            // Verify it's near a source
            var nearSource = link.pos.findInRange(FIND_SOURCES, 2);
            if (nearSource.length > 0) {
                return link;
            }
        }

        return null;
    },

    /**
     * Main link management function
     * @param {Room} room
     */
    run: function(room) {
        // Only run for rooms with RCL 5+
        if (!room.controller || room.controller.level < 5) {
            return;
        }

        this.initializeLinks(room);
        this.runLinks(room);
    }
};

module.exports = linkManager;
