// Palmera Bay — screenshot staging.
// One job: put the game into a fixed, readable scene for each ?shot= value
// so screenshots are real renders of the game's own code.
import { makeCar } from './traffic.js';

export function stageShot(game, shot) {
  const g = game;
  if (shot === 'start') {
    g.state = 'title';
    return;
  }
  if (shot === 'drive') {
    g.state = 'playing';
    const car = makeCar(1700, 1000, 0, { driver: 'player', speed: 320 });
    car.name = 'Sunrunner';
    car.color = '#d94f3d';
    g.traffic.cars.push(car);
    g.player.enterCar(car);
    car.speed = 320; // enterCar zeroes speed; the staged shot needs it moving
    g.player.x = car.x;
    g.player.y = car.y;
    g.missions.start(0, g);
    return;
  }
  if (shot === 'chase') {
    g.state = 'playing';
    const car = makeCar(1200, 1400, Math.PI / 2, { driver: 'player', speed: 380 });
    car.name = 'Comet';
    car.color = '#e8c33c';
    g.traffic.cars.push(car);
    // Clear the road ahead so the staged chase is moving, not rear-ended.
    g.traffic.cars = g.traffic.cars.filter((c) => c === car || Math.hypot(c.x - 1200, c.y - 1550) > 420);
    g.player.enterCar(car);
    car.speed = 380; // enterCar zeroes speed; the staged shot needs it moving
    g.player.x = car.x;
    g.player.y = car.y;
    g.police.wanted = 3;
    g.police.quietTimer = 0;
    // Police chase from behind (the player heads +y, so behind is smaller y).
    for (let i = 0; i < 3; i++) {
      const pc = makeCar(1200 + (i - 1) * 90, 1400 - 300 - i * 70, Math.PI / 2, { driver: 'police', speed: 460 });
      pc.color = '#2b4c9b';
      pc.siren = true;
      pc.name = 'Interceptor';
      g.police.cars.push(pc);
    }
    g.missions.index = 5;
    g.missions.start(5, g);
    return;
  }
  if (shot === 'mission') {
    g.state = 'playing';
    g.player.x = 2150;
    g.player.y = 700;
    g.player.angle = Math.PI / 2;
    g.missions.index = 5;
    g.missions.start(5, g);
    // A couple of police on foot for the robbery scene.
    g.police.wanted = 3;
    g.police.cops.push({ x: 2300, y: 800, angle: 0, speed: 0, shirt: '#2b4c9b', shootTimer: 1, walkPhase: 0 });
    g.police.cops.push({ x: 2050, y: 820, angle: 0, speed: 0, shirt: '#2b4c9b', shootTimer: 1.4, walkPhase: 0 });
  }
}
