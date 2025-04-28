import {getLobbyRoomConnection} from 'shared-ar'

// Checks if an enemy is at the same z position as the player within a specified threshold,
// and if the player is not jumping, triggers the 'client-died' event.
// This component is not networked. Each player checks is responsible for their collisions.
const basicColliderComponent = {
  schema: {
    enabled: {default: false},           // determines whether the collision is running
    enemySelector: {default: '#enemy'},  // element selector for enemy entity to track
    zThreshold: {default: 0.1},          // the z distance threshold when checking the enemy's position against the player
    minHeight: {default: 0.1},           // the min distance the player must jump to avoid collision with the enemy
  },

  init() {
    this.player = this.el
    this.enemy = document.querySelector(this.data.enemySelector)
  },

  async tick() {
    if (!this.data.enabled) {
      return
    }

    // get the current position of enemy
    const enemyPosition = this.enemy.object3D.position

    // get the current position of player
    const playerPosition = this.player.object3D.position

    // check if enemy is in the same z position (within a threshold)
    if (Math.abs(enemyPosition.z - playerPosition.z) <= this.data.zThreshold) {
      // check if the player is above the enemy. If not, they are dead.
      const groundY = document.getElementById('my-player')?.getAttribute('jump-controller')?.groundY ?? 0
      if (playerPosition.y < this.data.minHeight + groundY) {
        // remove controls from player
        this.player.setAttribute('jump-controller', 'enabled: false')

        // emit 'client-died' event to handle local client death state
        const roomConnection = await getLobbyRoomConnection()
        this.el.sceneEl.emit('client-died', {timeOfDeathMs: roomConnection.serverEpochMs})
        this.data.enabled = false
      }
    }
  },
}




// Manages character animations.
// Initializes and stores a set of animation actions when a model is loaded.
// This component is not networked. Each player is responsible for their animations.
const characterAnimatorComponent = {
  schema: {
    currentAnimation: {type: 'string', default: 'Idle'},  // sets the current animation to play
    loop: {type: 'boolean', default: true},               // determines whether the animation clip loops
    duration: {type: 'number', default: 0},               // determines the length in ms of the crossfade duration from the previous clip
    stopAtEnd: {type: 'boolean', default: false},         // sets whether animation stops at the end or resets back to the first frame; AKA clampWhenFinished
  },

  init() {
    this.mixer = null
    this.animationActions = new Map()

    // Wait for the model to be loaded before initializing animations
    this.el.addEventListener('model-loaded', (event) => {
      const {model} = event.detail

      // Create a mixer for the model
      this.mixer = new THREE.AnimationMixer(model)

      // Create and store an AnimationAction for each clip
      model.animations.forEach((clip) => {
        const action = this.mixer.clipAction(clip)
        this.animationActions.set(clip.name, action)
      })

      // Play the default animation
      if (this.data.currentAnimation) {
        this.playAnimation(this.data.currentAnimation, true)
      }
    })
  },

  update(oldData) {
    // Check if currentAnimation has changed
    // Additional check so that we don't ever go from death to any other animation.
    // This is to prevent jump controller changing the animation to idle even when the
    // character is dead. There are better ways of doing this (i.e create a networked "isDead" flag)
    // but this is much simpler.
    if (oldData.currentAnimation !== this.data.currentAnimation &&
        oldData.currentAnimation !== 'Death') {
      // Play the new animation
      this.playAnimation(
        this.data.currentAnimation,
        this.data.loop,
        this.data.duration,
        this.data.stopAtEnd
      )
    }
  },

  playAnimation(animationName, loop, duration, stopAtEnd) {
    const action = this.animationActions.get(animationName)

    if (action) {
    // Reset the animation
      action.reset()

      // Set the loop mode based on the loop argument
      if (loop) {
        action.setLoop(THREE.LoopRepeat, Infinity)
      } else {
        action.setLoop(THREE.LoopOnce)
        if (stopAtEnd) {
          action.clampWhenFinished = true
        }
      }

      // If there is a currently playing animation, crossfade to the new one
      if (this.currentAnimation) {
        action.enabled = true
        action.crossFadeFrom(this.currentAnimation, duration, false).play()
      } else {
      // If no animation is currently playing, play the new animation
        action.play()
      }

      // Update the current animation
      this.currentAnimation = action
    } else {
      console.warn(`Animation "${animationName}" not found.`)
    }
  },

  tick(time, timeDelta) {
    if (this.mixer) {
      const deltaTime = timeDelta / 1000
      this.mixer.update(deltaTime)
    }
  },
}



// Allows an entity to jump in response to click events, simulating physics with gravity
// This component is not networked. Each player is responsible for their own jump action.
// Network messages are sent to notify a jump has started, but the whole animation
// is simulated locally on each client.
const jumpControllerComponent = {
  schema: {
    enabled: {default: true},  // determines whether the player can jump
    jumpHeight: {type: 'number', default: 1.0},
    jumpDurationMs: {type: 'number', default: 1000},
    groundY: {type: 'number', default: 0},
    jumpStartTimeMs: {type: 'number', default: -1},
  },

  init() {
    // Set the peer id to self peerId only if this is my own avatar
    // Also only locally react to clicks for the player entity
    if (this.el.id === 'my-player') {
      this.onClick = this.onClick.bind(this)
    }
  },

  async onClick() {
    if (!this?.data?.enabled ?? false) {
      return
    }

    // Check if the entity is on the ground
    if (this.el.getAttribute('position').y !== this.data.groundY) {
      return
    }

    // Send jump message. Other peers will trigger jump on receive
    const roomConnection = await getLobbyRoomConnection()
    this.data.jumpStartTimeMs = roomConnection.serverEpochMs
  },

  play() {
    // When the scene is playing, start listening for click events if enabled
    if (this.data.enabled && this.el.id === 'my-player') {
      window.addEventListener('click', this.onClick)
    }
  },

  pause() {
    // When the scene is paused, stop listening for click events
    window.removeEventListener('click', this.onClick)
  },

  async tick(time, timeDelta) {
    // Skip if no start time has been set
    if (this.data.jumpStartTimeMs === -1) return

    // Calculate the current jump progress
    const roomConnection = await getLobbyRoomConnection()
    const progress = Math.min((roomConnection.serverEpochMs - this.data.jumpStartTimeMs) / this.data.jumpDurationMs, 1)

    // Use a quadratic easing function for the jump animation curve
    let y = this.data.groundY
    if (progress < 0.5) {
      // Ascend
      y += 4 * this.data.jumpHeight * progress * progress

      // If we are just taking off, start the jump animation
      if (this.el.getAttribute('position').y === this.data.groundY) {
        this.el.setAttribute('character-animator', {
          currentAnimation: 'Jump',
          loop: false,
        })
      }
    } else {
      // Descend
      const t = progress - 0.5
      y += this.data.jumpHeight - (4 * this.data.jumpHeight * t * t)

      // If we have reached the ground. Change animation back to idle.
      if (y === this.data.groundY && this.data.enabled) {
        this.el.setAttribute('character-animator', {
          currentAnimation: 'Idle',
          loop: true,
        })
      }
    }

    // Update the entity's position
    const position = this.el.getAttribute('position')
    position.y = y
    this.el.setAttribute('position', position)
  },

  update(oldData) {
    // Add or remove the event listener when the 'enabled' attribute changes
    if (oldData.enabled !== this.data.enabled) {
      if (this.data.enabled && this.el.id === 'my-player') {
        window.addEventListener('click', this.onClick)
      } else {
        window.removeEventListener('click', this.onClick)
      }
    }
  },
}

// deathAnimationComponent lerps the entity on play() so that it simulates a "death"
// by sudden ladel impact.
// When play() is called, the entity goes up `jumpHeight` from `groundY`, then goes back
// down to `groundY` and continues falling to `deathY`
const deathAnimationComponent = {
  schema: {
    jumpHeight: {type: 'number', default: 1},  // How high the entity will go before falling back down
    jumpDuration: {type: 'number', default: 500},  // Duration in milliseconds of the "ascend" phase
    deathFallDuration: {type: 'number', default: 600},  // Duration in milliseconds of the "descend" phase
    groundY: {type: 'number', default: 2},  // y position where the entity 'death' starts from
    deathY: {type: 'number', default: 0},  // y position to where the entity falls at the death of the lerp
  },

  init() {
    this.startTime = null
    this.isPlaying = false
  },

  play() {
    this.startTime = null
    this.isPlaying = true
  },

  pause() {
    this.isPlaying = false
  },

  tick(time) {
    if (!this.isPlaying) return
    const {jumpHeight, jumpDuration, deathFallDuration, groundY, deathY} = this.data
    if (!this.startTime) {
      this.startTime = time
    }

    const totalDuration = jumpDuration + deathFallDuration
    const progress = (time - this.startTime) / totalDuration

    let y
    if (progress < 0.5) {
      // Ascend and Descend phase: Make a normal jump and then come back to ground.
      const jumpProgress = progress * 2
      if (jumpProgress <= 0.5) {
        // Ascend
        y = groundY + jumpProgress * 2 * jumpHeight
      } else {
        // Descend
        y = groundY + jumpHeight - (jumpProgress - 0.5) * 2 * jumpHeight
      }
    } else {
      // Death fall phase: Fall to the abyss.
      const fallProgress = (progress - 0.5) * 2
      y = groundY - fallProgress * (groundY - deathY)
    }

    this.el.setAttribute('position', {
      x: this.el.object3D.position.x, y, z: this.el.object3D.position.z,
    })

    if (y <= deathY) {
      this.isPlaying = false
    }
  },
}

// Moves an entity along a defined curve path, creating an escalating attack pattern.
// This component is not networked. It is aproximately in sync throughout all clients
// due to the fact that we sync game start time via synchronized server time.
const attackPatternComponent = {
  schema: {
    enabled: {default: false},          // determines whether the enemy can move
    speedUpOverTime: {default: false},  // if true, entity will animate faster over time
    scheduleStop: {default: false},     // if true, the entity will stop moving at the end of the round
    loopsPerRound: {default: 2},        // how many animation loops the enemy plays before increasing speed
    initialDuration: {default: 6000},   // how long, in milliseconds, the first attack loop takes
    minDuration: {default: 1500},       // the minimum animation duration, in milliseconds
  },

  init() {
    const curvePath = document.createElement('a-curve')
    curvePath.id = 'attack-path'
    this.el.appendChild(curvePath)

    // set points the spoon animates between
    const point1 = document.createElement('a-curve-point')
    point1.object3D.position.set(1.75, 2.35, -2)
    curvePath.appendChild(point1)
    const point2 = document.createElement('a-curve-point')
    point2.object3D.position.set(1.75, 2.35, 2)
    curvePath.appendChild(point2)

    // This adds the alongPathComponent (see utils/along-path.js)
    // Which lerps the entity with the given easing.
    // This lerping is NOT synchronized via server clock, so it
    // is a possible point of failure if a client chugs, etc..
    // For this sample, we are okay with that, but a real application
    // may want to synchronize the lerp via server time (just like we do
    // with jumpControllerComponent)
    this.el.setAttribute('along-path', {
      enabled: this.data.enabled,
      curve: '#attack-path',
      rotate: false,
      dur: this.dur,
      loop: true,
      easing: 'easeInOut',
    })

    this.configureSpeedUpOverTime()
  },

  update(oldData) {
    // If we are scheduling a stop, make sure we do stop at the end of the sweep
    if (oldData.scheduleStop !== this.data.scheduleStop && this.data.scheduleStop) {
      this.el.addEventListener('switched-direction', () => {
        this.el.setAttribute('along-path', {
          enabled: false,
          curve: '#attack-path',
          rotate: false,
          dur: this.dur,
          easing: 'easeInOut',
        })
      })

      return
    }

    this.el.setAttribute('along-path', {
      enabled: this.data.enabled,
      curve: '#attack-path',
      rotate: false,
      dur: this.dur,
      easing: 'easeInOut',
    })
  },

  configureSpeedUpOverTime() {
    // If configured, every N sweeps,
    // increase paddle movement speed
    this.sweepCount = 0
    this.dur = this.data.initialDuration
    this.el.addEventListener('switched-direction', () => {
      if (this.data.speedUpOverTime) {
        this.sweepCount++
        if ((this.sweepCount / 2) % this.data.loopsPerRound === 0) {
          // After every loopsPerRound, increase the speed by reducing the duration
          // Reducing duration to 67% of previous makes it 50% faster
          this.dur = Math.max(this.data.minDuration, this.dur * 0.67)
          this.el.setAttribute('along-path', 'dur', this.dur)
        }
      }
    })
  },
}

export {
  jumpControllerComponent,
  basicColliderComponent,
  characterAnimatorComponent,
  attackPatternComponent,
  deathAnimationComponent,
}
