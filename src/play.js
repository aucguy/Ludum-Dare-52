import { Hud } from './hud.js'
import { setCamera, inCircle, Scheduler, TILE_WIDTH, TILE_HEIGHT } from './util.js'

const MOVE_UP = Phaser.Input.Keyboard.KeyCodes.W
const MOVE_LEFT = Phaser.Input.Keyboard.KeyCodes.A
const MOVE_DOWN = Phaser.Input.Keyboard.KeyCodes.S
const MOVE_RIGHT = Phaser.Input.Keyboard.KeyCodes.D

const HEALTH_MAX_LEVEL = 100
const PLAYER_VELOCITY = 100

const PLANT_GROWTH_TIME_MIN = 10 * 1000
const PLANT_GROWTH_TIME_MAX = 20 * 1000
const MOLD_GROW_TIME = 3000
const MOLD_START_CHANCE = 0.1
const ANGER_WARNING_DELAY = 5 * 1000
const ANGER_REAL_DELAY = 10 * 1000
const ANGER_PASS_DELAY = 5 * 1000
const ANGER_CHANCE = 0.1
const EXPLOSION_DAMAGE = 20

// const TILE_VOID = -1
// const TILE_EMPTY = 0
// const TILE_GROUND = 1
const TILE_FARM = 2
const TILE_PLANT = 3
// const TILE_FLOOR = 4
const TILE_CARROT = 5
const TILE_ROCK = 6
const TILE_ANGER_REAL = 7
const TILE_ANGER_WARNING = 8
const TILE_TOPRIGHT_WALL = 9
const TILE_BOTTOMLEFT_WALL = 10
const TILE_BOTTOMRIGHT_WALL = 11
const TILE_WORKING_VENT = 12
const TILE_BROKEN_VENT = 13
const TILE_MOLD = 14

const SOLID_TILES = [
  TILE_ROCK,
  TILE_TOPRIGHT_WALL, TILE_BOTTOMLEFT_WALL, TILE_BOTTOMRIGHT_WALL,
  TILE_WORKING_VENT, TILE_BROKEN_VENT
]

export class PlayScene extends Phaser.Scene {
  constructor () {
    super()
    this.keyboard = null
    this.player = null
    this.hud = null
  }

  create () {
    this.scheduler = new Scheduler()
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
      x: 64,
      y: 64
    })
    this.hud = new Hud(this, this.player)

    this.physics.add.collider(this.player.sprite, this.map.layer)
    this.cameras.main.setZoom(2)
    this.moldGrowth = new MoldGrowth(this.map)
  }

  update (time, delta) {
    this.hud.update()
    this.player.update(delta)

    for (const event of this.scheduler.update(time)) {
      const tileX = event.data.tileX
      const tileY = event.data.tileY
      if (event.type === 'grow') {
        if (MOLD_START_CHANCE > Math.random()) {
          this.map.putTileAt(TILE_MOLD, tileX, tileY)
          this.moldGrowth.addFutureGrowth(tileX, tileY)
        } else if (this.map.getTileAt(tileX, tileY) === TILE_PLANT) {
          this.map.putTileAt(TILE_CARROT, tileX, tileY)
          if (ANGER_CHANCE > Math.random()) {
            this.scheduler.addEvent(ANGER_WARNING_DELAY, 'anger-warning', {
              tileX,
              tileY
            })
          }
        }
      } else if (event.type === 'anger-warning') {
        this.map.putTileAt(TILE_ANGER_WARNING, tileX, tileY)
        this.scheduler.addEvent(ANGER_REAL_DELAY, 'anger-real', {
          tileX,
          tileY
        })
      } else if (event.type === 'anger-real') {
        this.map.putTileAt(TILE_ANGER_REAL, tileX, tileY)
        this.scheduler.addEvent(ANGER_PASS_DELAY, 'anger-pass', {
          tileX,
          tileY
        })
      } else if (event.type === 'anger-pass') {
        this.map.putTileAt(TILE_CARROT, tileX, tileY)
      }
    }

    this.moldGrowth.update(time)

    this.harvest()
    this.checkExplosions()

    this.keyboard.update()

    if (this.player.health.isDepleted()) {
      this.game.scene.stop(this)
      this.game.scene.start('lose')
    }
  }

  harvest () {
    for (const [tileX, tileY] of inCircle(this.player.sprite.x, this.player.sprite.y)) {
      const tile = this.map.getTileAt(tileX, tileY)
      if (tile === TILE_CARROT || tile === TILE_FARM || tile === TILE_MOLD) {
        this.map.putTileAt(TILE_PLANT, tileX, tileY)
        const delay = PLANT_GROWTH_TIME_MIN + Math.random() * (PLANT_GROWTH_TIME_MAX - PLANT_GROWTH_TIME_MIN)
        this.scheduler.addEvent(delay, 'grow', {
          tileX,
          tileY
        })
      }
      if (tile === TILE_CARROT) {
        this.player.food.increment(1)
      }
    }
  }

  checkExplosions () {
    let destroy = []
    for (const [tileX, tileY] of inCircle(this.player.sprite.x, this.player.sprite.y)) {
      const tile = this.map.getTileAt(tileX, tileY)
      if (tile === TILE_ANGER_REAL) {
        destroy = destroy.concat(inCircle((tileX + 1 / 2) * TILE_WIDTH, (tileY + 1 / 2) * TILE_WIDTH))
        this.player.health.increment(-EXPLOSION_DAMAGE)
      }
    }

    for (const [tileX, tileY] of destroy) {
      const tile = this.map.getTileAt(tileX, tileY)
      if (tile !== TILE_ROCK) {
        this.map.putTileAt(TILE_FARM, tileX, tileY)
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

class MoldGrowth {
  constructor (map) {
    this.map = map
    this.futureGrowth = new Map()
    this.time = null
  }

  addFutureGrowth (tileX, tileY) {
    this.futureGrowth.set(`${tileX},${tileY}`, this.time + MOLD_GROW_TIME)
  }

  removeFutureGrowth (tileX, tileY) {
    this.futureGrowth.delete(`${tileX},${tileY}`)
  }

  update (time) {
    this.time = time
    const toRemove = []
    for (const [key, time] of this.futureGrowth.entries()) {
      if (time <= this.time) {
        toRemove.push(key)
        const parts = key.split(',')
        const tileX = Number.parseInt(parts[0])
        const tileY = Number.parseInt(parts[1])
        if (this.map.getTileAt(tileX, tileY) === TILE_MOLD) {
          for (const neighbor of NEIGHBORS) {
            const tile = this.map.getTileAt(tileX + neighbor[0], tileY + neighbor[1])
            if (tile === TILE_PLANT || tile === TILE_CARROT) {
              this.map.putTileAt(TILE_MOLD, tileX + neighbor[0], tileY + neighbor[1])
              this.addFutureGrowth(tileX + neighbor[0], tileY + neighbor[1])
            }
          }
        }
      }
    }
    for (const i of toRemove) {
      this.futureGrowth.delete(i)
    }
  }
}

class GameMap {
  constructor (scene, camera) {
    const map = scene.make.tilemap({ key: 'map' })
    const tileset = map.addTilesetImage('tileset')
    this.layer = map.createLayer('ground', tileset, 0, 0)
    setCamera(camera, this.layer)
    map.setCollision(SOLID_TILES, undefined, undefined, this.layer)
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

const Direction = {
  NONE: 'none',
  UP: 'up',
  LEFT: 'left',
  DOWN: 'down',
  RIGHT: 'right'
}

class Player {
  constructor (args) {
    const { scene, camera, keyboard, map, x, y } = args
    this.map = map
    this.sprite = scene.physics.add.image(x, y, 'player')
    this.sprite.setCollideWorldBounds(true)
    setCamera(camera, this.sprite)
    this.keyboard = keyboard
    this.health = new NumStat(HEALTH_MAX_LEVEL, HEALTH_MAX_LEVEL)
    this.food = new NumStat(0, 1000)
    this.horizontalDirection = Direction.NONE
    this.verticalDirection = Direction.NONE
    this.lastDirection = Direction.NONE
  }

  update (delta) {
    this.sprite.setVelocity(0)

    const tileLeft = Math.floor(this.sprite.x / TILE_WIDTH - 1 / 2 * 0.95)
    const tileRight = Math.floor(this.sprite.x / TILE_WIDTH + 1 / 2 * 0.95)
    const tileUp = Math.floor(this.sprite.y / TILE_HEIGHT - 1 / 2 * 0.95)
    const tileDown = Math.floor(this.sprite.y / TILE_HEIGHT + 1 / 2 * 0.95)

    const inMold = this.map.getTileAt(tileLeft, tileUp) === TILE_MOLD &&
        this.map.getTileAt(tileLeft, tileDown) === TILE_MOLD &&
        this.map.getTileAt(tileRight, tileUp) === TILE_MOLD &&
        this.map.getTileAt(tileRight, tileDown) === TILE_MOLD

    if (inMold) {
      this.health.increment(-5 * delta / 1000)
    }

    let change = null

    if (this.horizontalDirection === Direction.LEFT) {
      change = !this.keyboard.isPressed(MOVE_LEFT)
    } else if (this.horizontalDirection === Direction.RIGHT) {
      change = !this.keyboard.isPressed(MOVE_RIGHT)
    } else {
      change = true
    }

    if (change) {
      if (this.keyboard.isPressed(MOVE_LEFT)) {
        this.horizontalDirection = Direction.LEFT
        this.lastDirection = Direction.LEFT
      } else if (this.keyboard.isPressed(MOVE_RIGHT)) {
        this.horizontalDirection = Direction.RIGHT
        this.lastDirection = Direction.RIGHT
      } else {
        this.horizontalDirection = Direction.NONE
      }
    }

    let velocityX = null

    if (this.horizontalDirection === Direction.LEFT) {
      velocityX = -1
    } else if (this.horizontalDirection === Direction.RIGHT) {
      velocityX = 1
    } else {
      velocityX = 0
    }

    change = null

    if (this.verticalDirection === Direction.UP) {
      change = !this.keyboard.isPressed(MOVE_UP)
    } else if (this.horizontalDirection === Direction.DOWN) {
      change = !this.keyboard.isPressed(MOVE_DOWN)
    } else {
      change = true
    }

    if (change) {
      if (this.keyboard.isPressed(MOVE_UP)) {
        this.verticalDirection = Direction.UP
        this.lastDirection = Direction.UP
      } else if (this.keyboard.isPressed(MOVE_DOWN)) {
        this.verticalDirection = Direction.DOWN
        this.lastDirection = Direction.DOWN
      } else {
        this.verticalDirection = Direction.NONE
      }
    }

    let velocityY = null

    if (this.verticalDirection === Direction.UP) {
      velocityY = -1
    } else if (this.verticalDirection === Direction.DOWN) {
      velocityY = 1
    } else {
      velocityY = 0
    }

    if (velocityX !== 0 || velocityY !== 0) {
      const magnitude = PLAYER_VELOCITY / Math.sqrt(velocityX * velocityX + velocityY * velocityY)
      this.sprite.setVelocity(velocityX * magnitude, velocityY * magnitude)
    }
  }
}
