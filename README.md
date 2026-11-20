# gta6-open-world

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/eason60547-prog/gta6-open-world/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/eason60547-prog/gta6-open-world/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

Palmera Bay is an original 2D top-down open-world crime game built for make.fun's Make GTA 6 bounty. You are Milo Reyes, running jobs for the Bay Crew in a sun-soaked seaside city: steal cars off the street, build a wanted level and outrun the police, and work through six story missions, from boosting your first car to robbing Palmera Bank. Everything is original — the city, the characters, the cars, the story, the art, and the music. No Rockstar names, maps, or assets anywhere.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. No build step and no network requests: the game is plain static files under `game/`, and your progress saves automatically to localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, drive and steer in a car |
| Shift | Run on foot |
| E | Steal the nearest car (on foot) / get out of a car |
| Q | Start the next mission |
| F | Punch |
| Mouse click / Space | Shoot the pistol (aim with the mouse) |
| Space (while driving) | Handbrake — slide the tail out above 200 speed |
| P / Esc | Pause |
| M | Mute the sound |

## The city

Palmera Bay is 3600×2600 of coastline to roam: a 7×6 road grid, houses and shops, a central park, a market street, a beach, and a working harbor. Traffic (26 cars) follows the roads, turns at junctions, and gives way; pedestrians (34) stroll the sidewalks and scatter when trouble starts. Any parked car can be yours — walk up and press E.

## Wanted

Crime draws heat. The wanted level runs 0–5 stars: police cars ram you off the road and foot patrols chase you down and shoot. Lay low and stay out of sight and the stars cool off after a while — or keep the pedal down and lose them the hard way.

## Missions

Press Q to start the next job for Milo Reyes. Each one pays cash on completion:

| # | Mission | Job | Reward |
| --- | --- | --- | --- |
| 1 | First Wheels | Steal any car and bring it to Eddie's Garage | $200 |
| 2 | Package Run | Pick up a package at Pier 9, deliver it to the docks in 90 seconds | $350 |
| 3 | Hot Pursuit | Lose a 2-star wanted level — stay unseen for 60 seconds | $400 |
| 4 | The Collector | Collect three cash drops stashed around the bay | $500 |
| 5 | Shake Down | Collect from the three shops on Coral Row (hold 3 seconds at each) | $600 |
| 6 | The Big Score | Hold the Palmera Bank vault for 10 seconds, then escape to the hideout at 3 stars | $1500 |

Finish all six and the city is yours to free-roam.

## The details

- HUD with cash, health, wanted stars, speed, and ammo, plus a minimap that marks the mission target and every police car.
- Synthesized WebAudio sound — engine, sirens, gunfire, and mission music — with no audio files at all.
- Start screen, pause menu, and automatic + manual saves, so you can pick up exactly where you left off.

---

<sub>Entered on [make.fun](https://make.fun/?ref=mz84a1xs&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
