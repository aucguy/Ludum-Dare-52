import { Hud } from './hud.js'
import { setCamera, inCircle, TILE_WIDTH, TILE_HEIGHT } from './util.js'

const MOVE_UP = Phaser.Input.Keyboard.KeyCodes.W
const MOVE_LEFT = Phaser.Input.Keyboard.KeyCodes.A
const MOVE_DOWN = Phaser.Input.Keyboard.KeyCodes.S
const MOVE_RIGHT = Phaser.Input.Keyboard.KeyCodes.D

const HEALTH_MAX_LEVEL = 100

const PLANT_GROWTH_TIME_MIN = 10
const PLANT_GROWTH_TIME_MAX = 20
const MOLD_GROW_TIME = 5
const MOLD_START_CHANCE = 0.1
const ANGER_DELAY = 10
const EXPLOSION_DELAY = 10
const ANGER_CHANCE = 0.1
const EXPLOSION_DAMAGE = 5

const TILE_VOID = -1
// const TILE_EMPTY = 0
// const TILE_GROUND = 1
const TILE_FARM = 2
const TILE_PLANT = 3
// const TILE_FLOOR = 4
const TILE_CARROT = 5
const TILE_ROCK = 6
const TILE_ANGER = 7
// const TILE_ANGER_WARNING = 8
const TILE_TOPRIGHT_WALL = 9
const TILE_BOTTOMLEFT_WALL = 10
const TILE_BOTTOMRIGHT_WALL = 11
const TILE_WORKING_VENT = 12
const TILE_BROKEN_VENT = 13
const TILE_MOLD = 14

const SOLID_TILES = [
  TILE_VOID, TILE_ROCK,
  TILE_TOPRIGHT_WALL, TILE_BOTTOMLEFT_WALL, TILE_BOTTOMRIGHT_WALL,
  TILE_WORKING_VENT, TILE_BROKEN_VENT
]

function isSolid (tile) {
  return SOLID_TILES.includes(tile)
}

export class PlayScene extends Phaser.Scene {
  constructor () {
    super()
    this.keyboard = null
    this.player = null
    this.hud = null
    this.turns = 0
  }

  create () {
    this.cameras.main.centerOn(20 / 2 * TILE_WIDTH, 15 / 2 * TILE_HEIGHT)
    this.physics.world.setBounds(0, 0, 20 * TILE_WIDTH, 15 * TILE_HEIGHT)

    this.keyboard = new Keyboard(this, [
      MOVE_UP,
      MOVE_LEFT,
      MOVE_DOWN,
      MOVE_RIGHT
    ])
    this.map = new GameMap(this, this.cameras.main)

    this.player = new Player({
      scene: this,
      camera: this.cameras.main,
      keyboard: this.keyboard,
      map: this.map,
      x: 2,
      y: 2
    })
    this.hud = new Hud(this, this.player)

    this.cameras.main.setZoom(2)
    this.turns = 0
  }

  update (time, delta) {
    this.hud.update()
    this.player.update(delta)

    if (this.player.moved) {
      this.turn()
    }

    this.keyboard.update()

    if (this.player.health.isDepleted()) {
      this.game.scene.stop(this)
      this.game.scene.start('lose')
    }
  }

  turn () {
    this.turns++
    for (const event of this.map.update(this.turns)) {
      const tileX = event.x
      const tileY = event.y
      if (event.name === 'grow') {
        if (MOLD_START_CHANCE > Math.random()) {
          this.map.putTileAt(TILE_MOLD, tileX, tileY)
          this.map.addEvent('mold', tileX, tileY, MOLD_GROW_TIME)
        } else if (this.map.getTileAt(tileX, tileY) === TILE_PLANT) {
          this.map.putTileAt(TILE_CARROT, tileX, tileY)
          if (ANGER_CHANCE > Math.random()) {
            this.map.addEvent('anger', tileX, tileY, ANGER_DELAY)
          }
        }
      } else if (event.name === 'anger') {
        this.map.putTileAt(TILE_ANGER, tileX, tileY)
        this.map.addEvent('explosion', tileX, tileY, EXPLOSION_DELAY)
      } else if (event.name === 'explosion') {
        this.player.health.increment(-EXPLOSION_DAMAGE)
        for (const [circleX, circleY] of inCircle(tileX * TILE_WIDTH, tileY * TILE_HEIGHT)) {
          const tile = this.map.getTileAt(circleX, circleY)
          if (tile === TILE_CARROT || tile === TILE_ANGER || tile === TILE_MOLD) {
            this.map.putTileAt(TILE_FARM, circleX, circleY)
            this.map.removeEvent(circleX, circleY)
          }
        }
      } else if (event.name === 'mold') {
        for (const neighbor of NEIGHBORS) {
          const neighborX = tileX + neighbor[0]
          const neighborY = tileY + neighbor[0]
          const tile = this.map.getTileAt(neighborX, neighborY)
          if (tile === TILE_PLANT || tile === TILE_CARROT) {
            this.map.putTileAt(TILE_MOLD, neighborX, neighborY)
            this.map.addEvent('mold', neighborX, neighborY, MOLD_GROW_TIME)
          }
        }
      }
    }

    this.harvest()
  }

  harvest () {
    for (const [tileX, tileY] of inCircle(this.player.sprite.x, this.player.sprite.y)) {
      const tile = this.map.getTileAt(tileX, tileY)
      if (tile === TILE_CARROT || tile === TILE_FARM || tile === TILE_MOLD || tile === TILE_ANGER) {
        this.map.putTileAt(TILE_PLANT, tileX, tileY)
      }
      if (tile === TILE_CARROT) {
        this.player.food.increment(1)
      } else if (tile === TILE_FARM) {
        const delay = Math.round(PLANT_GROWTH_TIME_MIN + Math.random() * (PLANT_GROWTH_TIME_MAX - PLANT_GROWTH_TIME_MIN))
        if (this.map.getEventName(tileX, tileY) !== 'grow') {
          this.map.addEvent('grow', tileX, tileY, delay)
        }
      }
    }
  }
}

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
]

class GameMap {
  constructor (scene, camera) {
    const map = scene.make.tilemap({ key: 'map' })
    const tileset = map.addTilesetImage('tileset')
    this.layer = map.createLayer('ground', tileset, 0, 0)
    setCamera(camera, this.layer)
    this.events = new Map()
    this.time = 0
  }

  getTileAt (x, y) {
    const tile = this.layer.getTileAt(x, y)
    if (tile === null) {
      return -1
    } else {
      return tile.index
    }
  }

  putTileAt (index, x, y) {
    this.layer.putTileAt(index, x, y)
  }

  addEvent (name, x, y, delay) {
    this.events.set(x + ',' + y, {
      name,
      time: this.time + delay,
      x,
      y
    })
  }

  removeEvent (x, y) {
    this.events.delete(x + ',' + y)
  }

  getEventName (x, y) {
    if (this.events.has(x + ',' + y)) {
      return this.events.get(x + ',' + y).name
    } else {
      return null
    }
  }

  update (time) {
    this.time = time
    const toDelete = []
    const triggered = []
    for (const [key, event] of this.events.entries()) {
      if (this.time >= event.time) {
        toDelete.push(key)
        triggered.push(event)
      }
    }
    for (const key of toDelete) {
      this.events.delete(key)
    }
    return triggered
  }
}

class Keyboard {
  constructor (scene, keys) {
    this.keys = {}
    this.wasPressed = {}
    for (const key of keys) {
      this.keys[key] = scene.input.keyboard.addKey(key)
      this.wasPressed[key] = false
    }
  }

  isPressed (key) {
    return this.keys[key].isDown
  }

  isJustPressed (key) {
    return this.isPressed(key) && !this.wasPressed[key]
  }

  update () {
    for (const key in this.keys) {
      this.wasPressed[key] = this.isPressed(key)
    }
  }
}

class NumStat {
  constructor (level, max) {
    this.level = level
    this.max = max
  }

  increment (amount) {
    this.level += amount
    if (this.level < 0) {
      this.level = 0
    } else if (this.level > this.max) {
      this.level = this.max
    }
  }

  isDepleted () {
    return this.level <= 1e-5
  }
}

class Player {
  constructor (args) {
    const { scene, camera, keyboard, map, x, y } = args
    this.map = map
    this.x = x
    this.y = y
    this.sprite = scene.add.image(x * TILE_WIDTH, y * TILE_HEIGHT, 'selection')
    this.sprite.setOrigin(0)
    setCamera(camera, this.sprite)
    this.keyboard = keyboard
    this.health = new NumStat(HEALTH_MAX_LEVEL, HEALTH_MAX_LEVEL)
    this.food = new NumStat(0, 1000)
    this.moved = true
  }

  update (delta) {
    let deltaX = 0
    let deltaY = 0
    if (this.keyboard.isJustPressed(MOVE_LEFT)) {
      deltaX = -1
    } else if (this.keyboard.isJustPressed(MOVE_RIGHT)) {
      deltaX = 1
    } else if (this.keyboard.isJustPressed(MOVE_UP)) {
      deltaY = -1
    } else if (this.keyboard.isJustPressed(MOVE_DOWN)) {
      deltaY = 1
    }

    this.moved = false

    if (deltaX !== 0 || deltaY !== 0) {
      const newX = this.x + deltaX
      const newY = this.y + deltaY
      if (!isSolid(this.map.getTileAt(newX, newY))) {
        this.x = newX
        this.y = newY
        this.sprite.x = newX * TILE_WIDTH
        this.sprite.y = newY * TILE_HEIGHT
        this.moved = true
      }
    }
  }
}
