const HARVEST_RADIUS = 2
export const TILE_WIDTH = 16
export const TILE_HEIGHT = 16

export function setCamera (camera, sprite) {
  sprite.cameraFilter = 0xFFFFFFFF ^ camera.id
}

export function inCircle (centerX, centerY) {
  const result = []
  const radius = HARVEST_RADIUS * TILE_WIDTH

  for (let offsetX = -radius; offsetX <= radius; offsetX += TILE_WIDTH) {
    for (let offsetY = -radius; offsetY <= radius; offsetY += TILE_HEIGHT) {
      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY)
      if (distance < radius) {
        const x = centerX - offsetX
        const y = centerY - offsetY
        const tileX = Math.floor(x / TILE_WIDTH)
        const tileY = Math.floor(y / TILE_HEIGHT)
        result.push([tileX, tileY])
      }
    }
  }
  return result
}

export class Scheduler {
  constructor () {
    this.events = []
    this.time = null
  }

  addEvent (delay, type, data) {
    this.events.push({
      time: this.time + delay,
      type,
      data
    })
    this.events.sort((a, b) => a.time - b.time)
  }

  update (time) {
    this.time = time
    let index = 0
    while (index < this.events.length && this.events[index].time <= time) {
      index++
    }
    return this.events.splice(0, index)
  }
}
