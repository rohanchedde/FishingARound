export const fishMovementComponent = {
  schema: {
    fish: {type: 'selector'},  // Selector for the fish entity
  },
  init() {
    const {fish} = this.data

    // Array to store fish entities
    this.fishEntities = []

    // Function to generate a random position within a range
    const getRandomPosition = () => {
      const x = Math.random() * 10 - 5  // Random x position between -5 and 5
      const y = 0  // Keep y at 0 for ground level
      const z = Math.random() * -10  // Random z position between 0 and -10
      return {x, y, z}
    }

    // Function to generate a random rotation around the Y-axis
    const getRandomRotation = () => {
      const y = Math.random() * 360  // Random Y rotation between 0 and 360 degrees
      return {x: 0, y, z: 0}
    }

    // Create and position 5 fish instances
    for (let i = 0; i < 5; i++) {
      const fishEntity = document.createElement('a-entity')
      fishEntity.setAttribute('id', `fish-${i}`)  // Unique ID for each fish

      // Clone the fish model
      fishEntity.setAttribute('gltf-model', '#fish-model')  // Use the fish model directly
      fishEntity.setAttribute('scale', '0.01 0.01 0.01')  // Adjust scale as needed

      // Set random position and rotation
      const position = getRandomPosition()
      const rotation = getRandomRotation()
      fishEntity.setAttribute('position', position)
      fishEntity.setAttribute('rotation', rotation)

      // Add animation mixer to play the built-in animation
      fishEntity.setAttribute('animation-mixer', {
        clip: '*',  // Play all animations (or specify the animation name)
        loop: 'repeat',  // Loop the animation
        timeScale: 1,  // Adjust playback speed if needed
      })

      // Append the fish entity to the scene
      this.el.sceneEl.appendChild(fishEntity)

      // Store the fish entity for later updates
      this.fishEntities.push(fishEntity)
    }
  },
  tick() {

  },
  remove() {
    // Cleanup event listeners or remove fish entities if needed
    this.fishEntities.forEach((fishEntity) => {
      fishEntity.remove()
    })
  },
}
