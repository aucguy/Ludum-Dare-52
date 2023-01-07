import * as util from '/lib/util.js';

export function init() {
  const game = new Phaser.Game({
    width: 640,
    height: 480,
    parent: 'gameContainer',
    scene: new util.BootScene('start'),
    physics: {
      default: 'arcade',
      arcade: {
        //debug: true
      }
    },
    pixelArt: true
  });

  game.scene.add('start', new StartScene());

  return game;
}

const MOVE_UP = 'W';
const MOVE_LEFT = 'A';
const MOVE_DOWN = 'S';
const MOVE_RIGHT = 'D';

const PLAYER_VELOCITY = 100;

function setCamera(camera, sprite) {
  sprite.cameraFilter = 0xFFFFFFFF ^ camera.id;
}

const StartScene = util.extend(Phaser.Scene, 'StartScene', {
  constructor: function() {
    this.constructor$Scene();
    this.keyboard = null;
    this.player = null;
    this.hud = null;
  },
  create() {
    this.cameras.main.setBounds(0, 0, 256 * 16 * 2, 256 * 16 * 2);
    this.physics.world.setBounds(0, 0, 256 * 16 * 2, 256 * 16 * 2);

    this.keyboard = new Keyboard(this, [
      MOVE_UP,
      MOVE_LEFT,
      MOVE_DOWN,
      MOVE_RIGHT
    ]);
    const map = this.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tileset');
    const layer = map.createLayer('ground', tileset, 0, 0);
    setCamera(this.cameras.main, layer);

    this.player = new Player({
      scene: this,
      camera: this.cameras.main,
      keyboard: this.keyboard,
      x: 0,
      y: 0
    });
    this.cameras.main.setZoom(2);
    this.hud = new Hud(this, this.player);
  },
  update(delta) {
    this.hud.update();
    this.player.update(delta);
  }
});

const Keyboard = util.extend(Object, 'Keyboard', {
  constructor: function(scene, keys) {
    this.keyStates = {};
    for(let key of keys) {
      this.keyStates[key] = false;
      scene.input.keyboard.on(`keydown-${key}`, () => {
        this.keyStates[key] = true;
      }, this);
      scene.input.keyboard.on(`keyup-${key}`, () => {
        this.keyStates[key] = false;
      }, this);
    }
  },
  isPressed(key) {
    return this.keyStates[key];
  }
});

const NumStat = util.extend(Object, 'NumStat', {
  constructor: function(level, max) {
    this.level = level;
    this.max = max;
  },
  increment(amount) {
    this.level += amount;
    if(this.level < 0) {
      this.level = 0;
    } else if(this.level > this.max) {
      this.level = this.max;
    }
  },
  is_depleted() {
    return this.level <= 1e-5;
  }
});

const Player = util.extend(Object, 'Player', {
  constructor: function(args) {
    const { scene, camera, keyboard, x, y } = args;
    this.sprite = scene.physics.add.image(0, 0, 'hello');
    this.sprite.setCollideWorldBounds(true);
    setCamera(camera, this.sprite);
    camera.startFollow(this.sprite);
    this.keyboard = keyboard;
    this.oxygen = new NumStat(OXYGEN_MAX_LEVEL, OXYGEN_MAX_LEVEL);
    this.health = new NumStat(HEALTH_MAX_LEVEL, HEALTH_MAX_LEVEL);
  },
  update(delta) {
    this.sprite.setVelocity(0);
    this.oxygen.increment(-delta / 1000 / 1000);
    if(this.keyboard.isPressed(MOVE_UP)) {
      this.sprite.setVelocityY(-PLAYER_VELOCITY);
    }
    if(this.keyboard.isPressed(MOVE_LEFT)) {
      this.sprite.setVelocityX(-PLAYER_VELOCITY);
    }
    if(this.keyboard.isPressed(MOVE_DOWN)) {
      this.sprite.setVelocityY(PLAYER_VELOCITY);
    }
    if(this.keyboard.isPressed(MOVE_RIGHT)) {
      this.sprite.setVelocityX(PLAYER_VELOCITY);
    }
  }
});

const BAR_HEIGHT = 20;
const BAR_BACKGROUND_COLOR = 0xFFFFFF;
const BAR_OUTLINE_WIDTH = 3;
const BAR_OUTLINE_COLOR = 0x000000;

const NumStatDisplay = util.extend(Object, 'NumStatDisplay', {
  constructor: function(args) {
    const { scene, camera, x, y, color, stat } = args;
    this.stat = stat;

    const outline = scene.add.rectangle(x, y, this.level, BAR_HEIGHT, BAR_BACKGROUND_COLOR);
    setCamera(camera, outline);
    outline.setOrigin(0);
    outline.setStrokeStyle(BAR_OUTLINE_WIDTH, BAR_OUTLINE_COLOR);

    this.bar = scene.add.rectangle(x, y, this.level, BAR_HEIGHT, color);
    setCamera(camera, this.bar);
    this.bar.setOrigin(0);
  },
  update() {
    this.bar.width = this.stat.level;
  }
});

const OXYGEN_MAX_LEVEL = 100;
const HEALTH_MAX_LEVEL = 100;

const Hud = util.extend(Object, 'Hud', {
  constructor: function(scene, player) {
    this.camera = scene.cameras.add(0, 0, scene.cameras.main.width, scene.cameras.main.height);

    this.oxygenBar = new NumStatDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 10,
      color: 0x0000FF,
      stat: player.oxygen
    });

    this.healthBar = new NumStatDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 40,
      color: 0xFF0000,
      stat: player.health
    });
  },
  update() {
    this.oxygenBar.update();
  }
});