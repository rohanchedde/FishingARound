import {
  getLobbyRoomConnection,
} from 'shared-ar'


const DEATH_MESSAGE_TAG = 1
const START_TIME_MESSAGE_TAG = 2

export let selfPeerID = null
export let isHost = null
export let sortedPlayerNames = null
export let sortedPlayerIds = null

document.addEventListener("DOMContentLoaded", function () {
let audioEntity = document.getElementById("gameAudio"); });

// lobbyHandlerComponent listens to lobby events and sets the appropiate user states.
// It is also responsible for initializing XRWeb.
const lobbyHandlerComponent = {
  init() {
    const scene = this.el.sceneEl

    const addXrWeb = () => {
      scene.setAttribute('xrweb', { //enable AR
        allowedDevices: 'any',
        disableDesktopCameraControls: true,
      })

      scene.emit('recenter')
    }

    scene.addEventListener('lobby8-countdowndone', addXrWeb)
  },
}

// gameStartComponent listents to lobby countdowns and starts the countdown to game start.
// It shows the appropiate UI and handles enemy state on start as needed.
const gameStartComponent = {
  schema: {
    startTimeMs: {type: 'number', default: 0},
  },

  init() {
    this.el.sceneEl.addEventListener('lobby8-roomJoined', (event) => {
      document.body.classList.add('game-active');
      // Here, we use room connection API to sync start time ms.
      // Since gameStartComponent is not inside a template (it's a scene component),
      // we can't use synchronized properties.
      // The "host" player sends the message on lobby countdown done.
      event.detail.roomConnection.registerOnPeerMessage((msg) => {
        if (msg.tag == START_TIME_MESSAGE_TAG) {
          this.data.startTimeMs = msg.data.startTimeMs
        }
      })
    })

    this.el.sceneEl.addEventListener('lobby8-countdowndone', async (event) => { //THIS IS WHEN GAME STARTS
         let audioElement = document.getElementById("gameAudio"); // Get the native audio element
         audioElement.volume = 0.5;
    if (audioElement && !audioElement.paused) { // Only pause if it's playing
        audioElement.pause();
    }
      // Defining a host is useful since we don't have a server authority.
      // This allows us to have one peer determine things like a synchronized game
      // start time.
      // For simplicity, we can sort all peersInRoom and use the smallest peerId as the host.
      // The lobby API does not expose new players joining after the lobby countdown starts,
      // so we can safely use `peersInRoom` here knowing that it will be the same list
      // for all peers
      const roomConnection = await getLobbyRoomConnection()
      sortedPlayerIds = [...roomConnection.peersInRoom].sort()

      sortedPlayerNames = sortedPlayerIds.map(peerId => {
      return roomConnection.getPlayerName(peerId)
        })


      isHost = event.detail.selfPeerId === sortedPlayerIds[0]


      // time in seconds for game start countdown
      const countdownTime = 1
      const playersInGame = event.detail.lobbyUserDetails
      selfPeerID = event.detail.selfPeerId

      const instructionContainer = document.getElementById('instruction-container')
      //implemneting the countdown ----------------------------------------------------
      const timer = document.getElementById('timer')
      let timeLeft = 30; // 2 minutes in seconds
      let extraTimer = 3; 

      const countdown = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        
        // Format as MM:SS
        const formattedTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        console.log(formattedTime); // Logs time left
        timer.textContent = `Time left: ${formattedTime}`;

        timeLeft--; // Decrease time
        
        // Stop when time runs out
        if (timeLeft < 0) {
          clearInterval(countdown);
          console.log("Countdown finished!");
          this.el.sceneEl.emit('time-done');

      if (isHost){

          roomConnection.sendMessage ({

              tag: 101,
              data: {
                randomData: 7,
              }

          })}

      else{

            extraTimer--;

            if (extraTimer < 1){

            roomConnection.sendMessage ({

              tag: 101,
              data: {
                randomData: 9,
              }

          })


            }



      }
          
        }
      }, 1000); // Update every second (1000ms)
      //-------------------------------------------------------------------
      const countdownText = document.getElementById('countdown-text')
      const warningText = document.getElementById('warning-text')
      const remainingText = document.getElementById('remaining-text')
      //const gameScore = document.getElementById('gameScore') // Take a look inside the bracket
      const playAgainBtn = document.getElementById('play-again-btn')
      const enemy = document.getElementById('enemy')

      // set remaining crabs number
      //remainingText.innerText = `${event.detail.numPlayers}`

      if (window.score !== undefined) {
         // gameScore.innerText = `Score: ${window.score}`;  // Display the score
      } else {
          //console.error("window.score is not defined.");
        }

      // show countdown UI
      instructionContainer.classList.remove('hidden')

      // Setup play again button.
      playAgainBtn.addEventListener('click', () => {
        // clicking the play again button at the end reloads the page,
        // returning that player back to the lobby
        window.location.reload()
      })

      // We use local time, assuming all peers are roughly in sync at start, but
      // we will listen for host to set start time, to make sure we are all in sync
      // This could be considered client prediction
      const startTimeMs = Math.max(0, roomConnection.serverEpochMs + countdownTime * 1000)

      // If we have been deemed the "host", send the message so other peers can sync up
      if (isHost) {
        roomConnection.sendMessage({
          tag: START_TIME_MESSAGE_TAG,
          data: {
            startTimeMs: startTimeMs
          }
        })
      }

      // alternate between yellow and red text for effect
      const warningInterval = setInterval(() => {
        warningText.classList.toggle('red-on-yellow')
      }, 1000)

      const countdownInterval = setInterval(() => {
        // If the "host" has sent us their start time, we use that. Otherwise, we use
        // our start time
        const udpatedStartTimeMs = this.data.startTimeMs !== 0 ? this.data.startTimeMs : startTimeMs
        if (roomConnection.serverEpochMs < udpatedStartTimeMs) {
          const secondsRemaining = Math.max(0, udpatedStartTimeMs - roomConnection.serverEpochMs) 
          countdownText.innerText = Math.ceil(secondsRemaining / 1000)
          return
        }

        countdownText.innerText = 'Start!'
        instructionContainer.classList.add('scaleUpFadeOut')
        clearInterval(warningInterval)
        clearInterval(countdownInterval)
        // Remove the container after animation completes
        instructionContainer.addEventListener('animationend', () => {
          instructionContainer.classList.add('hidden')
          instructionContainer.classList.remove('scaleUpFadeOut')
          countdownText.innerText = '' // Clear the text
        }, { once: true }) // Only run this once

        // This starts the ladel / enemy animation
        // This animation is only synced on game start which could cause drift.
        // A real application may want to sync something like that more often
        enemy.setAttribute('attack-pattern', 'enabled: true')
        this.el.emit('gamestart-countdown-done', {playersInGame, selfPeerId, isHost})
      }, 50)
    })
  },
}

// gameOverComponent tracks the players that are still "alive"
// and triggers the death UI to show on last crab standing
// It sends death messages and listens for them
const gameOverComponent = {
  alivePlayers: [],
  deathQueue: [],

  async init() {
    const roomConnection = await getLobbyRoomConnection()
    this.el.sceneEl.addEventListener('gamestart-countdown-done', async (event) => {
      // At this point its safe to assign the alive players array that will keep
      // track of who did not die
      this.alivePlayers = [...event.detail.playersInGame]

      // Listen to client death event. This handles death of local player.
      this.el.sceneEl.addEventListener('client-died', (evt) => {
        // We have to trigger our death event since messages sent are not "handled" locally
        // Note that queue and process all deaths at a 200 ms delay.
        // This is important, and a common practive in
        // networking. We give some leeway for potential other player death networked messages
        // to arrive. This resolves race conditions and handles ties, without players feeling that
        // they have been "cheated" by the system.
        this.deathQueue.push({peerId: event.detail.selfPeerId, timeMs: evt.detail.timeOfDeathMs})

        // Play death animation for this player. Can't use this.el since gameOverComponent
        // is not attached to the avatar.
        // Death consists in 3 steps: Death animation, play the death animation lerp, remove jump
        const playerEl = document.getElementById('my-player')
        playerEl?.setAttribute('character-animator', {
          currentAnimation: 'Death',
          loop: false,
          stopAtEnd: true,
        })
        playerEl?.components['death-animation'].play()
        playerEl?.removeAttribute('jump-controller')
        document.getElementById(`fruit-${event.detail.selfPeerId}`)?.remove()

        // Send death message. Other peers will trigger handleDeath due to listener
        roomConnection.sendMessage({
          tag: DEATH_MESSAGE_TAG,
          data: {
            'timeOfDeathMs': evt.detail.timeOfDeathMs,
          },
        })
      })

      // Listen for death message. This handles other player deaths.
      roomConnection.registerOnPeerMessage((message) => {
        if (message.tag !== DEATH_MESSAGE_TAG) {
          return
        }

        // Animation is immediately displayed
        // Death consists in 3 steps: Death animation, play the death animation lerp, remove jump
        const playerEl = document.getElementById(`other-player-${message.sender}`)
        playerEl?.setAttribute('character-animator', {
          currentAnimation: 'Death',
          loop: false,
          stopAtEnd: true,
        })
        playerEl?.components['death-animation'].play()
        playerEl?.removeAttribute('jump-controller')
        document.getElementById(`fruit-${message.sender}`)?.remove()

        // Death is queued for processing with a delay, to avoid ties
        this.deathQueue.push({peerId: message.sender, timeMs: message.data.timeOfDeathMs})
      })

      // Check for game over every 200 ms. This lets clients "catch up" to messages from other peers
      // and resolve ties when deaths happen close to each other
      const deathProcessingDelayMs = 200
      const gameOverInterval = setInterval(() => {
        // Process all deaths this tick, removing the peer ids from the alive players array
        const deathsThisTick = []
        while (this.deathQueue.length > 0) {
          const deathInfo = this.deathQueue.shift()
          this.alivePlayers = this.alivePlayers.filter(x => x.peerId !== deathInfo.peerId)
          deathsThisTick.push(deathInfo)
        }

        // Check for game over condition, and trigger game end as needed
        const playersLeftForGameOver = Math.min(1, event.detail.playersInGame.length - 1)
        if (this.alivePlayers.length <= playersLeftForGameOver) {
          this.handleGameOver(deathsThisTick, event.detail.selfPeerId)
          clearInterval(gameOverInterval)
        }

        // Update remaining player count on each crab death.
        const remainingText = document.getElementById('remaining-text')
        remainingText.innerText = `${this.alivePlayers.length}`
      }, deathProcessingDelayMs)
    })
  },

  handleGameOver(deathsThisTick, selfPeerId) {
    const endGameText = document.getElementById('end-game-container')
    const outcomeText = document.getElementById('outcome-text')
    const winnerText = document.getElementById('winner-text')
    const playAgainBtn = document.getElementById('play-again-btn')
    const enemy = document.getElementById('enemy')

    endGameText.classList.remove('hidden')
    playAgainBtn.classList.remove('hidden')

    // If we have had more than one death this tick, end in a tie.
    // For now just display Tie msg with no player names
    if (deathsThisTick.length > 1) {
      outcomeText.innerText = 'Tie'
    } else {
      // display winning player's name to everyone
      const isWinner = (this.alivePlayers.length > 0 && selfPeerId === this.alivePlayers[0].peerId)
      outcomeText.innerText = isWinner ? 'Congrats' : 'You Lose'
      if (isWinner) {
        winnerText.innerText = "You win"
      } else {
        winnerText.innerText = `${this.alivePlayers[0].name} wins`
      }
    }

    // turn off enemy movement
    enemy.setAttribute('attack-pattern', 'scheduleStop: true')
  },
}

// playerSpawnerComponent makes crabs visible when appropiate, sets their position, color, and
// spawns a random fruit underneath them
const playerSpawnerComponent = {
  schema: {
    peerId: {type: 'number', default: 0},
  },

  init() {
    this.el.sceneEl.addEventListener('lobby8-countdowndone', (event) => {
      // Update data and call spawn locally, since update() is only
      // called for entities replicated on other clients
      if (this.el.id === 'my-player') {
        this.data.peerId = event.detail.selfPeerId
        this.spawnEverything()
      }
    })
  },

  // Use update so that we know all components have the right peerId
  update(oldData) {
    // Only act if this is a peerId update (which should only happen once)
    if (this.data.peerId === oldData.peerId || this.data.peerId === 0) {
      return
    }

    this.spawnEverything()
  },

  // Spawns crab and random fruit.
  async spawnEverything() {
    const roomConnection = await getLobbyRoomConnection()
    
    // We sort player Ids so we have deterministic spawn positions
    const sortedPlayerIds = [...roomConnection.peersInRoom].sort()
    this.spawnCrab(this.data.peerId, sortedPlayerIds)
    this.spawnFruit(this.data.peerId, sortedPlayerIds)
  },

  // Spawns the player crab. This is done for all entities holding
  // playerSpawnercomponent because we want to set the initial values locally too
  // this way we don't have to wait for network data to setup the scene
  // Consider this "client prediction"
  // It also makes code simpler as it is the same for all clients.
  spawnCrab(peerId, playersInGame) {
    // Visible property is networked. Let other clients receive this update
    // via networked a-frame
    if (this.el.id === 'my-player') {
      // show client crab (this parameter is synced via NAF, so all crabs should now be visible)
      this.el.setAttribute('visible', true)
    }

    // Set my player's position and color. They are both synced, but we initially
    // set them for all crabs, since we can do so deterministically
    const {x, z} = this.getPlayerSpawnPosition(peerId, playersInGame)
    this.el.setAttribute('position', `${x} 2 ${z}`)
    const myColor = this.getPlayerColor(peerId, playersInGame)
    this.updateEntityColor(this.el, myColor)
  },

  // Spawns the fruit. This is done for all entities holding
  // the playerSpawnercomponent, since it's not networked
  spawnFruit(peerId, playersInGame) {
    // get a random fruit
    const getRandomFruit = (_) => {
      const fruits = ['lemon', 'lime', 'grapefruit']
      return fruits[peerId % fruits.length]
    }

    const {x, z} = this.getPlayerSpawnPosition(peerId, playersInGame)
    // Create and position a citrusEntity at the same position
    const citrusEntity = document.createElement('a-entity')
    citrusEntity.setAttribute('gltf-model', `#${getRandomFruit(peerId)}-model`)
    citrusEntity.setAttribute('scale', '0.4 0.4 0.4')
    citrusEntity.setAttribute('id', `fruit-${this.data.peerId}`)
    citrusEntity.setAttribute('position', `${x} 1.95 ${z}`)
    this.el.sceneEl.appendChild(citrusEntity)
  },

  // Deterministically obtain the player position, based on clientId order
  getPlayerSpawnPosition(peerId, playersInGame) {
    const radius = 1.1  // spawn radius inside pot

    for (let i = 0; i < playersInGame.length; i++) {
      if (peerId === playersInGame[i]) {
        // Calculate the position of this player
        const angle = ((2 * Math.PI) / playersInGame.length) * i
        // Adjust this value to control the size of the inner crab spawn circle
        const radiusFactor = (i % 2 === 0) ? 1.0 : 1.0
        const adjustedRadius = radius * radiusFactor
        const x = Math.cos(angle) * adjustedRadius
        const z = Math.sin(angle) * adjustedRadius
        return {x, z}
      }
    }

    throw Error(`Player not in game: ${peerId}`)
  },

  // Deterministically obtain the player color, based on clientId order
  getPlayerColor(peerId, playersInGame) {
    // Create a color map for assigning colors to player crabs
    const colors = [
      0xFF3B2F, 0xFF9500, 0x35C759, 0x03C7BE, 0x31ADE6,
      0x007AFF, 0x5856D7, 0xAF52DE, 0xFF2C55, 0xA2845E,
    ]

    // handles spawning crabs (sets crab position, crab color, floating fruit type)
    const colorMap = []
    playersInGame.forEach((player, i) => {
      // Assign each clientId a color from the colors array based on their index
      // We can assume that playersInGame has been sorted deterministically
      colorMap[player] = colors[i % colors.length]
    })

    if (colorMap[peerId] === undefined) {
      throw Error('Peer not in room')
    }

    return colorMap[peerId]
  },

  updateEntityColor(entity, color) {
    entity.object3D.traverse((object3D) => {
      const mat = object3D.material
      if (mat && mat.name === 'Main') {
        mat.color.setHex(color)
      }
      if (mat && mat.name === 'Main_Dark') {
        mat.color.setHex(color)
        mat.color.multiplyScalar(0.5)
      }
    })
  },
}

// Gets the player's username (set in the lobby) from lobby event details
// and creates a name tag to attach to each crab
const playerInfoComponent = {
  schema: {
    peerId: {type: 'number', default: 0},
  },

  // True if the entity represents the local player avatar
  isSelfPeer: false,

  init() {
    this.el.sceneEl.addEventListener('lobby8-countdowndone', async (event) => {
      // Set the peer id to self peerId only if this is my own avatar
      // We also update the label here, since update() is only triggered for other players
      if (this.el.id === 'my-player') {
        this.isSelfPeer = true
        this.data.peerId = event.detail.selfPeerId
        this.setLabel(this.data.peerId)
      }
    })
  },

  update(oldData) {
    // Only act if this is a peerId update (which should only happen once)
    if (this.data.peerId === oldData.peerId || this.data.peerId === 0) {
      return
    }

    // Useful to be able to select an entity based on a peer id
    // This will only ever be called by other peer entities
    this.el.id = `other-player-${this.data.peerId}`
    this.setLabel(this.data.peerId)
  },

  async getPlayerName(peerID){
    const connection = await getLobbyRoomConnection()

    return connection.getPlayerName(peerId)
  },

  async setLabel(peerId) {
    const connection = await getLobbyRoomConnection()
    // getPlayerName(peerId: number) is a connection method specific
    // to the LobbyRoomConnection. LobbyRoomConnection will be returned by
    // getLobbyRoomConnection()
    const name = connection.getPlayerName(peerId)

    // Create a unique label for each player
    const label = document.createElement('a-text')
    label.setAttribute('value', name)
    label.setAttribute('position', '0 2.5 0')
    label.setAttribute('scale', '2.5 2.5 2.5')
    label.setAttribute('side', 'double')
    label.setAttribute('align', 'center')
    this.el.appendChild(label)

    if (this.isSelfPeer) {
      label.setAttribute('color', 'green')
    }
  }
}

//---------ADDED BY MAHDI STARTS-----------------//

window.fishList = [];

//Modified catch area component
const catchAreaMultiplayer = {
  schema: {
    circle: {type: 'selector'},  // Selector for the circle entity
    arc: {type: 'selector'},
    fish: {type: 'selector'},    // Selector for the arc entity
    Xmax: {default: 8},          // Maximum X position
    Radius: {default: 1},        // Radius of the circle
  },
  init() {
    const { circle, arc, fish, Xmax, Radius } = this.data;
    let isGyroSupported = false;

    // Initialize circle geometry
    circle.setAttribute('geometry', {
      primitive: 'circle',
      radius: Radius,
    });

    // Define and store event handlers
    this.deviceMotionHandler = (event) => {
      const { alpha, beta, gamma } = event.rotationRate;
      if (alpha || beta || gamma) {
        if (!isGyroSupported) {
          isGyroSupported = true;
          this.el.emit('on-gyroscope-access-granted');
        }
      }
    };

    this.deviceOrientationHandler = (event) => {
      const { gamma, beta, alpha } = event;
      const xmax = (alpha > 180 && alpha < 360) ? ((-2 / 9) * (alpha - 360)) : (-2 / 9) * alpha;
      const x = Math.max(-Xmax, Math.min(Xmax, xmax));

      circle.setAttribute('position', {
        x,
        y: 0.5,
        z: (2 / 5) * beta - 28,
      });

      const catchPosition = circle.getAttribute('position');
      const deltaX = catchPosition.x;
      const deltaZ = catchPosition.z;
      const angle = Math.atan2(deltaZ, deltaX);
      const arcRotationY = angle * (180 / Math.PI);

      arc.setAttribute('rotation', {
        x: 0,
        y: -arcRotationY - 90,
        z: 0,
      });

      const distance = Math.sqrt(deltaX * deltaX + deltaZ * deltaZ);
      const scaleY = distance / 2;
      const scaleZ = distance / 2;
      arc.setAttribute('scale', {
        x: 2.5,
        y: scaleY,
        z: scaleZ,
      });

      fish.setAttribute('position', {
        x: 0,
        y: 0,
        z: -5,
      });
      const fishPosition = fish.getAttribute('position');
      if (
        catchPosition.x >= fishPosition.x - 1 &&
        catchPosition.x <= fishPosition.x + 1 &&
        catchPosition.z <= fishPosition.z + 1 &&
        catchPosition.z >= fishPosition.z - 1
      ) {
        
      }
    };

    // Add event listeners with stored handler references
    window.addEventListener('devicemotion', this.deviceMotionHandler);
    window.addEventListener('deviceorientation', this.deviceOrientationHandler);
  },
  tick() {
    // Runs every frame if needed
  },
  remove() {
    // Properly remove event listeners using stored references
    window.removeEventListener('devicemotion', this.deviceMotionHandler);
    window.removeEventListener('deviceorientation', this.deviceOrientationHandler);
  },
};


function generateRandomPosition(area) {
  return {
    x: (Math.random() - 0.5) * area.x,
    y: 0, // ensuring it spawns above ground
    z: (Math.random() - 0.5) * area.z,
  };
}



/** 
//fish spawner
AFRAME.registerComponent('spawn-fish', {
  schema: {
    model: { type: 'string', default: '#fish-model' },  // ID of the fish model
    spawnRate: { type: 'number', default: 3000 },         // Spawn interval in milliseconds
    maxFish: { type: 'number', default: 10 },             // Maximum number of fish
    area: { type: 'vec3', default: { x: 10, y: 3, z: 10 } },// The area within which fish spawn
    lifetime: { type: 'number', default: 10000 }          // How long a fish lives before despawning
  },

  init() {
    this.fishEntities = []; // Track fish entities spawned by this component

    // Use a bound function for spawning
    this.spawnFishBound = this.spawnFish.bind(this);
    this.interval = setInterval(this.spawnFishBound, this.data.spawnRate);
  },

  spawnFish() {
    // Do not spawn more fish than allowed

    console.log("Fish suuposed to spawn: ")
    if (this.fishEntities.length >= this.data.maxFish){
      console.log("NO SPAWN: max fish count reached")
      return;}

    const scene = this.el.sceneEl;
    const pos = generateRandomPosition(this.data.area); // Pure function call
    const fish = document.createElement('a-entity');
    
    // Assign a unique id to the fish
    fish.id = `fish-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    
    // Set fish attributes
    fish.setAttribute('gltf-model', this.data.model);
    fish.setAttribute('position', `${pos.x} ${pos.y} ${pos.z}`);
    fish.setAttribute('scale', '0.01 0.01 0.01');
    fish.setAttribute('animation', {
      property: 'position',
      to: `${pos.x} ${pos.y} ${pos.z - 5}`,
      dur: 5000,
      loop: true,
      dir: 'alternate'
    });

    // Append fish to the scene and track it
    scene.appendChild(fish);
    this.fishEntities.push(fish);

    // Update global fish list using a pure operation (concatenation)
    window.fishList = window.fishList.concat([{ id: fish.id, position: pos }]);


    console.log("FISH SPAWN")
    // Set up despawn after lifetime expires
    setTimeout(() => {
      if (fish.parentNode) {
        scene.removeChild(fish);
      }
      this.fishEntities = this.fishEntities.filter(f => f !== fish);
      
      // Update global fish list using a pure operation (filter)
      window.fishList = window.fishList.filter(fishData => fishData.id !== fish.id);
    }, this.data.lifetime);
  },

  tick() {
    // Optionally, update the positions of moving fish in the global fish list.
    this.fishEntities.forEach(fish => {
      const pos = fish.getAttribute('position');
      // Update using a pure operation (map) to create a new global fish list
      window.fishList = window.fishList.map(fishData => {
        if (fishData.id === fish.id) {
          return { id: fish.id, position: pos };
        }
        return fishData;
      });
    });
  },

  remove() {
    clearInterval(this.interval);
    this.fishEntities.forEach(fish => {
      if (fish.parentNode) {
        fish.parentNode.removeChild(fish);
      }
    });
    window.fishList = []; // Clear global fish list on removal
  }
});

*/

//---------ADDED BY MAHDI ENDS^^^-----------------//


export {
  catchAreaMultiplayer,
  lobbyHandlerComponent,
  gameStartComponent,
  gameOverComponent,
  playerSpawnerComponent,
  playerInfoComponent,
}
