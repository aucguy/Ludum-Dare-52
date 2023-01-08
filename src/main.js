import * as util from '/lib/util.js';

export function init() {
  const game = new Phaser.Game({
    width: 640,
    height: 480,
    parent: 'gameContainer',
    scene: new CustomBootScene('mainMenu'),
    physics: {
      default: 'arcade',
      arcade: {
        //debug: true
      }
    },
    pixelArt: true
  });

  game.scene.add('play', new PlayScene());
  game.scene.add('mainMenu', new MainMenu());
  game.scene.add('lose', new LoseScene());

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
const PLANT_GROWTH_TIME_MIN = 10 * 1000;
const PLANT_GROWTH_TIME_MAX = 20 * 1000;
const MOLD_SPRAY_TIME = 0;
const MOLD_GROW_TIME = 3000;
const MOLD_START_CHANCE = 0.1;
const ANGER_WARNING_DELAY = 5 * 1000;
const ANGER_REAL_DELAY = 10 * 1000;
const ANGER_PASS_DELAY = 5 * 1000;
const ANGER_CHANCE = 0.1;
const EXPLOSION_DAMAGE = 20;

function setCamera(camera, sprite) {
  sprite.cameraFilter = 0xFFFFFFFF ^ camera.id;
}

function inCircle(centerX, centerY) {
  const result = [];
  const radius = HARVEST_RADIUS * TILE_WIDTH;
  //let sprayed = 0;

  for(let offsetX = -radius; offsetX <= radius; offsetX += TILE_WIDTH) {
    for(let offsetY = -radius; offsetY <= radius; offsetY += TILE_HEIGHT) {

      const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
      if(distance < radius) {
        const x = centerX - offsetX;
        const y = centerY - offsetY;
        const tileX = Math.floor(x / TILE_WIDTH);
        const tileY = Math.floor(y / TILE_HEIGHT);
        result.push([tileX, tileY]);
      }
    }
  }
  return result;
}

const PlayScene = util.extend(Phaser.Scene, 'PlayScene', {
  constructor: function() {
    this.constructor$Scene();
    this.keyboard = null;
    this.player = null;
    this.hud = null;
  },
  create() {
    this.scheduler = new Scheduler();
    this.cameras.main.centerOn(20 / 2 * TILE_WIDTH, 15 / 2 * TILE_HEIGHT);
    this.physics.world.setBounds(0, 0, 20 * TILE_WIDTH, 15 * TILE_HEIGHT);
    //this.cameras.main.setBounds(-20 / 4 * TILE_WIDTH, -15 / 4 * TILE_HEIGHT, 20 / 4 * TILE_WIDTH, 15 / 4 * TILE_HEIGHT);
    //this.physics.world.setBounds(-20 / 4 * TILE_WIDTH, -15 / 4 * TILE_HEIGHT, 20 / 4 * TILE_WIDTH, 15 / 4 * TILE_HEIGHT);

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
    //this.tileSelection = new TileSelection(this, this.cameras.main, this.player, this.map);
    this.hud = new Hud(this, this.player);

    this.physics.add.collider(this.player.sprite, this.map.layer);
    this.cameras.main.setZoom(2);
    this.moldGrowth = new MoldGrowth(this.map);
  },
  update(time, delta) {
    this.hud.update();
    this.player.update(delta);
    //this.tileSelection.update(time);

    for(let event of this.scheduler.update(time)) {
      const tileX = event.data.tileX;
      const tileY = event.data.tileY;
      if(event.type === 'grow') {
        if(MOLD_START_CHANCE > Math.random()) {
          this.map.putTileAt(TILE_MOLD, tileX, tileY);
          this.moldGrowth.addFutureGrowth(tileX, tileY);
        } else if(this.map.getTileAt(tileX, tileY) === TILE_PLANT) {
          this.map.putTileAt(TILE_CARROT, tileX, tileY);
          if(ANGER_CHANCE > Math.random()) {
            this.scheduler.addEvent(ANGER_WARNING_DELAY, 'anger-warning', {
              tileX,
              tileY
            });
          }
        }
      } else if(event.type === 'anger-warning') {
        this.map.putTileAt(TILE_ANGER_WARNING, tileX, tileY);
        this.scheduler.addEvent(ANGER_REAL_DELAY, 'anger-real', {
          tileX,
          tileY
        });
      } else if(event.type === 'anger-real') {
        this.map.putTileAt(TILE_ANGER_REAL, tileX, tileY);
        this.scheduler.addEvent(ANGER_PASS_DELAY, 'anger-pass', {
          tileX,
          tileY
        });
      } else if(event.type === 'anger-pass') {
        this.map.putTileAt(TILE_CARROT, tileX, tileY);
      }

      /*else if(event.type === 'spray') {
        this.map.putTileAt(TILE_FLOOR, event.data.tileX, event.data.tileY);

        for(let offset of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
          this.scheduler.addEvent(MOLD_GROW_TIME, 'spread', {
            tileX: event.data.tileX + offset[0],
            tileY: event.data.tileY + offset[1]
          });
        
      } else if(event.type === 'spread') {
        this.growMold(event.data.tileX, event.data.tileY);
      }*/
    }

    this.moldGrowth.update(time);

    //let moldSprayed = 0;

    //if(this.keyboard.isPressed(ACTION_KEY)) {
    this.harvest();
    this.checkExplosions();
    /*if(moldSprayed !== 0) {
      this.player.oxygen.increment(-moldSprayed / 60 * delta / 1000);
      this.tileSelection.hide();
    }*/
    //}

    /*if(moldSprayed === 0 && this.keyboard.isJustPressed(ACTION_KEY) && this.tileSelection.isSelected()) {
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
      } else if(tile === TILE_BROKEN_VENT) {
        for(let room of this.map.rooms) {
          if(room.containsPoint(tileX * TILE_WIDTH, tileY * TILE_HEIGHT)) {
            room.workingVents++;
          }
        }
        this.map.putTileAt(TILE_WORKING_VENT, tileX, tileY);
      }
    }*/

    this.keyboard.update();

    if(this.player.health.isDepleted()) {
      this.game.scene.stop(this);
      this.game.scene.start('lose');
    }
  },
  harvest() {
    const radius = HARVEST_RADIUS * TILE_WIDTH;
    //let sprayed = 0;

    /*for(let offsetX = -radius; offsetX <= radius; offsetX += TILE_WIDTH) {
      for(let offsetY = -radius; offsetY <= radius; offsetY += TILE_HEIGHT) {

        const distance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
        if(distance < radius) {
          const x = this.player.sprite.x - offsetX;
          const y = this.player.sprite.y - offsetY;
          const tileX = Math.floor(x / TILE_WIDTH);
          const tileY = Math.floor(y / TILE_HEIGHT);*/
    for(let [tileX, tileY] of inCircle(this.player.sprite.x, this.player.sprite.y)) {
      const tile = this.map.getTileAt(tileX, tileY);
      if(tile === TILE_CARROT || tile === TILE_FARM || tile === TILE_MOLD) {
        this.map.putTileAt(TILE_PLANT, tileX, tileY);
        const delay = PLANT_GROWTH_TIME_MIN + Math.random() * (PLANT_GROWTH_TIME_MAX - PLANT_GROWTH_TIME_MIN);
        this.scheduler.addEvent(delay, 'grow', {
          tileX,
          tileY
        });
        //sprayed += 1;

        /*this.removeFutureGrowth(tileX, tileY);
        for(let neighbor of NEIGHBORS) {
          if(this.map.getTileAt(tileX + neighbor[0], tileY + neighbor[1]) === TILE_) {
            this.addFutureGrowth(tileX + neighbor[0], tileY + neighbor[1]);
          }
        }*/
      }
      if(tile === TILE_CARROT) {
        this.player.food.increment(1);
      }
    }
    //return sprayed;
  },
  checkExplosions() {
    let destroy = [];
    for(let [tileX, tileY] of inCircle(this.player.sprite.x, this.player.sprite.y)) {
      const tile = this.map.getTileAt(tileX, tileY);
      if(tile === TILE_ANGER_REAL) {
        destroy = destroy.concat(inCircle((tileX + 1 / 2) * TILE_WIDTH, (tileY + 1 / 2) * TILE_WIDTH));
        this.player.health.increment(-EXPLOSION_DAMAGE);
      }
    }

    for(let [tileX, tileY] of destroy) {
      const tile = this.map.getTileAt(tileX, tileY);
      if(tile !== TILE_ROCK) {
        this.map.putTileAt(TILE_FARM, tileX, tileY);
      }
    }
  }
});

const NEIGHBORS = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1]
];

const HARVEST_RADIUS = 2;

const MoldGrowth = util.extend(Object, 'MoldGrowth', {
  constructor: function(map) {
    this.map = map;
    this.futureGrowth = new Map();
    this.time = null;
  },
  addFutureGrowth(tileX, tileY) {
    this.futureGrowth.set(`${tileX},${tileY}`, this.time + MOLD_GROW_TIME);
  },
  removeFutureGrowth(tileX, tileY) {
    this.futureGrowth.delete(`${tileX},${tileY}`);
  },
  update(time) {
    this.time = time;
    const toRemove = [];
    for(let [key, time] of this.futureGrowth.entries()) {
      if(time <= this.time) {
        toRemove.push(key);
        const parts = key.split(',');
        const tileX = Number.parseInt(parts[0]);
        const tileY = Number.parseInt(parts[1]);
        if(this.map.getTileAt(tileX, tileY) === TILE_MOLD) {
          for(let neighbor of NEIGHBORS) {
            const tile = this.map.getTileAt(tileX + neighbor[0], tileY + neighbor[1]);
            if(tile === TILE_PLANT || tile === TILE_CARROT) {
              this.map.putTileAt(TILE_MOLD, tileX + neighbor[0], tileY + neighbor[1]);
              this.addFutureGrowth(tileX + neighbor[0], tileY + neighbor[1]);
            }
          }
        }
      }
    }
    for(let i of toRemove) {
      this.futureGrowth.delete(i);
    }
  }
});

const TILE_VOID = -1;
const TILE_EMPTY = 0;
const TILE_GROUND = 1;
const TILE_FARM = 2;
const TILE_PLANT = 3;
const TILE_FLOOR = 4;
const TILE_CARROT = 5;
const TILE_ROCK = 6;
const TILE_ANGER_REAL = 7;
const TILE_ANGER_WARNING = 8;
const TILE_TOPRIGHT_WALL = 9;
const TILE_BOTTOMLEFT_WALL = 10;
const TILE_BOTTOMRIGHT_WALL = 11;
const TILE_WORKING_VENT = 12;
const TILE_BROKEN_VENT = 13;
const TILE_MOLD = 14;

const SOLID_TILES = [
  TILE_ROCK,
  TILE_TOPRIGHT_WALL, TILE_BOTTOMLEFT_WALL, TILE_BOTTOMRIGHT_WALL,
  TILE_WORKING_VENT, TILE_BROKEN_VENT
];

const Room = util.extend(Object, 'Room', {
  constructor: function() {
    this.workingVents = 0;
    this.totalVents = 0;
    this.rectangles = [];
  },
  contains(rect) {
    for(let rectangle of this.rectangles) {
      if(Phaser.Geom.Rectangle.ContainsRect(rectangle, rect)) {
        return true;
      }
    }
    return false;
  },
  containsPoint(x, y) {
    for(let rectangle of this.rectangles) {
      if(rectangle.contains(x, y)) {
        return true;
      }
    }
    return false;
  }
});

const GameMap = util.extend(Object, 'GameMap', {
  constructor: function(scene, camera) {
    const map = scene.make.tilemap({ key: 'map' });
    const tileset = map.addTilesetImage('tileset');
    this.layer = map.createLayer('ground', tileset, 0, 0);
    setCamera(camera, this.layer);
    map.setCollision(SOLID_TILES, undefined, undefined, this.layer);
    /*const roomLayer = map.getObjectLayer('rooms');
    const rooms = new Map();
    for(const roomObj of roomLayer.objects) {
      if(!roomObj.rectangle) {
        continue;
      }
      const id = roomObj.properties.find(prop => prop.name === 'id').value + '';
      if(!rooms.has(id)) {
        rooms.set(id, new Room());
      }
      const rectangle = new Phaser.Geom.Rectangle(roomObj.x, roomObj.y, roomObj.width, roomObj.height);
      rooms.get(id).rectangles.push(rectangle);

      const minX = Math.floor(rectangle.x / TILE_WIDTH);
      const minY = Math.floor(rectangle.y / TILE_HEIGHT);
      const maxX = minX + Math.ceil(rectangle.width / TILE_WIDTH);
      const maxY = minY + Math.ceil(rectangle.height / TILE_HEIGHT);
      for(let x = minX; x <= maxX; x++) {
        for(let y = minY; y <= maxY; y++) {
          if(this.getTileAt(x, y) == TILE_WORKING_VENT) {
            rooms.get(id).workingVents++;
            rooms.get(id).totalVents++;
          } else if(this.getTileAt(x, y) == TILE_BROKEN_VENT) {
            rooms.get(id).totalVents++;
          }
        }
      }
    }
    this.rooms = Array.from(rooms.values());*/
  },
  isTileActionable(x, y) {
    return [TILE_FARM, TILE_CARROT, TILE_BROKEN_VENT].includes(this.getTileAt(x, y));
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
  isDepleted() {
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
    //camera.startFollow(this.sprite);
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

    const inMold = this.map.getTileAt(tileLeft, tileUp) === TILE_MOLD &&
      this.map.getTileAt(tileLeft, tileDown) === TILE_MOLD &&
      this.map.getTileAt(tileRight, tileUp) === TILE_MOLD &&
      this.map.getTileAt(tileRight, tileDown) === TILE_MOLD;

    if(inMold) {
      this.health.increment(-5 * delta / 1000);
    }

    /*let room = null;

    for(let i of this.map.rooms) {
      if(i.contains(this.sprite.getBounds())) {
        room = i;
        break;
      }
    }

    let factor = null;

    if(room === null) {
      factor = -1;
    } else if(room.workingVents === room.totalVents) {
      factor = 3;
    } else {
      factor = room.workingVents / room.totalVents - 1;
    }

    this.oxygen.increment(delta / 1000 * factor);*/

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

    /*this.oxygenBar = new BarDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 10,
      color: 0x0000FF,
      stat: player.oxygen
    });*/

    this.healthBar = new BarDisplay({
      scene,
      camera: this.camera,
      x: 10,
      y: 10,
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
    //this.oxygenBar.update();
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
  },
  hide() {
    this.sprite.alpha = 0;
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

const MainMenu = util.extend(Phaser.Scene, 'MainMenu', {
  constructor: function() {
    this.constructor$Scene();
    this.playButton = null;
  },
  create() {
    this.playButton = new Button(this, 'Play!', 320, 240, 'play');
  }
});

const LoseScene = util.extend(Phaser.Scene, 'LoseScene', {
  constructor: function() {
    this.constructor$Scene();
  },
  create() {
    new Button(this, 'You Lost!', 320, 240, null);
    new Button(this, 'Score: ' + 0, 320, 300, null);
    new Button(this, 'Play Again!', 320, 360, 'play');
  }
});

const Button = util.extend(Object, 'Button', {
  constructor: function(scene, text, x, y, sceneName) {
    this.scene = scene;
    this.sceneName = sceneName;
    const outline = scene.add.rectangle(x, y, 300, 48, 0xFFFFFF);
    const textSprite = scene.add.bitmapText(x, y, 'font', text, 32);
    textSprite.setOrigin(0.5);
    outline.setInteractive();
    if(this.sceneName !== null) {
      outline.addListener('pointerdown', this.nextScene, this);
    }
  },
  nextScene() {
    if(this.sceneName !== null) {
      this.scene.game.scene.stop(this.scene);
      this.scene.game.scene.run(this.sceneName);
    }
  }
});