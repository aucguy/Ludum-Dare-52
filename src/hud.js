import { setCamera, TILE_HEIGHT } from './util.js'

class BarDisplay {
  constructor (args) {
    const { scene, camera, x, y, stat } = args
    this.stat = stat

    this.sprites = []
    for (let i = 0; i < this.stat.max; i++) {
      const sprite = scene.add.sprite(0, y, 'heart')
      sprite.scale = 2
      sprite.x = x + i * (2 + sprite.displayWidth)
      setCamera(camera, sprite)
      this.sprites.push(sprite)
    }
  }

  update () {
    for (let i = 0; i < this.stat.max; i++) {
      if (i < this.stat.level) {
        this.sprites[i].play('full')
      } else {
        this.sprites[i].play('empty')
      }
    }
  }
}

class ItemDisplay {
  constructor (args) {
    const { scene, camera, x, y, stat, icon } = args
    this.stat = stat

    const iconSprite = scene.add.image(x, y, icon)
    iconSprite.scale = 2
    setCamera(camera, iconSprite)

    this.digit = scene.add.bitmapText(
      x + iconSprite.displayWidth,
      y - Math.round(iconSprite.displayHeight / 4),
      'font',
      this.stat.level + '',
      32
    )
    setCamera(camera, this.digit)
  }

  update () {
    this.digit.text = this.stat.level + ''
  }
}

export class Hud {
  constructor (scene, player) {
    this.camera = scene.cameras.add(0, 0, scene.cameras.main.width, scene.cameras.main.height)

    const background = scene.add.image(0, 16 * 7 * 4, 'hudBackground')
    background.scale = 4
    background.setOrigin(0)

    const height = this.camera.height
    const mapHeight = scene.map.getHeight()
    const zoom = scene.cameras.main.zoom
    const y = height - (height - TILE_HEIGHT * mapHeight * zoom) / 2

    this.healthBar = new BarDisplay({
      scene,
      camera: this.camera,
      x: 32,
      y,
      stat: player.health
    })

    this.foodDisplay = new ItemDisplay({
      scene,
      camera: this.camera,
      x: this.camera.width / 2,
      y,
      icon: 'carrot',
      stat: player.food
    })
  }

  update () {
    this.healthBar.update()
    this.foodDisplay.update()
  }
}
