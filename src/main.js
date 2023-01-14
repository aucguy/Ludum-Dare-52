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
    height: 480,
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
    this.load.tilemapTiledJSON('map', 'assets/map.json')
    this.load.bitmapFont('font', 'assets/image/digit.png', 'assets/font.xml')
  }

  update () {
    this.scene.start('mainMenu')
  }
};

document.addEventListener('DOMContentLoaded', init)
