// Finds what is near a point quickly: things to use, what blocks the way, and floors to stand on.
const CELL = 12;

class Buckets {
    constructor() {
        this.cells = new Map();
        this.stamp = 0;
    }

    key(ix, iz) {
        return ix * 4096 + iz;
    }

    add(item, x, z, radius) {
        item._cells = [];
        const x0 = Math.floor((x - radius) / CELL);
        const x1 = Math.floor((x + radius) / CELL);
        const z0 = Math.floor((z - radius) / CELL);
        const z1 = Math.floor((z + radius) / CELL);
        for (let ix = x0; ix <= x1; ix++) {
            for (let iz = z0; iz <= z1; iz++) {
                const key = this.key(ix, iz);
                let list = this.cells.get(key);
                if (!list) {
                    list = [];
                    this.cells.set(key, list);
                }
                list.push(item);
                item._cells.push(key);
            }
        }
    }

    remove(item) {
        for (const key of item._cells || []) {
            const list = this.cells.get(key);
            const i = list ? list.indexOf(item) : -1;
            if (i >= 0) {
                list.splice(i, 1);
            }
        }
        item._cells = [];
    }

    near(x, z, radius, out = []) {
        out.length = 0;
        this.stamp++;
        const x0 = Math.floor((x - radius) / CELL);
        const x1 = Math.floor((x + radius) / CELL);
        const z0 = Math.floor((z - radius) / CELL);
        const z1 = Math.floor((z + radius) / CELL);
        for (let ix = x0; ix <= x1; ix++) {
            for (let iz = z0; iz <= z1; iz++) {
                const list = this.cells.get(this.key(ix, iz));
                if (list) {
                    for (const item of list) {
                        if (item._seen !== this.stamp) {
                            item._seen = this.stamp;
                            out.push(item);
                        }
                    }
                }
            }
        }
        return out;
    }
}

export class Space {
    constructor() {
        this.things = new Buckets();
        this.blocks = new Buckets();
        this.floors = new Buckets();
        this.roofs = new Buckets();
        this.found = [];
    }

    addThing(thing) {
        this.things.add(thing, thing.x, thing.z, (thing.reach || 3) + 1);
        return thing;
    }

    removeThing(thing) {
        this.things.remove(thing);
    }

    // A circle: {x, z, r}. A box: {x, z, hx, hz, turn, top, bottom}
    addBlock(block) {
        if (block.hx !== undefined) {
            block.cos = Math.cos(block.turn || 0);
            block.sin = Math.sin(block.turn || 0);
            block.reachOut = Math.hypot(block.hx, block.hz);
        } else {
            block.reachOut = block.r;
        }
        this.blocks.add(block, block.x, block.z, block.reachOut + 1);
        return block;
    }

    removeBlock(block) {
        this.blocks.remove(block);
    }

    // {x, z, hx, hz, turn, y}: something to stand on above the ground
    addFloor(floor) {
        floor.cos = Math.cos(floor.turn || 0);
        floor.sin = Math.sin(floor.turn || 0);
        this.floors.add(floor, floor.x, floor.z, Math.hypot(floor.hx, floor.hz) + 1);
        return floor;
    }

    removeFloor(floor) {
        this.floors.remove(floor);
    }

    addRoof(roof) {
        roof.cos = Math.cos(roof.turn || 0);
        roof.sin = Math.sin(roof.turn || 0);
        this.roofs.add(roof, roof.x, roof.z, Math.hypot(roof.hx, roof.hz) + 1);
        return roof;
    }

    removeRoof(roof) {
        this.roofs.remove(roof);
    }

    underRoof(x, z) {
        for (const roof of this.roofs.near(x, z, 1, this.found)) {
            if (inside(roof, x, z)) {
                return true;
            }
        }
        return false;
    }

    // The highest floor at or under the feet, with a small step up allowed
    floorAt(x, z, feet, step = 0.6) {
        let best = -Infinity;
        for (const floor of this.floors.near(x, z, 1, this.found)) {
            if (inside(floor, x, z) && floor.y <= feet + step && floor.y > best) {
                best = floor.y;
            }
        }
        return best;
    }

    // Moves a body of radius r out of what blocks it. Changes position (needs x and z).
    pushOut(position, r, feet, head, deep = false) {
        for (const block of this.blocks.near(position.x, position.z, r + 3, this.found)) {
            if (Boolean(block.deep) !== deep) {
                continue;
            }
            if (block.hx !== undefined) {
                if (block.top !== undefined && feet >= block.top - 0.1 || block.bottom !== undefined && head <= block.bottom) {
                    continue;
                }
                const dx = position.x - block.x;
                const dz = position.z - block.z;
                const lx = dx * block.cos - dz * block.sin;
                const lz = dx * block.sin + dz * block.cos;
                const nearX = Math.max(-block.hx, Math.min(block.hx, lx));
                const nearZ = Math.max(-block.hz, Math.min(block.hz, lz));
                const ox = lx - nearX;
                const oz = lz - nearZ;
                const distance = Math.hypot(ox, oz);
                let ax = 0;
                let az = 0;
                if (distance > 0.0001) {
                    if (distance < r) {
                        ax = ox / distance * (r - distance);
                        az = oz / distance * (r - distance);
                    }
                } else {
                    // Inside: out by the nearest side
                    const px = block.hx - Math.abs(lx);
                    const pz = block.hz - Math.abs(lz);
                    if (px < pz) {
                        ax = Math.sign(lx || 1) * (px + r);
                    } else {
                        az = Math.sign(lz || 1) * (pz + r);
                    }
                }
                position.x += ax * block.cos + az * block.sin;
                position.z += -ax * block.sin + az * block.cos;
            } else {
                const dx = position.x - block.x;
                const dz = position.z - block.z;
                const distance = Math.hypot(dx, dz);
                const need = block.r + r;
                if (distance < need && distance > 0.0001) {
                    position.x += dx / distance * (need - distance);
                    position.z += dz / distance * (need - distance);
                }
            }
        }
    }
}

function inside(box, x, z) {
    const dx = x - box.x;
    const dz = z - box.z;
    return Math.abs(dx * box.cos - dz * box.sin) <= box.hx && Math.abs(dx * box.sin + dz * box.cos) <= box.hz;
}
