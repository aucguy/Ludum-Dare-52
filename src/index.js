import { MainMenu, LoseScene } from './menu.js'
import { PlayScene } from './play.js'

let errored = false
let game = null

window.addEventListener('error', event => {
  if (errored) {
    console.warn('multiple errors')
    return
  }

  errored = true

  // swap displays and display error
  const errorDiv = document.getElementById('error div')
  const errorText = document.getElementById('error text')
  const display = document.getElementById('display')
  const loadingLogo = document.getElementById('loadingLogo')

  if (errorText && event.error) {
    errorText.innerHTML = event.error.stack
  }
  if (errorDiv) {
    errorDiv.style.display = 'block'
  }

  if (loadingLogo !== null) {
    loadingLogo.style.display = 'none'
  }

  if (display !== null) {
    display.style.display = 'none'
  }

  if (game !== null) {
    game.sound.stopAll()
    game.destroy()
    game.canvas.style.display = 'none'
  }
})

function init () {
  const loadingLogo = document.getElementById('loadingLogo')
  if (loadingLogo !== null) {
    loadingLogo.parentElement.removeChild(loadingLogo)
  }

  game = new Phaser.Game({
    width: 640,
    height: 512,
    parent: 'gameContainer',
    scene: new BootScene(),
    physics: {
      default: 'arcade',
      arcade: {
        // debug: true
      }
    },
    pixelArt: true
  })

  game.scene.add('play', new PlayScene())
  game.scene.add('mainMenu', new MainMenu())
  game.scene.add('lose', new LoseScene())

  return game
}

class BootScene extends Phaser.Scene {
  preload () {
    this.load.image('player', 'assets/image/player.png')
    this.load.image('tileset', 'assets/image/tileset.png')
    this.load.image('carrot', 'assets/image/carrot.png')
    this.load.image('selection', 'assets/image/selection.png')
    this.load.image('hudBackground', 'assets/image/hudBackground.png')
    this.load.image('button', 'assets/image/button.png')
    this.load.spritesheet('heart', 'assets/image/heart.png', {
      frameWidth: 18,
      frameHeight: 18
    })
    this.load.spritesheet('steam', 'assets/image/steam.png', {
      frameWidth: 16,
      frameHeight: 16
    })
    this.load.spritesheet('explosion', 'assets/image/explosion.png', {
      frameWidth: 48,
      frameHeight: 48
    })
    this.load.tilemapTiledJSON('map', 'assets/map.json')
    this.load.bitmapFont('font', 'assets/image/font.png', 'assets/font.xml')
    this.load.audio('explosion', 'assets/audio/explosion.wav')
    this.load.audio('angry', 'assets/audio/angry.wav')
    this.load.audio('move', 'assets/audio/move.wav')
    this.load.audio('lose', 'assets/audio/lose.wav')
  }

  create () {
    this.anims.create({
      key: 'full',
      frames: this.anims.generateFrameNumbers('heart', {
        frames: [0]
      })
    })

    this.anims.create({
      key: 'empty',
      frames: this.anims.generateFrameNumbers('heart', {
        frames: [1]
      })
    })

    this.anims.create({
      key: 'steam',
      frames: this.anims.generateFrameNumbers('steam', {
        start: 0,
        end: 5
      }),
      frameRate: 12,
      repeat: -1
    })

    this.anims.create({
      key: 'explosion',
      frames: this.anims.generateFrameNames('explosion', {
        start: 0,
        end: 2
      }),
      frameRate: 4,
      repeat: 0
    })
  }

  update () {
    this.scene.start('mainMenu')
  }
};

document.addEventListener('DOMContentLoaded', init)
