import {
  getLobbyRoomConnection,
} from 'shared-ar'

function generateRandomPosition(radius, center) {
  // Generate a random angle between 0 and 2π.
  const angle = Math.random() * Math.PI * 2
  // Use the square root of a random number for uniform distribution inside the circle.
  const r = Math.sqrt(Math.random()) * radius
  return {
    x: center.x + r * Math.cos(angle),
    y: center.y,  // Use center.y for vertical positioning.
    z: center.z + r * Math.sin(angle),
  }
}

export const spawnFishComponent = {
  schema: {
    model: {type: 'string', default: '#fish-model'},                 // ID of the fish model
    spawnRate: {type: 'number', default: 3000},                      // Spawn interval (milliseconds)
    maxFish: {type: 'number', default: 5},                           // Maximum number of fish allowed
    minFish: {type: 'number', default: 3},                           // Minimum fish to always have in the pond
    area: {type: 'number', default: 10},                             // Radius of the spawn circle
    center: {type: 'vec3', default: {x: 0, y: 0, z: -5}},            // Center of the spawn area
    lifetime: {type: 'number', default: 10000},                      // How long a fish lives before despawning (milliseconds)
    networkedTemplate: {type: 'string', default: '#fish-template'},  // Template for networked fish
  },

  init() {
    // Ensure global fish list exists.
    if (!window.fishList) window.fishList = []
    this.lastSpawnTime = Date.now()
  },

  tick(time, timeDelta) {
    const currentTime = Date.now()

    // Remove expired fish and update positions in window.fishList.
    window.fishList = window.fishList.filter((entry) => {
      if (currentTime - entry.spawnTime >= this.data.lifetime) {
        if (entry.fish.parentNode) {
          entry.fish.parentNode.removeChild(entry.fish)
        }
        return false  // Remove this fish.
      } else {
        // Update stored position.
        const pos = entry.fish.getAttribute('position')
        entry.position = pos
        return true
      }
    })

    // Log the number of fish in the pond.
    // console.log('Fish in pond:', window.fishList.length)

    // If there are zero fish, force spawn one immediately.
    if (window.fishList.length === 0) {
      this.spawnFish()
      this.lastSpawnTime = currentTime
      return
    }

    // Spawn a new fish based on spawnRate if we haven't hit maxFish.
    if (
      currentTime - this.lastSpawnTime >= this.data.spawnRate &&
      window.fishList.length < this.data.maxFish
    ) {
      this.spawnFish()
      this.lastSpawnTime = currentTime
    }

    // Ensure minimum fish count is maintained.
    if (window.fishList.length < this.data.minFish) {
      const needed = this.data.minFish - window.fishList.length
      for (let i = 0; i < needed; i++) {
        if (window.fishList.length < this.data.maxFish) {
          this.spawnFish()
          this.lastSpawnTime = currentTime
        }
      }
    }
  },

  spawnFish() {
    const scene = this.el.sceneEl
    // Use the radius (this.data.area) and center (this.data.center) to generate a random position.
    const initialPos = generateRandomPosition(this.data.area, this.data.center)
    const fish = document.createElement('a-entity')

    // Assign a unique id to the fish.
    fish.id = `fish-${Date.now()}-${Math.floor(Math.random() * 1000)}`

    // Set fish attributes.
    fish.setAttribute('gltf-model', this.data.model)
    fish.setAttribute('position', `${initialPos.x} ${initialPos.y} ${initialPos.z}`)
    fish.setAttribute('scale', '0.01 0.01 0.01')

    // Add the networked component to the fish.
    fish.setAttribute('networked', {
      template: this.data.networkedTemplate,  // Use the networked template
    })

    // Function to generate a new target position and update the fish's animation.
    const moveToNewTarget = () => {
      // Generate a new random target position.
      const newTargetPos = generateRandomPosition(this.data.area, this.data.center)

      // Calculate the direction vector from the fish's current position to the new target.
      const currentPos = fish.getAttribute('position')
      const direction = {
        x: newTargetPos.x - currentPos.x,
        y: newTargetPos.y - currentPos.y,
        z: newTargetPos.z - currentPos.z,
      }

      // Calculate the angle to rotate the fish to face the new target.
      const angle = Math.atan2(direction.x, direction.z) * (180 / Math.PI)

      // Set the fish's rotation to face the new target.
      fish.setAttribute('rotation', `0 ${angle} 0`)

      // Update the fish's animation to move towards the new target.
      fish.setAttribute('animation', {
        property: 'position',
        to: `${newTargetPos.x} ${newTargetPos.y} ${newTargetPos.z}`,
        dur: 2500,         // Duration of the animation in milliseconds.
        loop: false,       // Do not loop the animation.
        easing: 'linear',  // Smooth linear movement.
      })
      fish.setAttribute('animation-mixer', {
        clip: '*',         // Play all animations or specify a clip name
        loop: 'repeat',    // Loop the animation
        timeScale: 1,      // Playback speed
      })

      // Listen for the 'animationcomplete' event to trigger the next move.
      fish.addEventListener('animationcomplete', moveToNewTarget, {once: true})
    }

    // Start the first movement.
    moveToNewTarget()

    // Append fish to the scene.
    scene.appendChild(fish)

    // Update global fish list immutably.
    window.fishList = window.fishList.concat([
      {id: fish.id, fish, spawnTime: Date.now(), position: initialPos},
    ])
  },

  remove() {
    window.fishList.forEach((entry) => {
      if (entry.fish.parentNode) {
        entry.fish.parentNode.removeChild(entry.fish)
      }
    })
    window.fishList = []
  },
}
