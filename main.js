const canvas = document.getElementById("c");
const titleScreen = document.getElementById("title-screen");
const startBtn = document.getElementById("start-btn");
const difficultyInput = document.getElementById("difficulty");
const difficultyValue = document.getElementById("difficulty-value");
const leftHandedToggle = document.getElementById("left-handed");
const rotateOverlay = document.getElementById("rotate");
const pauseBtn = document.getElementById("pause");
const fireBtn = document.getElementById("fire");
const joystick = document.getElementById("joystick");
const stick = document.getElementById("stick");
const hpBar = document.getElementById("hp-bar");
const waveEl = document.getElementById("wave");
const scoreEl = document.getElementById("score");
const comboEl = document.getElementById("combo");
const powerupLabel = document.getElementById("powerup-label");
const powerupBar = document.getElementById("powerup-bar");
const lastScoreEl = document.getElementById("last-score");
const modelStatusEl = document.getElementById("model-status");

const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.physicallyCorrectLights = true;
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x0b1220, 25, 140);

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 220);

const State = {
  TITLE: "title",
  PLAYING: "playing",
  PAUSED: "paused",
  GAMEOVER: "gameover",
};

let gameState = State.TITLE;

const DIFF = {
  enemyHp: [0.55, 0.65, 0.8, 1.0, 1.2],
  bulletSpeed: [0.75, 0.82, 0.9, 1.0, 1.1],
  fireRate: [0.7, 0.78, 0.85, 1.0, 1.15],
  spawn: [0.7, 0.8, 0.9, 1.0, 1.15],
  playerSpeed: [1.15, 1.1, 1.05, 1.0, 1.0],
};

let difficulty = parseInt(difficultyInput.value, 10);
let diffIdx = difficulty - 1;
let diffMult = {
  enemyHp: DIFF.enemyHp[diffIdx],
  bulletSpeed: DIFF.bulletSpeed[diffIdx],
  fireRate: DIFF.fireRate[diffIdx],
  spawn: DIFF.spawn[diffIdx],
  playerSpeed: DIFF.playerSpeed[diffIdx],
};
const particleBudget = 260;

function updateEnemies(dt, t) {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.userData.active) continue;

    e.userData.phase += dt * 1.2;
    e.position.z -= (scrollSpeed + e.userData.speed) * dt;

    if (e.userData.isBoss) {
      e.position.x = Math.sin(e.userData.phase) * railBounds.x * 0.6;
      e.position.y = groundHeightAt(e.position.x, e.position.z) + 10 + Math.sin(e.userData.phase * 1.4) * 2.0;
      e.position.z = 70 + Math.cos(e.userData.phase) * 4;
    } else if (e.userData.move === "ZIGZAG") {
      e.position.x = e.userData.baseX + Math.sin(e.userData.phase) * 4.2;
      e.position.y = groundHeightAt(e.position.x, e.position.z) + e.userData.altitude;
    } else {
      const wobble = Math.sin(e.userData.phase * 1.6) * 1.8;
      e.position.x = e.userData.baseX + Math.sin(e.userData.phase * 0.7) * 2.5;
      e.position.y = groundHeightAt(e.position.x, e.position.z) + e.userData.altitude + wobble;
    }

    e.lookAt(player.position.x, e.position.y, player.position.z);

    if (e.position.z < -30) {
      if (!e.userData.isBoss) damagePlayer(12);
      e.userData.active = false;
      if (e.userData.pool) {
        e.userData.pool.release(e);
      } else if (e.parent) {
        e.parent.remove(e);
      }
      enemies.splice(i, 1);
      continue;
    }

    if (t > e.userData.nextShot) {
      e.userData.nextShot = t + 1000 / e.userData.fireRate;
      fireEnemyPattern(e);
    }
  }
}

function fireEnemyPattern(enemy) {
  const toPlayer = tempVecA.copy(player.position).sub(enemy.position).normalize();
  const spd = enemy.userData.bulletSpeed;
  const dmg = enemy.userData.bulletDamage;

  if (enemy.userData.fire === "SPREAD") {
    [-0.25, 0, 0.25].forEach((a) => {
      const dir = toPlayer.clone().applyAxisAngle(tempVecB.set(0, 1, 0), a);
      spawnEnemyBullet(enemy, dir, spd, dmg, 2.6);
    });
  } else if (enemy.userData.fire === "BURST") {
    for (let i = 0; i < 3; i++) {
      const dir = toPlayer.clone().applyAxisAngle(tempVecB.set(0, 1, 0), (Math.random() - 0.5) * 0.18);
      spawnEnemyBullet(enemy, dir, spd + 4, dmg, 2.2);
    }
  } else if (enemy.userData.fire === "BOSS") {
    const angles = [-0.4, -0.2, 0, 0.2, 0.4];
    angles.forEach((a) => {
      const dir = toPlayer.clone().applyAxisAngle(tempVecB.set(0, 1, 0), a);
      spawnEnemyBullet(enemy, dir, spd + 4, dmg + 2, 2.8);
    });
  } else {
    spawnEnemyBullet(enemy, toPlayer, spd, dmg, 2.6);
  }
}

function updateObstacles(dt) {
  for (let i = obstacles.length - 1; i >= 0; i--) {
    const o = obstacles[i];
    o.position.z -= scrollSpeed * dt;
    o.rotation.y += o.userData.spin * dt;
    o.position.y = groundHeightAt(o.position.x, o.position.z) + playerState.baseAltitude * 0.4;
    if (o.position.z < -30) {
      obstaclePool.release(o);
      obstacles.splice(i, 1);
      continue;
    }
    if (o.position.distanceTo(player.position) < o.userData.radius + 0.7) {
      damagePlayer(o.userData.damage);
      spawnExplosion(o.position, 0xffb347, 0.8);
      obstaclePool.release(o);
      obstacles.splice(i, 1);
    }
  }
}

function updatePowerUps(dt) {
  for (let i = powerUps.length - 1; i >= 0; i--) {
    const p = powerUps[i];
    p.position.z -= scrollSpeed * dt;
    p.rotation.y += p.userData.spin * dt;
    if (p.position.z < -30) {
      powerupPool.release(p);
      powerUps.splice(i, 1);
      continue;
    }
    if (p.position.distanceTo(player.position) < 1.2) {
      applyPowerUp(p.userData.type, p.userData.duration, p.userData.heal);
      spawnExplosion(p.position, 0x9fffd8, 0.7);
      powerupPool.release(p);
      powerUps.splice(i, 1);
    }
  }
}

function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.userData.life -= dt;
    p.position.addScaledVector(p.userData.vel, dt);
    p.material.opacity = Math.max(0, p.userData.life / 0.8);
    if (p.userData.life <= 0) {
      particlePool.release(p);
      particles.splice(i, 1);
    }
  }
}

function checkHits() {
  for (let i = enemies.length - 1; i >= 0; i--) {
    const e = enemies[i];
    if (!e.userData.active) continue;
    if (e.position.z < player.position.z) continue;
    for (let j = playerBullets.length - 1; j >= 0; j--) {
      const b = playerBullets[j];
      if (e.position.distanceTo(b.position) < e.userData.hitRadius + 0.7) {
        e.userData.hp -= b.userData.damage;
        bulletPool.release(b);
        playerBullets.splice(j, 1);
        if (e.userData.hp <= 0) {
          spawnExplosion(e.position, 0xffc14a, e.userData.isBoss ? 2.0 : 1.0);
          addScore(e.userData.scoreValue);
          if (e.userData.isBoss) {
            bossActive = false;
            wave += 1;
            killsThisWave = 0;
          } else {
            killsThisWave += 1;
          }
          e.userData.active = false;
          if (e.userData.pool) {
            e.userData.pool.release(e);
          } else if (e.parent) {
            e.parent.remove(e);
          }
          enemies.splice(i, 1);
        }
        break;
      }
    }
  }
}

function damagePlayer(amount) {
  if (playerState.inv > 0 || gameState !== State.PLAYING) return;
  playerState.hp = Math.max(0, playerState.hp - amount);
  playerState.inv = 0.6;
  audio.beep(120, 0.12, 0.06);
  vibrate(25);
  if (playerState.hp <= 0) {
    gameOver();
  }
}

function updateHUD() {
  hpBar.style.width = `${Math.max(0, playerState.hp)}%`;
  waveEl.textContent = wave;
  scoreEl.textContent = score;
  comboEl.textContent = combo;

  powerupLabel.textContent = playerState.weapon.toUpperCase();
  if (playerState.weaponTimerMax > 0) {
    const fill = Math.max(0, (playerState.weaponTimer / playerState.weaponTimerMax) * 100);
    powerupBar.style.setProperty("--powerup-fill", `${fill.toFixed(0)}%`);
  } else {
    powerupBar.style.setProperty("--powerup-fill", "0%");
  }
}

function updateCamera(dt) {
  const desired = tempVecA.copy(player.position).add(camOffset);
  camera.position.lerp(desired, 1 - Math.pow(0.001, dt));
  camera.lookAt(player.position.x, player.position.y + 0.8, player.position.z);
}

// --- Game Loop -----------------------------------------------------------
let lastTime = performance.now();

function updateGame(dt, t) {
  updateBackground(dt);
  updatePlayer(dt);

  if (playerState.weaponTimer > 0) {
    playerState.weaponTimer -= dt;
    if (playerState.weaponTimer <= 0) {
      playerState.weapon = "standard";
      playerState.weaponTimerMax = 0;
    }
  }

  const shoot = firing || keys[" "] || keys["enter"];
  fireTimer -= dt;
  if (shoot && fireTimer <= 0) {
    fireWeapon();
    fireTimer = fireCooldown;
  }

  updateEnemies(dt, t);
  updateBullets(dt);
  updateObstacles(dt);
  updatePowerUps(dt);
  updateParticles(dt);
  checkHits();

  if (!bossActive && wave % 3 === 0 && enemies.length === 0) {
    spawnBoss();
  }

  if (!bossActive && killsThisWave >= waveKillTarget()) {
    wave += 1;
    killsThisWave = 0;
  }

  spawnTimer -= dt;
  const spawnInterval = (1.4 / diffMult.spawn) * (bossActive ? 1.3 : 1);
  if (!bossActive && spawnTimer <= 0 && enemies.length < 6 + wave * 2) {
    spawnTimer = spawnInterval;
    spawnWaveEnemy();
  }

  obstacleTimer -= dt;
  if (obstacleTimer <= 0) {
    obstacleTimer = 2.6 + Math.random() * 1.2;
    if (Math.random() < 0.7) spawnObstacle();
  }

  powerupTimer -= dt;
  if (powerupTimer <= 0) {
    powerupTimer = 6 + Math.random() * 2;
    if (Math.random() < 0.8) spawnPowerUp();
  }

  comboTimer -= dt;
  if (comboTimer <= 0) combo = 0;

  updateHUD();
}

function animate(t) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (t - lastTime) / 1000);
  lastTime = t;

  if (gameState === State.PLAYING) {
    updateGame(dt, t);
  }

  updateCamera(dt);
  renderer.render(scene, camera);
}

// --- State Control --------------------------------------------------------
function resetGame() {
  for (const e of enemies) {
    if (e.userData.pool) {
      e.userData.pool.release(e);
    } else if (e.parent) {
      e.parent.remove(e);
    }
  }
  for (const b of playerBullets) bulletPool.release(b);
  for (const b of enemyBullets) enemyBulletPool.release(b);
  for (const o of obstacles) obstaclePool.release(o);
  for (const p of powerUps) powerupPool.release(p);
  for (const p of particles) particlePool.release(p);
  enemies.length = 0;
  playerBullets.length = 0;
  enemyBullets.length = 0;
  obstacles.length = 0;
  powerUps.length = 0;
  particles.length = 0;

  terrainOffsetZ = 0;
  for (let i = 0; i < groundChunks.length; i++) {
    const chunk = groundChunks[i];
    const offset = i * WORLD.chunkLength;
    chunk.position.z = offset;
    chunk.userData.offsetZ = offset;
    updateChunkGeometry(chunk);
  }

  playerState.hp = 100;
  playerState.inv = 0;
  playerState.weapon = "standard";
  playerState.weaponTimer = 0;
  playerState.weaponTimerMax = 0;
  playerState.offsetY = 0;
  player.position.set(0, groundHeightAt(0, 0) + playerState.baseAltitude, 0);

  score = 0;
  combo = 0;
  comboTimer = 0;
  wave = 1;
  killsThisWave = 0;
  bossActive = false;
  spawnTimer = 0;
  obstacleTimer = 1.8;
  powerupTimer = 4.0;

  fireCooldown = 1 / (fireRateBase * diffMult.fireRate);
  fireTimer = 0;
  firing = false;
  joyTarget.set(0, 0);
  joyDir.set(0, 0);
  setStick(0, 0);

  pauseBtn.textContent = "II";
  updateHUD();
}

function startGame() {
  audio.unlock();
  applyDifficulty(parseInt(difficultyInput.value, 10));
  titleScreen.classList.add("hidden");
  gameState = State.PLAYING;
  music.start();
  resetGame();
}

function gameOver() {
  gameState = State.TITLE;
  if (lastScoreEl) lastScoreEl.textContent = `LAST SCORE ${score}`;
  titleScreen.classList.remove("hidden");
  music.stop();
  audio.beep(90, 0.2, 0.08);
  vibrate(60);
}

startBtn.addEventListener("click", startGame);

// --- Orientation / Resize -------------------------------------------------
function updateOrientation() {
  const portrait = window.innerHeight >= window.innerWidth;
  rotateOverlay.classList.toggle("hidden", portrait);
}

function onResize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(window.devicePixelRatio);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  updateJoyRadius();
  updateOrientation();
}

window.addEventListener("resize", onResize);

function applyDifficulty(value) {
  difficulty = value;
  diffIdx = Math.max(0, Math.min(4, difficulty - 1));
  diffMult = {
    enemyHp: DIFF.enemyHp[diffIdx],
    bulletSpeed: DIFF.bulletSpeed[diffIdx],
    fireRate: DIFF.fireRate[diffIdx],
    spawn: DIFF.spawn[diffIdx],
    playerSpeed: DIFF.playerSpeed[diffIdx],
  };
}

difficultyValue.textContent = difficultyInput.value;
difficultyInput.addEventListener("input", () => {
  difficultyValue.textContent = difficultyInput.value;
});
leftHandedToggle.addEventListener("change", () => {
  document.body.classList.toggle("left-handed", leftHandedToggle.checked);
});

// --- Audio ---------------------------------------------------------------
const audio = {
  ctx: null,
  unlocked: false,
  unlock() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      this.ctx = new Ctx();
    }
    if (this.ctx.state !== "running") {
      this.ctx.resume();
    }
    this.unlocked = true;
  },
  beep(freq, duration, gain) {
    if (!this.ctx || !this.unlocked) return;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.frequency.value = freq;
    osc.type = "sine";
    g.gain.value = gain;
    osc.connect(g);
    g.connect(this.ctx.destination);
    osc.start();
    osc.stop(this.ctx.currentTime + duration);
  },
};

const music = {
  playing: false,
  gain: null,
  tempo: 118,
  step: 0,
  nextTime: 0,
  schedulerId: null,
  start() {
    if (!audio.ctx || !audio.unlocked || this.playing) return;
    this.playing = true;
    this.step = 0;
    this.nextTime = audio.ctx.currentTime + 0.05;
    this.gain = audio.ctx.createGain();
    this.gain.gain.setValueAtTime(0.0001, audio.ctx.currentTime);
    this.gain.connect(audio.ctx.destination);
    this.gain.gain.exponentialRampToValueAtTime(0.42, audio.ctx.currentTime + 0.8);
    this.schedule();
  },
  stop() {
    if (!this.playing) return;
    this.playing = false;
    if (this.schedulerId) {
      clearTimeout(this.schedulerId);
      this.schedulerId = null;
    }
    if (this.gain && audio.ctx) {
      const t = audio.ctx.currentTime;
      this.gain.gain.cancelScheduledValues(t);
      this.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      const oldGain = this.gain;
      this.gain = null;
      setTimeout(() => oldGain.disconnect(), 700);
    }
  },
  schedule() {
    if (!this.playing || !audio.ctx) return;
    const ctx = audio.ctx;
    const stepDur = (60 / this.tempo) / 2;
    const lookAhead = 0.25;
    while (this.nextTime < ctx.currentTime + lookAhead) {
      this.playStep(this.nextTime, this.step);
      this.nextTime += stepDur;
      this.step += 1;
    }
    this.schedulerId = setTimeout(() => this.schedule(), 50);
  },
  playStep(time, step) {
    const chordRoots = [0, 5, 7, 3];
    const chord = chordRoots[Math.floor(step / 4) % chordRoots.length];
    const bassFreq = 110 * Math.pow(2, chord / 12);
    const stepInBar = step % 16;

    if (stepInBar % 4 === 0) {
      this.playBass(time, bassFreq);
    }
    if (stepInBar % 2 === 0) {
      const leadOffsets = [0, 7, 10, 12];
      const offset = leadOffsets[(stepInBar / 2) % leadOffsets.length];
      const leadFreq = 220 * Math.pow(2, (chord + offset) / 12);
      this.playLead(time, leadFreq);
    }
    if (stepInBar === 0 || stepInBar === 8) this.playKick(time);
    if (stepInBar % 2 === 1) this.playHat(time);
  },
  playBass(time, freq) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(freq, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.28, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.25);
    osc.connect(g);
    g.connect(this.gain);
    osc.start(time);
    osc.stop(time + 0.26);
  },
  playLead(time, freq) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(freq, time);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1400, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.12, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.2);
    osc.connect(filter);
    filter.connect(g);
    g.connect(this.gain);
    osc.start(time);
    osc.stop(time + 0.22);
  },
  playKick(time) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, time);
    osc.frequency.exponentialRampToValueAtTime(50, time + 0.12);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.5, time + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
    osc.connect(g);
    g.connect(this.gain);
    osc.start(time);
    osc.stop(time + 0.2);
  },
  playHat(time) {
    const ctx = audio.ctx;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "triangle";
    osc.frequency.setValueAtTime(4200, time);
    g.gain.setValueAtTime(0.0001, time);
    g.gain.exponentialRampToValueAtTime(0.08, time + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, time + 0.05);
    osc.connect(g);
    g.connect(this.gain);
    osc.start(time);
    osc.stop(time + 0.06);
  },
};

function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// --- Input ---------------------------------------------------------------
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key.toLowerCase()] = true));
window.addEventListener("keyup", (e) => (keys[e.key.toLowerCase()] = false));

let joyActive = false;
let joyId = null;
const joyCenter = new THREE.Vector2();
const joyDir = new THREE.Vector2();
const joyTarget = new THREE.Vector2();
const moveInput = new THREE.Vector2();
let joyRadius = 60;
const joyDeadzone = 0.12;

function setStick(x, y) {
  stick.style.transform = `translate(${x}px, ${y}px)`;
}

function updateJoyRadius() {
  joyRadius = Math.min(joystick.clientWidth, joystick.clientHeight) * 0.45;
}

updateJoyRadius();

joystick.addEventListener("pointerdown", (e) => {
  joyActive = true;
  joyId = e.pointerId;
  joystick.setPointerCapture(e.pointerId);
  const rect = joystick.getBoundingClientRect();
  joyCenter.set(rect.left + rect.width / 2, rect.top + rect.height / 2);
});

window.addEventListener("pointermove", (e) => {
  if (!joyActive || e.pointerId !== joyId) return;
  const dx = e.clientX - joyCenter.x;
  const dy = e.clientY - joyCenter.y;
  const len = Math.hypot(dx, dy);
  let nx = 0;
  let ny = 0;
  if (len > 0) {
    const clamped = Math.min(len, joyRadius);
    nx = (dx / joyRadius) * (clamped / len);
    ny = (dy / joyRadius) * (clamped / len);
  }
  joyTarget.set(nx, ny);
  setStick(nx * joyRadius, ny * joyRadius);
});

window.addEventListener("pointerup", (e) => {
  if (e.pointerId !== joyId) return;
  joyActive = false;
  joyId = null;
  joyTarget.set(0, 0);
  setStick(0, 0);
});

let firing = false;
fireBtn.addEventListener("pointerdown", (e) => {
  firing = true;
  fireBtn.setPointerCapture(e.pointerId);
});
fireBtn.addEventListener("pointerup", () => (firing = false));
fireBtn.addEventListener("pointerleave", () => (firing = false));


pauseBtn.addEventListener("click", () => {
  if (gameState === State.PLAYING) {
    gameState = State.PAUSED;
    pauseBtn.textContent = ">";
  } else if (gameState === State.PAUSED) {
    gameState = State.PLAYING;
    pauseBtn.textContent = "II";
  }
});

// --- World ---------------------------------------------------------------
const WORLD = {
  width: 40,
  chunkLength: 60,
  chunkCount: 3,
  groundSegments: 48,
};

let terrainOffsetZ = 0;

function heightAt(x, z) {
  return Math.sin(x * 0.08) * 0.8 + Math.cos(z * 0.05) * 0.6 + Math.sin((x + z) * 0.03) * 0.9;
}

function groundHeightAt(x, z) {
  return heightAt(x, z + terrainOffsetZ);
}

function createSky() {
  const skyGeo = new THREE.SphereGeometry(200, 24, 16);
  const skyMat = new THREE.MeshBasicMaterial({ color: 0x0b1220, side: THREE.BackSide });
  const sky = new THREE.Mesh(skyGeo, skyMat);
  scene.add(sky);

  const starCount = 280;
  const starPos = new Float32Array(starCount * 3);
  for (let i = 0; i < starCount; i++) {
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 120 + Math.random() * 70;
    const i3 = i * 3;
    starPos[i3] = r * Math.sin(phi) * Math.cos(theta);
    starPos[i3 + 1] = r * Math.cos(phi);
    starPos[i3 + 2] = r * Math.sin(phi) * Math.sin(theta);
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  const starMat = new THREE.PointsMaterial({ color: 0x9fc2ff, size: 0.7, transparent: true, opacity: 0.8 });
  const stars = new THREE.Points(starGeo, starMat);
  scene.add(stars);
}

function createLights() {
  const hemi = new THREE.HemisphereLight(0xddeeff, 0x1b2533, 0.65);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight(0xffffff, 1.05);
  sun.position.set(25, 45, 25);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 2048;
  sun.shadow.mapSize.height = 2048;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 140;
  sun.shadow.camera.left = -40;
  sun.shadow.camera.right = 40;
  sun.shadow.camera.top = 40;
  sun.shadow.camera.bottom = -40;
  sun.shadow.bias = -0.00025;
  scene.add(sun);

  const rim = new THREE.DirectionalLight(0x7aa7ff, 0.35);
  rim.position.set(-30, 20, -30);
  scene.add(rim);
}

const groundChunks = [];

function updateChunkGeometry(chunk) {
  const geo = chunk.geometry;
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i) + chunk.userData.offsetZ;
    const y = heightAt(x, z);
    pos.setY(i, y);
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();
}

function buildGroundChunk(offsetZ) {
  const geo = new THREE.PlaneGeometry(WORLD.width, WORLD.chunkLength, WORLD.groundSegments, WORLD.groundSegments);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f4a35, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.userData.offsetZ = offsetZ;
  updateChunkGeometry(mesh);
  mesh.position.z = offsetZ;
  scene.add(mesh);
  groundChunks.push(mesh);
}

function createGround() {
  for (let i = 0; i < WORLD.chunkCount; i++) {
    buildGroundChunk(i * WORLD.chunkLength);
  }
}

createSky();
createLights();
createGround();

// --- Pools ---------------------------------------------------------------
function makePool(createFn, count) {
  const pool = [];
  for (let i = 0; i < count; i++) {
    pool.push(createFn());
  }
  return {
    acquire() {
      return pool.pop() || createFn();
    },
    release(obj) {
      if (obj.parent) obj.parent.remove(obj);
      pool.push(obj);
    },
  };
}

// --- Player ---------------------------------------------------------------
function createJet(config = {}) {
  const cfg = Object.assign(
    {
      bodyColor: 0x2a9df4,
      accentColor: 0x1f5a9f,
      trimColor: 0xd8e7ff,
      length: 3.6,
      bodyRadius: 0.5,
      wingSpan: 2.8,
      wingDepth: 0.85,
      wingSweep: 0.2,
      tailSpan: 1.3,
      tailDepth: 0.5,
      tailHeight: 0.85,
      tailOffset: 0.6,
      noseLength: 0.9,
      tailLength: 0.7,
      engineCount: 2,
      canards: false,
      twinTail: false,
      engineGlow: 0x7ad1ff,
    },
    config
  );

  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: cfg.bodyColor, roughness: 0.35, metalness: 0.55 });
  const accentMat = new THREE.MeshStandardMaterial({ color: cfg.accentColor, roughness: 0.28, metalness: 0.65 });
  const trimMat = new THREE.MeshStandardMaterial({ color: cfg.trimColor, roughness: 0.4, metalness: 0.3 });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x8cc7ff,
    metalness: 0,
    roughness: 0.1,
    transmission: 0.85,
    thickness: 0.2,
    transparent: true,
    opacity: 0.6,
  });

  const fuselage = new THREE.Mesh(
    new THREE.CylinderGeometry(cfg.bodyRadius * 0.7, cfg.bodyRadius, cfg.length, 16),
    bodyMat
  );
  fuselage.rotation.x = Math.PI / 2;
  group.add(fuselage);

  const nose = new THREE.Mesh(new THREE.ConeGeometry(cfg.bodyRadius * 0.75, cfg.noseLength, 14), bodyMat);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = cfg.length / 2 + cfg.noseLength / 2 - 0.15;
  group.add(nose);

  const tail = new THREE.Mesh(new THREE.ConeGeometry(cfg.bodyRadius * 0.55, cfg.tailLength, 12), bodyMat);
  tail.rotation.x = -Math.PI / 2;
  tail.position.z = -cfg.length / 2 - cfg.tailLength / 2 + 0.1;
  group.add(tail);

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(cfg.bodyRadius * 0.6, 14, 10), glassMat);
  cockpit.position.set(0, cfg.bodyRadius * 0.38, cfg.length * 0.18);
  group.add(cockpit);

  const frame = new THREE.Mesh(new THREE.TorusGeometry(cfg.bodyRadius * 0.42, 0.03, 6, 12), accentMat);
  frame.rotation.x = Math.PI / 2;
  frame.position.copy(cockpit.position);
  group.add(frame);

  const wing = new THREE.Mesh(new THREE.BoxGeometry(cfg.wingSpan, 0.08, cfg.wingDepth), accentMat);
  wing.rotation.y = cfg.wingSweep;
  group.add(wing);

  if (cfg.canards) {
    const canard = new THREE.Mesh(new THREE.BoxGeometry(cfg.wingSpan * 0.45, 0.05, cfg.wingDepth * 0.3), accentMat);
    canard.position.set(0, 0.05, cfg.length * 0.28);
    group.add(canard);
  }

  const tailWing = new THREE.Mesh(new THREE.BoxGeometry(cfg.tailSpan, 0.06, cfg.tailDepth), accentMat);
  tailWing.position.set(0, 0.12, -cfg.length / 2 + cfg.tailOffset);
  group.add(tailWing);

  const finGeo = new THREE.BoxGeometry(0.08, cfg.tailHeight, 0.55);
  if (cfg.twinTail) {
    const finL = new THREE.Mesh(finGeo, accentMat);
    finL.position.set(-cfg.tailSpan * 0.22, cfg.tailHeight / 2, -cfg.length / 2 + cfg.tailOffset);
    finL.rotation.z = 0.12;
    group.add(finL);

    const finR = finL.clone();
    finR.position.x = -finL.position.x;
    finR.rotation.z = -0.12;
    group.add(finR);
  } else {
    const fin = new THREE.Mesh(finGeo, accentMat);
    fin.position.set(0, cfg.tailHeight / 2, -cfg.length / 2 + cfg.tailOffset);
    group.add(fin);
  }

  const intakeGeo = new THREE.BoxGeometry(cfg.bodyRadius * 0.6, 0.2, 0.6);
  const intakeL = new THREE.Mesh(intakeGeo, trimMat);
  intakeL.position.set(-cfg.bodyRadius * 0.85, -0.05, 0.2);
  group.add(intakeL);

  const intakeR = intakeL.clone();
  intakeR.position.x = -intakeL.position.x;
  group.add(intakeR);

  const engineMat = new THREE.MeshStandardMaterial({ color: 0x222831, roughness: 0.45, metalness: 0.85 });
  const engineGeo = new THREE.CylinderGeometry(0.16, 0.18, 0.9, 10);
  const enginePositions = [];
  if (cfg.engineCount === 1) {
    enginePositions.push(0);
  } else if (cfg.engineCount === 2) {
    enginePositions.push(-cfg.bodyRadius * 1.2, cfg.bodyRadius * 1.2);
  } else {
    enginePositions.push(-cfg.bodyRadius * 1.3, 0, cfg.bodyRadius * 1.3);
  }

  enginePositions.forEach((x) => {
    const eng = new THREE.Mesh(engineGeo, engineMat);
    eng.rotation.z = Math.PI / 2;
    eng.position.set(x, -0.12, -0.4);
    group.add(eng);
  });

  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, cfg.length * 0.9), trimMat);
  stripe.position.set(0, cfg.bodyRadius * 0.55, 0);
  group.add(stripe);

  const glowMat = new THREE.MeshBasicMaterial({ color: cfg.engineGlow, transparent: true, opacity: 0.7 });
  const glow = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 10), glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, -0.1, -cfg.length / 2 - 0.6);
  group.add(glow);

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0, cfg.length / 2 + cfg.noseLength - 0.1);
  group.add(muzzle);
  group.userData.muzzle = muzzle;
  group.userData.bodyMat = bodyMat;
  group.userData.accentMat = accentMat;
  group.userData.trimMat = trimMat;
  group.userData.glow = glow;

  group.traverse((obj) => {
    if (obj.isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = false;
    }
  });

  return group;
}

const player = createJet({
  bodyColor: 0x2a9df4,
  accentColor: 0x1f5a9f,
  trimColor: 0xd8e7ff,
  length: 4.0,
  wingSpan: 3.2,
  wingDepth: 0.9,
  wingSweep: 0.28,
  tailHeight: 1.1,
  tailSpan: 1.6,
  engineCount: 2,
  canards: true,
  twinTail: true,
  engineGlow: 0x7ad1ff,
});
player.scale.set(1.15, 1.15, 1.15);
scene.add(player);

const playerLight = new THREE.PointLight(0x7ad1ff, 0.8, 12);
playerLight.position.set(0, 0.6, -1.2);
player.add(playerLight);

const PLAYER_MODEL_PATH = "jet.obj";
let modelReady = false;

startBtn.disabled = true;
startBtn.textContent = "LOADING...";

function setModelStatus(text, state) {
  if (!modelStatusEl) return;
  modelStatusEl.textContent = text;
  if (state) modelStatusEl.dataset.state = state;
}

function onModelReady() {
  modelReady = true;
  startBtn.disabled = false;
  startBtn.textContent = "START";
}

function applyObjToPlayer(obj) {
  const material = new THREE.MeshStandardMaterial({
    color: 0xd9e6ff,
    metalness: 0.6,
    roughness: 0.3,
    emissive: 0x0c1a2b,
    emissiveIntensity: 0.15,
  });

  obj.traverse((child) => {
    if (child.isMesh) {
      child.material = material;
      child.castShadow = true;
      child.receiveShadow = false;
    }
  });

  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());

  if (size.x >= size.y && size.x >= size.z) {
    obj.rotation.y = -Math.PI / 2;
  } else if (size.y >= size.x && size.y >= size.z) {
    obj.rotation.x = -Math.PI / 2;
  }

  box.setFromObject(obj);
  size.copy(box.getSize(new THREE.Vector3()));
  const targetLength = 4.0;
  const scale = targetLength / Math.max(0.001, size.z || size.x || size.y);
  obj.scale.setScalar(scale);

  box.setFromObject(obj);
  const center = box.getCenter(new THREE.Vector3());
  obj.position.sub(center);

  const scaledSize = box.getSize(new THREE.Vector3());
  player.userData.muzzle.position.set(0, 0, scaledSize.z * 0.5 + 0.25);

  for (let i = player.children.length - 1; i >= 0; i--) {
    const child = player.children[i];
    if (child === player.userData.muzzle || child === playerLight) continue;
    player.remove(child);
  }

  player.add(obj);
}

function parseOBJToGroup(text) {
  const positions = [];
  const normals = [];
  const uvs = [];
  const outPos = [];
  const outNorm = [];
  const outUv = [];

  const lines = text.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const parts = trimmed.split(/\s+/);
    if (parts[0] === "v") {
      positions.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === "vn") {
      normals.push([parseFloat(parts[1]), parseFloat(parts[2]), parseFloat(parts[3])]);
    } else if (parts[0] === "vt") {
      uvs.push([parseFloat(parts[1]), parseFloat(parts[2])]);
    } else if (parts[0] === "f") {
      const verts = parts.slice(1);
      for (let i = 1; i < verts.length - 1; i++) {
        [verts[0], verts[i], verts[i + 1]].forEach((v) => {
          const idx = v.split("/");
          const pIndex = parseInt(idx[0], 10);
          const tIndex = idx[1] ? parseInt(idx[1], 10) : 0;
          const nIndex = idx[2] ? parseInt(idx[2], 10) : 0;

          const p = positions[pIndex < 0 ? positions.length + pIndex : pIndex - 1];
          outPos.push(p[0], p[1], p[2]);
          if (tIndex) {
            const t = uvs[tIndex < 0 ? uvs.length + tIndex : tIndex - 1];
            if (t) outUv.push(t[0], 1 - t[1]);
          }
          if (nIndex) {
            const n = normals[nIndex < 0 ? normals.length + nIndex : nIndex - 1];
            if (n) outNorm.push(n[0], n[1], n[2]);
          }
        });
      }
    }
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(outPos, 3));
  if (outUv.length) geo.setAttribute("uv", new THREE.Float32BufferAttribute(outUv, 2));
  if (outNorm.length) {
    geo.setAttribute("normal", new THREE.Float32BufferAttribute(outNorm, 3));
  } else {
    geo.computeVertexNormals();
  }

  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0xd9e6ff }));
  const group = new THREE.Group();
  group.add(mesh);
  return group;
}

function loadPlayerModelFallback() {
  if (!THREE.FileLoader) {
    setModelStatus("MODEL: LOAD FAILED", "error");
    console.warn("FileLoader not available. Player model stays procedural.");
    onModelReady();
    return;
  }
  const loader = new THREE.FileLoader();
  loader.setResponseType("text");
  loader.load(
    PLAYER_MODEL_PATH,
    (text) => {
      const obj = parseOBJToGroup(text);
      applyObjToPlayer(obj);
      setModelStatus("MODEL: OBJ LOADED", "ok");
      onModelReady();
    },
    undefined,
    (err) => {
      setModelStatus("MODEL: LOAD FAILED", "error");
      console.warn("Failed to load OBJ via FileLoader", err);
      if (window.location.protocol === "file:") {
        console.warn("Tip: run a local server (e.g. python -m http.server) instead of file://");
      }
      onModelReady();
    }
  );
}

function loadPlayerModel() {
  if (window.location.protocol === "file:") {
    setModelStatus("MODEL: FILE MODE (USE LOCAL SERVER)", "error");
  } else {
    setModelStatus("MODEL: LOADING...", "loading");
  }

  if (!THREE.OBJLoader) {
    console.warn("OBJLoader not available. Using fallback parser.");
    loadPlayerModelFallback();
    return;
  }
  const loader = new THREE.OBJLoader();
  loader.load(
    PLAYER_MODEL_PATH,
    (obj) => {
      applyObjToPlayer(obj);
      setModelStatus("MODEL: OBJ LOADED", "ok");
      onModelReady();
    },
    undefined,
    (err) => {
      console.warn("Failed to load player OBJ via OBJLoader", err);
      loadPlayerModelFallback();
    }
  );
}

loadPlayerModel();

const playerState = {
  hp: 100,
  inv: 0,
  speed: 12,
  baseAltitude: 5,
  offsetY: 0,
  weapon: "standard",
  weaponTimer: 0,
  weaponTimerMax: 0,
};

const railBounds = { x: 7.5, yMin: -3.0, yMax: 6.0 };

// --- Weapons --------------------------------------------------------------
const bulletGeo = new THREE.SphereGeometry(0.12, 8, 8);
const bulletMat = new THREE.MeshStandardMaterial({
  color: 0xfff2b0,
  roughness: 0.2,
  metalness: 0.4,
  emissive: 0x3a2a00,
  emissiveIntensity: 0.8,
});

const enemyBulletGeo = new THREE.SphereGeometry(0.16, 8, 8);
const enemyBulletMat = new THREE.MeshStandardMaterial({
  color: 0xff5c5c,
  roughness: 0.25,
  metalness: 0.3,
  emissive: 0x550000,
  emissiveIntensity: 1.0,
});

const bulletPool = makePool(() => new THREE.Mesh(bulletGeo, bulletMat.clone()), 40);
const enemyBulletPool = makePool(() => new THREE.Mesh(enemyBulletGeo, enemyBulletMat.clone()), 40);

const playerBullets = [];
const enemyBullets = [];

const fireRateBase = 10;
let fireCooldown = 1 / (fireRateBase * diffMult.fireRate);
let fireTimer = 0;

const aimAssistStrength = 0.55;
const aimConeDot = Math.cos(THREE.MathUtils.degToRad(25));

const tempVecA = new THREE.Vector3();
const tempVecB = new THREE.Vector3();
const tempVecC = new THREE.Vector3();
const tempVec2 = new THREE.Vector2();

function spawnPlayerBullet(direction, offset = tempVecA.set(0, 0, 0), speed = 60, damage = 5, size = 0.12, life = 2.0) {
  const b = bulletPool.acquire();
  b.scale.setScalar(size / 0.12);
  b.position.copy(player.userData.muzzle.getWorldPosition(tempVecB)).add(offset);
  b.userData.vel = direction.clone().multiplyScalar(speed * diffMult.bulletSpeed);
  b.userData.life = life;
  b.userData.damage = damage;
  scene.add(b);
  playerBullets.push(b);
}

function getAimDirection() {
  const dir = tempVecA.set(0, 0, 1);
  let best = null;
  let bestDist = Infinity;
  for (const e of enemies) {
    if (!e.userData.active) continue;
    const to = tempVecB.copy(e.position).sub(player.position);
    if (to.z < 0) continue;
    const dist = to.length();
    const dot = to.normalize().dot(dir);
    if (dot < aimConeDot) continue;
    if (dist < bestDist) {
      bestDist = dist;
      best = e;
    }
  }
  if (best) {
    const to = tempVecB.copy(best.position).sub(player.position).normalize();
    dir.lerp(to, aimAssistStrength).normalize();
  }
  return dir.clone();
}

function fireWeapon() {
  const forward = getAimDirection();
  const right = tempVecB.set(1, 0, 0);

  if (playerState.weapon === "dual") {
    spawnPlayerBullet(forward, right.clone().multiplyScalar(0.35));
    spawnPlayerBullet(forward, right.clone().multiplyScalar(-0.35));
  } else if (playerState.weapon === "spread") {
    const angles = [-0.2, 0, 0.2];
    angles.forEach((a) => {
      const dir = forward.clone().applyAxisAngle(tempVecC.set(0, 1, 0), a);
      spawnPlayerBullet(dir, tempVecC.set(0, 0, 0), 54, 5, 0.12, 1.8);
    });
  } else if (playerState.weapon === "laser") {
    spawnPlayerBullet(forward, tempVecC.set(0, 0, 0), 75, 9, 0.16, 1.2);
  } else if (playerState.weapon === "rocket") {
    spawnPlayerBullet(forward, tempVecC.set(0, 0, 0), 42, 12, 0.18, 2.2);
  } else {
    spawnPlayerBullet(forward);
  }
}

function spawnEnemyBullet(enemy, direction, speed, damage, life, wave) {
  const b = enemyBulletPool.acquire();
  b.position.copy(enemy.position).add(direction.clone().multiplyScalar(1.2));
  b.userData.vel = direction.clone().multiplyScalar(speed);
  b.userData.life = life;
  b.userData.damage = damage;
  b.userData.wave = wave || null;
  b.userData.phase = 0;
  b.userData.lastOffset = 0;
  if (wave) {
    const side = tempVecC.set(-direction.z, 0, direction.x).normalize();
    b.userData.side = side.clone();
  }
  scene.add(b);
  enemyBullets.push(b);
}


// --- Enemies --------------------------------------------------------------
const enemyPresets = [
  {
    id: "fighter",
    class: "FIGHTER",
    hp: 20,
    speed: 18,
    hitRadius: 1.4,
    scoreValue: 100,
    move: "ZIGZAG",
    fire: "SINGLE",
    fireRate: 1.2,
    bulletSpeed: 40,
    bulletDamage: 8,
    poolSize: 6,
    model: {
      bodyColor: 0xd24b4b,
      accentColor: 0x4a0e0e,
      trimColor: 0xe6d5d5,
      length: 3.2,
      wingSpan: 3.0,
      wingDepth: 0.7,
      wingSweep: 0.35,
      tailHeight: 0.75,
      tailSpan: 1.2,
      engineCount: 2,
      twinTail: false,
      canards: false,
      engineGlow: 0xff6b6b,
    },
  },
  {
    id: "striker",
    class: "FIGHTER",
    hp: 28,
    speed: 20,
    hitRadius: 1.45,
    scoreValue: 160,
    move: "ZIGZAG",
    fire: "BURST",
    fireRate: 1.4,
    bulletSpeed: 44,
    bulletDamage: 9,
    poolSize: 6,
    model: {
      bodyColor: 0x2f6a6a,
      accentColor: 0x0b2b2b,
      trimColor: 0x8fd0d0,
      length: 3.4,
      wingSpan: 2.8,
      wingDepth: 0.8,
      wingSweep: 0.28,
      tailHeight: 0.9,
      tailSpan: 1.3,
      engineCount: 2,
      twinTail: true,
      canards: true,
      engineGlow: 0x7ad1ff,
    },
  },
  {
    id: "bomber",
    class: "MEDIUM",
    hp: 50,
    speed: 12,
    hitRadius: 1.8,
    scoreValue: 260,
    move: "SINE",
    fire: "SPREAD",
    fireRate: 1.0,
    bulletSpeed: 36,
    bulletDamage: 9,
    poolSize: 5,
    model: {
      bodyColor: 0x6b3b2d,
      accentColor: 0x2c1510,
      trimColor: 0x9c7b5a,
      length: 4.2,
      wingSpan: 3.6,
      wingDepth: 1.2,
      wingSweep: 0.12,
      tailHeight: 1.0,
      tailSpan: 1.8,
      engineCount: 3,
      twinTail: true,
      canards: false,
      engineGlow: 0xffa26b,
    },
  },
  {
    id: "delta",
    class: "ELITE",
    hp: 75,
    speed: 22,
    hitRadius: 1.5,
    scoreValue: 620,
    move: "SINE",
    fire: "BURST",
    fireRate: 1.5,
    bulletSpeed: 46,
    bulletDamage: 10,
    poolSize: 5,
    model: {
      bodyColor: 0x3f3f6b,
      accentColor: 0x14142b,
      trimColor: 0xb0b0ff,
      length: 3.0,
      wingSpan: 3.1,
      wingDepth: 1.5,
      wingSweep: 0.05,
      tailHeight: 0.6,
      tailSpan: 0.9,
      engineCount: 1,
      twinTail: false,
      canards: true,
      engineGlow: 0x8ab7ff,
    },
  },
];

const bossPreset = {
  id: "boss",
  class: "BOSS",
  hp: 420,
  speed: 6,
  hitRadius: 3.2,
  scoreValue: 5000,
  move: "BOSS",
  fire: "BOSS",
  fireRate: 1.0,
  bulletSpeed: 42,
  bulletDamage: 12,
  poolSize: 1,
  model: {
    bodyColor: 0x7c1212,
    accentColor: 0x2e0505,
    trimColor: 0xffc87a,
    length: 5.4,
    wingSpan: 4.8,
    wingDepth: 1.3,
    wingSweep: 0.32,
    tailHeight: 1.3,
    tailSpan: 2.2,
    engineCount: 3,
    twinTail: true,
    canards: true,
    engineGlow: 0xff8a2b,
  },
};

const enemyPools = {};
const enemies = [];

function getEnemyPool(preset) {
  if (!enemyPools[preset.id]) {
    const size = preset.poolSize || 6;
    enemyPools[preset.id] = makePool(() => createJet(preset.model), size);
  }
  return enemyPools[preset.id];
}

function spawnEnemy(preset) {
  const pool = getEnemyPool(preset);
  const e = pool.acquire();
  const scale = preset.scale || (preset.class === "BOSS" ? 1.7 : 0.95);
  e.scale.set(scale, scale, scale);

  const spawnZ = 70 + Math.random() * 30;
  const spawnX = (Math.random() - 0.5) * railBounds.x * 2.2;
  const altitude = 4 + Math.random() * 4;
  e.position.set(spawnX, groundHeightAt(spawnX, spawnZ) + altitude, spawnZ);

  e.userData.active = true;
  e.userData.pool = pool;
  e.userData.hp = preset.hp * diffMult.enemyHp;
  e.userData.speed = preset.speed * 0.1;
  e.userData.hitRadius = preset.hitRadius;
  e.userData.scoreValue = preset.scoreValue;
  e.userData.move = preset.move;
  e.userData.fire = preset.fire;
  e.userData.fireRate = preset.fireRate * diffMult.fireRate;
  e.userData.bulletSpeed = preset.bulletSpeed * diffMult.bulletSpeed;
  e.userData.bulletDamage = preset.bulletDamage;
  e.userData.nextShot = 0;
  e.userData.phase = Math.random() * Math.PI * 2;
  e.userData.baseX = spawnX;
  e.userData.altitude = altitude;
  e.userData.isBoss = preset.class === "BOSS";

  scene.add(e);
  enemies.push(e);
}

// --- Obstacles & Powerups -------------------------------------------------
const obstacleGeoSpike = new THREE.OctahedronGeometry(1.2, 0);
const obstacleGeoTower = new THREE.CylinderGeometry(0.5, 1.2, 5, 6);
const obstacleMatSpike = new THREE.MeshStandardMaterial({
  color: 0xff2222,
  roughness: 0.3,
  metalness: 0.4,
  emissive: 0x660000,
  emissiveIntensity: 0.6,
});
const obstacleMatTower = new THREE.MeshStandardMaterial({
  color: 0x992222,
  roughness: 0.5,
  metalness: 0.3,
  emissive: 0x440000,
  emissiveIntensity: 0.4,
});

const obstaclePool = makePool(() => {
  const mesh = new THREE.Mesh(obstacleGeoSpike, obstacleMatSpike);
  mesh.castShadow = true;
  return mesh;
}, 6);
const obstacles = [];

const powerupGeo = new THREE.SphereGeometry(0.6, 16, 16);
const powerupMat = new THREE.MeshStandardMaterial({
  color: 0x55ffaa,
  roughness: 0.15,
  metalness: 0.7,
  emissive: 0x22ff88,
  emissiveIntensity: 0.8,
});
const powerupPool = makePool(() => {
  const group = new THREE.Group();
  const mesh = new THREE.Mesh(powerupGeo, powerupMat.clone());
  mesh.castShadow = true;
  group.add(mesh);
  const glow = new THREE.PointLight(0x55ffaa, 1.5, 8);
  glow.position.set(0, 0, 0);
  group.add(glow);
  return group;
}, 6);
const powerUps = [];

const powerupTypes = [
  { type: "dual", color: 0x8bff8b, duration: 10 },
  { type: "spread", color: 0xffd36b, duration: 10 },
  { type: "laser", color: 0x9b7bff, duration: 8 },
  { type: "rocket", color: 0xff9aa2, duration: 10 },
  { type: "heal", color: 0x6bffb7, duration: 0, heal: 25 },
];

function spawnObstacle() {
  const useSpike = Math.random() < 0.6;
  const o = obstaclePool.acquire();
  o.geometry = useSpike ? obstacleGeoSpike : obstacleGeoTower;
  o.material = useSpike ? obstacleMatSpike : obstacleMatTower;
  const x = (Math.random() - 0.5) * railBounds.x * 2;
  const z = 70 + Math.random() * 30;
  const altitude = 2 + Math.random() * 3;
  o.position.set(x, groundHeightAt(x, z) + altitude, z);
  o.userData.radius = useSpike ? 1.4 : 1.2;
  o.userData.damage = 25;
  o.userData.spin = (Math.random() - 0.5) * 2.2;
  scene.add(o);
  obstacles.push(o);
}

function spawnPowerUp() {
  const def = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
  const p = powerupPool.acquire();
  const mesh = p.children[0];
  if (mesh && mesh.material) {
    mesh.material.color.setHex(def.color);
    mesh.material.emissive.setHex(def.color);
  }
  const light = p.children[1];
  if (light && light.isLight) {
    light.color.setHex(def.color);
  }
  const x = (Math.random() - 0.5) * railBounds.x * 2;
  const z = 70 + Math.random() * 30;
  const altitude = 3 + Math.random() * 3;
  p.position.set(x, groundHeightAt(x, z) + altitude, z);
  p.userData.type = def.type;
  p.userData.duration = def.duration;
  p.userData.heal = def.heal || 0;
  p.userData.spin = 0.6 + Math.random() * 0.8;
  scene.add(p);
  powerUps.push(p);
}

function applyPowerUp(type, duration, heal) {
  if (type === "heal") {
    playerState.hp = Math.min(100, playerState.hp + (heal || 20));
    audio.beep(240, 0.08, 0.05);
    vibrate(15);
    return;
  }
  playerState.weapon = type;
  playerState.weaponTimer = duration;
  playerState.weaponTimerMax = duration;
}

// --- Particles ------------------------------------------------------------
const particleGeo = new THREE.SphereGeometry(0.2, 8, 8);
const particlePool = makePool(() => new THREE.Mesh(particleGeo, new THREE.MeshBasicMaterial({ color: 0xffb347 })), 30);
const particles = [];

function spawnExplosion(pos, color, intensity = 1) {
  const count = Math.min(particleBudget, Math.floor(10 * intensity));
  for (let i = 0; i < count; i++) {
    const p = particlePool.acquire();
    p.material.color.setHex(color);
    p.position.copy(pos);
    p.userData.life = 0.6 + Math.random() * 0.4;
    p.userData.vel = new THREE.Vector3(
      (Math.random() - 0.5) * 4,
      (Math.random() - 0.2) * 3,
      (Math.random() - 0.5) * 4
    );
    scene.add(p);
    particles.push(p);
  }
}

// --- Scoring --------------------------------------------------------------
let score = 0;
let combo = 0;
let comboTimer = 0;

function addScore(base) {
  if (comboTimer > 0) {
    combo += 1;
  } else {
    combo = 1;
  }
  comboTimer = 2.0;
  const mult = 1 + Math.min(combo, 50) * 0.02;
  score += Math.floor(base * mult);
}

// --- Waves ---------------------------------------------------------------
let wave = 1;
let killsThisWave = 0;
let bossActive = false;
let spawnTimer = 0;
let obstacleTimer = 0;
let powerupTimer = 0;

function waveKillTarget() {
  return 18 + wave * 4;
}

function spawnWaveEnemy() {
  const roll = Math.random();
  let preset = enemyPresets[0];
  if (wave >= 2 && roll > 0.55) preset = enemyPresets[1];
  if (wave >= 3 && roll > 0.8) preset = enemyPresets[2];
  if (wave >= 4 && roll > 0.9) preset = enemyPresets[3];
  spawnEnemy(preset);
}

function spawnBoss() {
  spawnEnemy(bossPreset);
  bossActive = true;
}

// --- Updates -------------------------------------------------------------
const scrollSpeed = 14;
const camOffset = new THREE.Vector3(0, 5.5, -10);
const playerRadius = 1.0;

function updateBackground(dt) {
  terrainOffsetZ += scrollSpeed * dt;
  for (const chunk of groundChunks) {
    chunk.position.z -= scrollSpeed * dt;
    if (chunk.position.z < -WORLD.chunkLength) {
      chunk.position.z += WORLD.chunkLength * WORLD.chunkCount;
      chunk.userData.offsetZ += WORLD.chunkLength * WORLD.chunkCount;
      updateChunkGeometry(chunk);
    }
  }
}

function updatePlayer(dt) {
  const keyX = (keys["a"] || keys["arrowleft"] ? -1 : 0) + (keys["d"] || keys["arrowright"] ? 1 : 0);
  const keyY = (keys["w"] || keys["arrowup"] ? 1 : 0) + (keys["s"] || keys["arrowdown"] ? -1 : 0);

  const dz = joyTarget.length();
  if (dz < joyDeadzone) {
    joyDir.set(0, 0);
  } else {
    joyDir.copy(joyTarget);
  }

  const targetX = keyX - joyDir.x;
  const targetY = keyY - joyDir.y;
  moveInput.lerp(tempVec2.set(targetX, targetY), 0.25);

  const speed = playerState.speed * diffMult.playerSpeed;
  player.position.x += moveInput.x * speed * dt;
  player.position.x = THREE.MathUtils.clamp(player.position.x, -railBounds.x, railBounds.x);

  playerState.offsetY += moveInput.y * speed * dt;
  playerState.offsetY = THREE.MathUtils.clamp(playerState.offsetY, railBounds.yMin, railBounds.yMax);

  player.position.z = 0;
  player.position.y = groundHeightAt(player.position.x, player.position.z) + playerState.baseAltitude + playerState.offsetY;

  const bank = THREE.MathUtils.clamp(-moveInput.x * 0.6, -0.5, 0.5);
  player.rotation.z = THREE.MathUtils.lerp(player.rotation.z, bank, 0.15);
  player.rotation.x = THREE.MathUtils.lerp(player.rotation.x, 0.05, 0.08);

  if (playerState.inv > 0) {
    playerState.inv -= dt;
    player.visible = Math.floor(playerState.inv * 12) % 2 === 0;
  } else {
    player.visible = true;
  }
}

function updateBullets(dt) {
  for (let i = playerBullets.length - 1; i >= 0; i--) {
    const b = playerBullets[i];
    b.position.addScaledVector(b.userData.vel, dt);
    b.userData.life -= dt;
    if (b.userData.life <= 0 || b.position.z > 140) {
      bulletPool.release(b);
      playerBullets.splice(i, 1);
    }
  }

  for (let i = enemyBullets.length - 1; i >= 0; i--) {
    const b = enemyBullets[i];
    b.position.addScaledVector(b.userData.vel, dt);
    if (b.userData.wave) {
      b.userData.phase += dt * b.userData.wave.freq;
      const offset = Math.sin(b.userData.phase) * b.userData.wave.amp;
      const delta = offset - b.userData.lastOffset;
      b.position.addScaledVector(b.userData.side, delta);
      b.userData.lastOffset = offset;
    }
    b.userData.life -= dt;
    if (b.userData.life <= 0 || b.position.z < -40) {
      enemyBulletPool.release(b);
      enemyBullets.splice(i, 1);
      continue;
    }
    if (b.position.distanceTo(player.position) < playerRadius) {
      damagePlayer(b.userData.damage);
      spawnExplosion(b.position, 0xff7a7a, 0.6);
      enemyBulletPool.release(b);
      enemyBullets.splice(i, 1);
    }
  }
}

updateOrientation();
animate(lastTime);
