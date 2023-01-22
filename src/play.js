import { Hud } from './hud.js'
import { setCamera, inCircle, TILE_WIDTH, TILE_HEIGHT } from './util.js'

const MOVE_UP = Phaser.Input.Keyboard.KeyCodes.W
const MOVE_LEFT = Phaser.Input.Keyboard.KeyCodes.A
const MOVE_DOWN = Phaser.Input.Keyboard.KeyCodes.S
const MOVE_RIGHT = Phaser.Input.Keyboard.KeyCodes.D

const HEALTH_MAX_LEVEL = 5

const PLANT_GROWTH_TIME_MIN = 10
const PLANT_GROWTH_TIME_MAX = 20
const ANGER_CHANCE = 0.3
const EXPLOSION_DELAY = 15
const EXPLOSION_DAMAGE = 1
const MAX_ANGER = 5

const TILE_VOID = -1
const TILE_FARM = 1
const TILE_ROCK = 2
const TILE_PLANT = 3
const TILE_CARROT = 4
const TILE_ANGER = 5

const SOLID_TILES = [
  TILE_VOID, TILE_ROCK
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
    this.events = null
  }

  create () {
    this.cameras.main.centerOn(20 / 2 * TILE_WIDTH, 15 / 2 * TILE_HEIGHT)
    this.physics.world.setBounds(0, 0, 20 * TILE_WIDTH, 15 * TILE_HEIGHT)
    this.cameras.main.setZoom(4)

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
      x: 5,
      y: 3
    })
    this.hud = new Hud(this, this.player)

    this.cameras.main.scrollX -= TILE_WIDTH / 2 * this.map.getWidth()
    this.cameras.main.scrollY -= TILE_HEIGHT / 2 * (this.map.getHeight())
    this.turns = 0
    this.events = new Map()

    for (let x = 0; x < this.map.getWidth(); x++) {
      for (let y = 0; y < this.map.getHeight(); y++) {
        this.harvest(x, y)
      }
    }
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
    for (const event of this.getTriggeredEvents(this.turns)) {
      const tileX = event.x
      const tileY = event.y
      if (event.name === 'grow') {
        this.grow(tileX, tileY)
      } else if (event.name === 'anger') {
        this.anger(tileX, tileY)
      } else if (event.name === 'explosion') {
        this.player.health.increment(-EXPLOSION_DAMAGE)
        for (const [circleX, circleY] of inCircle(tileX * TILE_WIDTH, tileY * TILE_HEIGHT)) {
          this.explode(circleX, circleY)
        }

        const explosion = this.add.sprite(
          (tileX + 0.5) * TILE_WIDTH,
          (tileY + 0.5) * TILE_HEIGHT,
          'explosion'
        )
        setCamera(this.cameras.main, explosion)
        explosion.play('explosion')
        explosion.on(
          Phaser.Animations.Events.ANIMATION_COMPLETE,
          explosion.destroy,
          explosion
        )
      }
    }

    this.harvest(this.player.x, this.player.y)

    if (this.map.numAnger < MAX_ANGER && ANGER_CHANCE > Math.random()) {
      const x = Math.round(Math.random() * this.map.getWidth())
      const y = Math.round(Math.random() * this.map.getHeight())
      if (this.map.getTileAt(x, y) === TILE_CARROT) {
        this.anger(x, y)
      }
    }
  }

  harvest (x, y) {
    const tile = this.map.getTileAt(x, y)
    if (tile === TILE_FARM || tile === TILE_ANGER || tile === TILE_CARROT) {
      this.map.putTileAt(TILE_PLANT, x, y)
      if (tile === TILE_CARROT) {
        this.player.food.increment(1)
      }
      if (this.getEventName !== 'grow') {
        const delay = Math.round(PLANT_GROWTH_TIME_MIN + Math.random() * (PLANT_GROWTH_TIME_MAX - PLANT_GROWTH_TIME_MIN))
        this.addEvent('grow', x, y, delay)
      }
    }
  }

  grow (x, y) {
    const tile = this.map.getTileAt(x, y)
    if (tile !== TILE_PLANT) {
      console.warn('attempt to grow a non plant')
      return
    }

    this.map.putTileAt(TILE_CARROT, x, y)
    if (this.hasEvent(x, y)) {
      console.warn('event still exists')
    }
    this.removeEvent(x, y) // unnecessary, just in case
  }

  anger (x, y) {
    if (this.map.getTileAt(x, y) !== TILE_CARROT) {
      console.warn('attempt to anger a non carrot')
      return
    }

    this.map.putTileAt(TILE_ANGER, x, y)
    this.addEvent('explosion', x, y, EXPLOSION_DELAY)
  }

  explode (x, y) {
    const tile = this.map.getTileAt(x, y)
    if (tile === TILE_PLANT || tile === TILE_CARROT || tile === TILE_ANGER) {
      this.map.putTileAt(TILE_FARM, x, y)
      if (this.hasEvent(x, y)) {
        console.warn('event still exists')
      }
      this.removeEvent(x, y) // unnecessary, just in case
    }
  }

  addEvent (name, x, y, delay) {
    this.events.set(x + ',' + y, {
      name,
      time: this.turns + delay,
      x,
      y
    })
  }

  removeEvent (x, y) {
    this.events.delete(x + ',' + y)
  }

  hasEvent (x, y) {
    return this.events.has(x + ',' + y)
  }

  getEventName (x, y) {
    if (this.events.has(x + ',' + y)) {
      return this.events.get(x + ',' + y).name
    } else {
      return null
    }
  }

  getTriggeredEvents () {
    const toDelete = []
    const triggered = []
    for (const [key, event] of this.events.entries()) {
      if (this.turns >= event.time) {
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

class GameMap {
  constructor (scene, camera) {
    this.scene = scene
    this.map = scene.make.tilemap({ key: 'map' })
    const tileset = this.map.addTilesetImage('tileset')
    this.layer = this.map.createLayer('ground', tileset, 0, 0)
    setCamera(camera, this.layer)
    this.numAnger = 0
    this.steam = new Map()
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
    if (this.getTileAt(x, y) === TILE_ANGER) {
      this.numAnger--
    }
    if (index === TILE_ANGER) {
      this.numAnger++

      const steam = this.scene.add.sprite((x + 0.5) * TILE_WIDTH, y * TILE_HEIGHT, 'steam')
      steam.play('steam')
      setCamera(this.scene.cameras.main, steam)
      this.steam.set(`${x},${y}`, steam)
    } else if(this.steam.has(`${x},${y}`)) {
      this.steam.get(`${x},${y}`).destroy()
    }
    this.layer.putTileAt(index, x, y)
  }

  getWidth () {
    return this.map.width
  }

  getHeight () {
    return this.map.height
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
