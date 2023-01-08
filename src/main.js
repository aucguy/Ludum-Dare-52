import * as util from '/lib/util.js';

export function init() {
  const game = new Phaser.Game({
    width: 640,
    height: 480,
    parent: 'gameContainer',
    scene: new CustomBootScene('start'),
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

const CustomBootScene = util.extend(util.BootScene, 'CustomBootScene', {
  constructor: function(nextScene) {
    this.constructor$BootScene(nextScene);
  },
  create() {
    this.create$BootScene();
  }
});

const MOVE_UP = Phaser.Input.Keyboard.KeyCodes.W;
const MOVE_LEFT = Phaser.Input.Keyboard.KeyCodes.A;
const MOVE_DOWN = Phaser.Input.Keyboard.KeyCodes.S;
const MOVE_RIGHT = Phaser.Input.Keyboard.KeyCodes.D;
const ACTION_KEY = Phaser.Input.Keyboard.KeyCodes.SPACE;

const PLAYER_VELOCITY = 100;
const PLANT_GROWTH_TIME = 3000;

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
    this.scheduler = new Scheduler();
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
      map: this.map,
      x: 64,
      y: 64
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

    for(let event of this.scheduler.update(time)) {
      if(event.type === 'grow') {
        this.map.putTileAt(TILE_CARROT, event.data.tileX, event.data.tileY);
      }
    }

    if(this.keyboard.isJustPressed(ACTION_KEY) && this.tileSelection.isSelected()) {
      const tileX = this.tileSelection.selectedX;
      const tileY = this.tileSelection.selectedY;
      const tile = this.map.getTileAt(tileX, tileY);
      if(tile === TILE_FARM) {
        this.map.putTileAt(TILE_PLANT, tileX, tileY);
        this.scheduler.addEvent(PLANT_GROWTH_TIME, 'grow', {
          tileX,
          tileY
        });
      } else if(tile === TILE_CARROT) {
        this.map.putTileAt(TILE_FARM, tileX, tileY);
        this.player.food.increment(1);
      }
    }

    this.keyboard.update();
  }
});

const TILE_VOID = -1;
const TILE_EMPTY = 0;
const TILE_GROUND = 1;
const TILE_FARM = 2;
const TILE_PLANT = 3;
const TILE_FLOOR = 4;
const TILE_CARROT = 5;
const TILE_HORIZONTAL_WALL = 6;
const TILE_VERTICAL_WALL = 7;
const TILE_TOPLEFT_WALL = 8;
const TILE_TOPRIGHT_WALL = 9;
const TILE_BOTTOMLEFT_WALL = 10;
const TILE_BOTTOMRIGHT_WALL = 11;

const SOLID_TILES = [TILE_FARM, TILE_PLANT, TILE_CARROT,
  TILE_HORIZONTAL_WALL, TILE_VERTICAL_WALL, TILE_TOPLEFT_WALL,
  TILE_TOPRIGHT_WALL, TILE_BOTTOMLEFT_WALL, TILE_BOTTOMRIGHT_WALL
];

function isInside(tile) {
  return tile === TILE_FLOOR;
}

const GameMap = util.extend(Object, 'GameMap', {
  constructor: function(scene, camera) {
    const map = scene.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tileset');
    this.layer = map.createLayer('ground', tileset, 0, 0);
    setCamera(camera, this.layer);
    map.setCollision(SOLID_TILES, undefined, undefined, this.layer);
  },
  isTileActionable(x, y) {
    return [TILE_FARM, TILE_CARROT].includes(this.getTileAt(x, y));
  },
  getTileAt(x, y) {
    const tile = this.layer.getTileAt(x, y);
    if(tile === null) {
      return -1;
    } else {
      return tile.index;
    }
  },
  putTileAt(index, x, y) {
    this.layer.putTileAt(index, x, y);
  }
});

const Keyboard = util.extend(Object, 'Keyboard', {
  constructor: function(scene, keys) {
    this.keys = {};
    this.wasPressed = {};
    for(let key of keys) {
      this.keys[key] = scene.input.keyboard.addKey(key);
      this.wasPressed[key] = false;
    }
  },
  isPressed(key) {
    return this.keys[key].isDown;
  },
  isJustPressed(key) {
    return this.isPressed(key) && !this.wasPressed[key];
  },
  update() {
    for(let key in this.keys) {
      this.wasPressed[key] = this.isPressed(key);
    }
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
    const { scene, camera, keyboard, map, x, y } = args;
    this.map = map;
    this.sprite = scene.physics.add.image(x, y, 'player');
    this.sprite.setCollideWorldBounds(true);
    setCamera(camera, this.sprite);
    camera.startFollow(this.sprite);
    this.keyboard = keyboard;
    this.oxygen = new NumStat(OXYGEN_MAX_LEVEL, OXYGEN_MAX_LEVEL);
    this.health = new NumStat(HEALTH_MAX_LEVEL, HEALTH_MAX_LEVEL);
    this.food = new NumStat(0, 1000);
    this.horizontalDirection = Direction.NONE;
    this.verticalDirection = Direction.NONE;
    this.lastDirection = Direction.NONE;
  },
  update(delta) {
    this.sprite.setVelocity(0);

    const tileLeft = Math.floor(this.sprite.x / TILE_WIDTH - 1 / 2 * 0.95);
    const tileRight = Math.floor(this.sprite.x / TILE_WIDTH + 1 / 2 * 0.95);
    const tileUp = Math.floor(this.sprite.y / TILE_HEIGHT - 1 / 2 * 0.95);
    const tileDown = Math.floor(this.sprite.y / TILE_HEIGHT + 1 / 2 * 0.95);

    const inside = isInside(this.map.getTileAt(tileLeft, tileUp)) &&
      isInside(this.map.getTileAt(tileLeft, tileDown)) &&
      isInside(this.map.getTileAt(tileRight, tileUp)) &&
      isInside(this.map.getTileAt(tileRight, tileDown));

    if(inside) {
      this.oxygen.increment(delta / 1000 * 3);
    } else {
      this.oxygen.increment(-delta / 1000);
    }

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

const BarDisplay = util.extend(Object, 'BarDisplay', {
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

const ItemDisplay = util.extend(Object, 'ItemDisplay', {
  constructor: function(args) {
    const { scene, camera, x, y, stat, icon } = args;
    this.stat = stat;

    const outline = scene.add.rectangle(x, y, 64, 40, 0x808080);
    setCamera(camera, outline);
    outline.setOrigin(0);

    const iconSprite = scene.add.image(x + 32, y + 4, icon);
    iconSprite.scale = 2;
    setCamera(camera, iconSprite);
    iconSprite.setOrigin(0);

    this.digit = scene.add.bitmapText(x, y + 4, 'font', this.stat.level + '', 32);
    setCamera(camera, this.digit);
    this.digit.setOrigin(0);
  },
  update() {
    this.digit.text = this.stat.level + '';
  }
});

const OXYGEN_MAX_LEVEL = 100;
const HEALTH_MAX_LEVEL = 100;

const Hud = util.extend(Object, 'Hud', {
  constructor: function(scene, player) {
    this.camera = scene.cameras.add(0, 0, scene.cameras.main.width, scene.cameras.main.height);

    this.oxygenBar = new BarDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 10,
      color: 0x0000FF,
      stat: player.oxygen
    });

    this.healthBar = new BarDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 40,
      color: 0xFF0000,
      stat: player.health
    });

    this.foodDisplay = new ItemDisplay({
      scene,
      camera: this.camera,
      x: 560,
      y: 20,
      icon: 'carrot',
      stat: player.food
    });
  },
  update() {
    this.oxygenBar.update();
    this.healthBar.update();
    this.foodDisplay.update();
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

const Scheduler = util.extend(Object, 'Scheduler', {
  constructor: function() {
    this.events = [];
    this.time = null;
  },
  addEvent(delay, type, data) {
    this.events.push({
      time: this.time + delay,
      type,
      data
    });
    this.events.sort((a, b) => a.time - b.time);
  },
  update(time) {
    this.time = time;
    let index = 0;
    while(index < this.events.length && this.events[index].time <= time) {
      index++;
    }
    return this.events.splice(0, index);
  }
});