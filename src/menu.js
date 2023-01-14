export class MainMenu extends Phaser.Scene {
  create () {
    button(this, 'Play!', 320, 240, 'play')
  }
}

export class LoseScene extends Phaser.Scene {
  create () {
    button(this, 'You Lost!', 320, 240, null)
    button(this, 'Score: ' + 0, 320, 300, null)
    button(this, 'Play Again!', 320, 360, 'play')
  }
}

function button (scene, text, x, y, sceneName) {
  const outline = scene.add.rectangle(x, y, 300, 48, 0xFFFFFF)
  const textSprite = scene.add.bitmapText(x, y, 'font', text, 32)
  textSprite.setOrigin(0.5)
  outline.setInteractive()
  if (sceneName !== null) {
    outline.addListener('pointerdown', () => {
      scene.game.scene.stop(scene)
      scene.game.scene.start(sceneName)
    })
  }
}
