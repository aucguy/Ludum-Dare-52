export class MainMenu extends Phaser.Scene {
  create () {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const backgroundImage = this.add.image(width / 2, height / 2, 'background')
    backgroundImage.scale = 1 / 2
    this.add.rectangle(
      width / 2,
      height / 2,
      width,
      height,
      0x000000,
      0.5
    )
    button(this, 'Play!', width / 2, height / 2, 'play')
  }
}

export class LoseScene extends Phaser.Scene {
  create (config) {
    const width = this.cameras.main.width
    const height = this.cameras.main.height
    const spacing = 80

    const background = this.add.rectangle(
      0,
      0,
      width,
      height,
      0x000000,
      0.5
    )
    background.setOrigin(0)
    button(this, 'You Lost!', width / 2, height / 2 - spacing, null)
    button(this, 'Score: ' + config.score, width / 2, height / 2, null)
    button(this, 'Play Again!', width / 2, height / 2 + spacing, 'play')
  }
}

function button (scene, text, x, y, sceneName) {
  const outline = scene.add.image(x, y, 'button')
  const textSprite = scene.add.bitmapText(x, y - 4, 'font', text, 32)
  textSprite.setOrigin(0.5)
  outline.scale = 4
  outline.setInteractive()
  if (sceneName !== null) {
    outline.addListener('pointerdown', () => {
      scene.game.scene.stop(scene)
      scene.game.scene.start(sceneName)
    })
  }
}
