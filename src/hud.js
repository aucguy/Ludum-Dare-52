import { setCamera } from './util.js'

const BAR_HEIGHT = 20
const BAR_BACKGROUND_COLOR = 0xFFFFFF
const BAR_OUTLINE_WIDTH = 3
const BAR_OUTLINE_COLOR = 0x000000

class BarDisplay {
  constructor (args) {
    const { scene, camera, x, y, color, stat } = args
    this.stat = stat

    const outline = scene.add.rectangle(x, y, this.stat.max, BAR_HEIGHT, BAR_BACKGROUND_COLOR)
    setCamera(camera, outline)
    outline.setOrigin(0)
    outline.setStrokeStyle(BAR_OUTLINE_WIDTH, BAR_OUTLINE_COLOR)

    this.bar = scene.add.rectangle(x, y, this.stat.level, BAR_HEIGHT, color)
    setCamera(camera, this.bar)
    this.bar.setOrigin(0)
  }

  update () {
    this.bar.width = this.stat.level
  }
}

class ItemDisplay {
  constructor (args) {
    const { scene, camera, x, y, stat, icon } = args
    this.stat = stat

    const outline = scene.add.rectangle(x, y, 64, 40, 0x808080)
    setCamera(camera, outline)
    outline.setOrigin(0)

    const iconSprite = scene.add.image(x + 32, y + 4, icon)
    iconSprite.scale = 2
    setCamera(camera, iconSprite)
    iconSprite.setOrigin(0)

    this.digit = scene.add.bitmapText(x, y + 4, 'font', this.stat.level + '', 32)
    setCamera(camera, this.digit)
    this.digit.setOrigin(0)
  }

  update () {
    this.digit.text = this.stat.level + ''
  }
}

export class Hud {
  constructor (scene, player) {
    this.camera = scene.cameras.add(0, 0, scene.cameras.main.width, scene.cameras.main.height)

    this.healthBar = new BarDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 10,
      color: 0xFF0000,
      stat: player.health
    })

    this.foodDisplay = new ItemDisplay({
      scene,
      camera: this.camera,
      x: 560,
      y: 20,
      icon: 'carrot',
      stat: player.food
    })
  }

  update () {
    this.healthBar.update()
    this.foodDisplay.update()
  }
}
