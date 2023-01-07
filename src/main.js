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

const MOVE_UP = Phaser.Input.Keyboard.KeyCodes.W;
const MOVE_LEFT = Phaser.Input.Keyboard.KeyCodes.A;
const MOVE_DOWN = Phaser.Input.Keyboard.KeyCodes.S;
const MOVE_RIGHT = Phaser.Input.Keyboard.KeyCodes.D;
const ACTION_KEY = Phaser.Input.Keyboard.KeyCodes.SPACE;

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
      MOVE_RIGHT,
      ACTION_KEY
    ]);
    this.map = new GameMap(this, this.cameras.main);

    this.player = new Player({
      scene: this,
      camera: this.cameras.main,
      keyboard: this.keyboard,
      x: 0,
      y: 0
    });
    this.tileSelection = new TileSelection(this, this.cameras.main, this.player, this.map);
    this.hud = new Hud(this, this.player);

    this.physics.add.collider(this.player.sprite, this.map.layer);
    this.cameras.main.setZoom(2);
  },
  update(time, delta) {
    this.hud.update();
    this.player.update(delta);
    this.tileSelection.update(time);

    if(this.keyboard.isPressed(ACTION_KEY) && this.tileSelection.isSelected()) {
      const tile = this.map.getTileAt(this.tileSelection.selectedX, this.tileSelection.selectedY);
      if(tile === TILE_FARM) {
        this.map.putTileAt(TILE_CARROT, this.tileSelection.selectedX, this.tileSelection.selectedY);
      }
    }
  }
});

const TILE_FARM = 2;
const TILE_CARROT = 3;

const GameMap = util.extend(Object, 'GameMap', {
  constructor: function(scene, camera) {
    const map = scene.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tileset');
    this.layer = map.createLayer('ground', tileset, 0, 0);
    setCamera(camera, this.layer);
    map.setCollision([TILE_FARM, TILE_CARROT], undefined, undefined, this.layer);
  },
  isTileActionable(x, y) {
    return this.layer.getTileAt(x, y).index === TILE_FARM;
  },
  getTileAt(x, y) {
    return this.layer.getTileAt(x, y).index;
  },
  putTileAt(index, x, y) {
    this.layer.putTileAt(index, x, y);
  }
});

const Keyboard = util.extend(Object, 'Keyboard', {
  constructor: function(scene, keys) {
    this.keys = {};
    for(let key of keys) {
      /*this.keyStates[key] = false;
      scene.input.keyboard.on(`keydown-${key}`, () => {
        this.keyStates[key] = true;
      }, this);
      scene.input.keyboard.on(`keyup-${key}`, () => {
        this.keyStates[key] = false;
      }, this);*/
      this.keys[key] = scene.input.keyboard.addKey(key);
    }
  },
  isPressed(key) {
    return this.keys[key].isDown;
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

const Direction = {
  NONE: 'none',
  UP: 'up',
  LEFT: 'left',
  DOWN: 'down',
  RIGHT: 'right'
};

const Player = util.extend(Object, 'Player', {
  constructor: function(args) {
    const { scene, camera, keyboard } = args;
    this.sprite = scene.physics.add.image(0, 0, 'player');
    this.sprite.setCollideWorldBounds(true);
    setCamera(camera, this.sprite);
    camera.startFollow(this.sprite);
    this.keyboard = keyboard;
    this.oxygen = new NumStat(OXYGEN_MAX_LEVEL, OXYGEN_MAX_LEVEL);
    this.health = new NumStat(HEALTH_MAX_LEVEL, HEALTH_MAX_LEVEL);
    this.horizontalDirection = Direction.NONE;
    this.verticalDirection = Direction.NONE;
    this.lastDirection = Direction.NONE;
  },
  update(delta) {
    this.sprite.setVelocity(0);
    this.oxygen.increment(-delta / 1000);

    let change = null;

    if(this.horizontalDirection === Direction.LEFT) {
      change = !this.keyboard.isPressed(MOVE_LEFT);
    } else if(this.horizontalDirection === Direction.RIGHT) {
      change = !this.keyboard.isPressed(MOVE_RIGHT);
    } else {
      change = true;
    }

    if(change) {
      if(this.keyboard.isPressed(MOVE_LEFT)) {
        this.horizontalDirection = Direction.LEFT;
        this.lastDirection = Direction.LEFT;
      } else if(this.keyboard.isPressed(MOVE_RIGHT)) {
        this.horizontalDirection = Direction.RIGHT;
        this.lastDirection = Direction.RIGHT;
      } else {
        this.horizontalDirection = Direction.NONE;
      }
    }

    let velocityX = null;

    if(this.horizontalDirection === Direction.LEFT) {
      velocityX = -1;
    } else if(this.horizontalDirection === Direction.RIGHT) {
      velocityX = 1;
    } else {
      velocityX = 0;
    }

    change = null;

    if(this.verticalDirection === Direction.UP) {
      change = !this.keyboard.isPressed(MOVE_UP);
    } else if(this.horizontalDirection === Direction.DOWN) {
      change = !this.keyboard.isPressed(MOVE_DOWN);
    } else {
      change = true;
    }

    if(change) {
      if(this.keyboard.isPressed(MOVE_UP)) {
        this.verticalDirection = Direction.UP;
        this.lastDirection = Direction.UP;
      } else if(this.keyboard.isPressed(MOVE_DOWN)) {
        this.verticalDirection = Direction.DOWN;
        this.lastDirection = Direction.DOWN;
      } else {
        this.verticalDirection = Direction.NONE;
      }
    }

    let velocityY = null;

    if(this.verticalDirection === Direction.UP) {
      velocityY = -1;
    } else if(this.verticalDirection === Direction.DOWN) {
      velocityY = 1;
    } else {
      velocityY = 0;
    }

    if(velocityX !== 0 || velocityY !== 0) {
      const magnitude = PLAYER_VELOCITY / Math.sqrt(velocityX * velocityX + velocityY * velocityY);
      this.sprite.setVelocity(velocityX * magnitude, velocityY * magnitude);
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

    const outline = scene.add.rectangle(x, y, this.stat.max, BAR_HEIGHT, BAR_BACKGROUND_COLOR);
    setCamera(camera, outline);
    outline.setOrigin(0);
    outline.setStrokeStyle(BAR_OUTLINE_WIDTH, BAR_OUTLINE_COLOR);

    this.bar = scene.add.rectangle(x, y, this.stat.level, BAR_HEIGHT, color);
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

const TILE_WIDTH = 16;
const TILE_HEIGHT = 16;

const TileSelection = util.extend(Object, 'TileSelection', {
  constructor: function(scene, camera, player, map) {
    this.player = player;
    this.map = map;
    this.sprite = scene.add.rectangle(0, 0, TILE_WIDTH, TILE_HEIGHT, 0xFFFFFF);
    this.sprite.setOrigin(0);
    setCamera(camera, this.sprite);
    this.selectedX = null;
    this.selectedY = null;
  },
  update(time) {
    let visible = null;
    let dirX = null;
    let dirY = null;

    if(this.player.lastDirection === Direction.LEFT) {
      dirX = -1;
      dirY = 0;
      visible = true;
    } else if(this.player.lastDirection === Direction.RIGHT) {
      dirX = 1;
      dirY = 0;
      visible = true;
    } else if(this.player.lastDirection === Direction.UP) {
      dirX = 0;
      dirY = -1;
      visible = true;
    } else if(this.player.lastDirection === Direction.DOWN) {
      dirX = 0;
      dirY = 1;
      visible = true;
    } else {
      dirX = 0;
      dirY = 0;
      visible = false;
    }

    const tileX = Math.floor((this.player.sprite.x + dirX * 3 / 2 * 0.95 * TILE_WIDTH) / TILE_WIDTH);
    const tileY = Math.floor((this.player.sprite.y + dirY * 3 / 2 * 0.95 * TILE_HEIGHT) / TILE_HEIGHT);

    if(!this.map.isTileActionable(tileX, tileY)) {
      visible = false;
    }

    if(visible) {
      this.sprite.x = tileX * TILE_WIDTH;
      this.sprite.y = tileY * TILE_HEIGHT;
      this.sprite.alpha = Math.sin(time / 250) * 0.2 + 0.6;
      this.selectedX = tileX;
      this.selectedY = tileY;
    } else {
      this.sprite.alpha = 0;
      this.selectedX = null;
      this.selectedY = null;
    }
  },
  isSelected() {
    return this.selectedX !== null && this.selectedY !== null;
  }
});