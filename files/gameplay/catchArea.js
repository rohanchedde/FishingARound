import {getLobbyRoomConnection} from 'shared-ar'
import {selfPeerID, isHost, sortedPlayerIds, sortedPlayerNames} from '../components/multiplayer'
window.score = 0

let leaderboard = []

export const catchAreaComponent = {
  schema: {
    circle: {type: 'selector'},
    arc: {type: 'selector'},
    Xmax: {default: 8},
    Radius: {default: 1},
    enemySelector: {type: 'string', default: '[enemy]'},
  },

  init() {
    this.roomConnection = null
    this.gameScore = document.getElementById('gameScore')
    this.circle = this.data.circle
    this.arc = this.data.arc
    this.isGyroSupported = false

    // Initialize circle geometry
    this.circle.setAttribute('geometry', {
      primitive: 'circle',
      radius: this.data.Radius,
    })

    // Set material with opacity
    this.circle.setAttribute('material', {
      color: '#ff0000',   // Optional: Set color
      opacity: 0.75,      // Adjust opacity (0 = fully transparent, 1 = fully opaque)
      transparent: true,  // Ensure transparency is enabled
    })

    // Set up room connection
    this.el.sceneEl.addEventListener('lobby8-roomJoined', (event) => {
      this.roomConnection = event.detail.roomConnection
      this.selfPeerID = event.detail.selfPeerId

      this.roomConnection.registerOnPeerMessage((msg) => {
        if (msg.tag === 40) {
          this.handleReceivedPosition(msg.data.circlePosition, msg.data.peerID)
        }

        if (msg.tag === 41) {
          if (msg.data.playerCatcherID === selfPeerID) {
            console.log('you caught a networked fish')
            this.updateScore()
          } else {
            console.log('ypur peer didnt catch')
            console.log(`msgID: ${msg.data.catcherID}, selfPeerID ${selfPeerID}`)
          }
        }

        if (msg.tag === 101) {
          console.log('recevied end game message from host, sending score')
          this.handleEndGame()
        }

        if (msg.tag === 102 && isHost) {
          console.log('score from peer recieved:')
          console.log(`player: ${this.getNameByPeerId(msg.data.peerID)} | score: ${msg.data.score}`)
          this.updateLeaderScore(this.getNameByPeerId(selfPeerID), window.score)

          this.updateLeaderScore(this.getNameByPeerId(msg.data.peerID), msg.data.score)
          this.printSortedLeaderboard()

          console.log('Sending own score...')

          this.roomConnection.sendMessage({
            tag: 102,
            data: {
              peerID: selfPeerID,
              score: window.score,
            },

          })

          if (!this.leaderboardTimeoutStarted) {
            this.leaderboardTimeoutStarted = true
            setTimeout(() => {
              console.log('Finalizing leaderboard after timeout')
              this.printSortedLeaderboard()

              this.roomConnection.sendMessage({
                tag: 300,
                data: {
                  finalLeaderboard: leaderboard,
                },
              })

              this.handleReplay()
            }, 3000)
          }
        }

        if (msg.tag === 102 && !isHost) {
          console.log('score received:')
          console.log(`player: ${this.getNameByPeerId(msg.data.peerID)} | score: ${msg.data.score}`)
          this.updateLeaderScore(this.getNameByPeerId(selfPeerID), window.score)

          this.updateLeaderScore(this.getNameByPeerId(msg.data.peerID), msg.data.score)
          this.printSortedLeaderboard()
        }

        if (msg.tag === 103) {
          console.log(`player: ${this.getNameByPeerId(msg.data.peerID)} | score: ${msg.data.score}`)
        }

        if (msg.tag === 300) {
          leaderboard = msg.data.finalLeaderboard
          console.log('final score received, printing leaderboard...')
          this.printSortedLeaderboard()

          this.handleReplay()
        }
      })
    })

    // Event handlers
    this.deviceMotionHandler = (event) => {
      if (event.rotationRate?.alpha || event.rotationRate?.beta || event.rotationRate?.gamma) {
        this.isGyroSupported = true
        this.el.emit('on-gyroscope-access-granted')
      }
    }

    this.deviceOrientationHandler = (event) => {
      if (!this.isGyroSupported) return

      const {alpha} = event  // Compass direction (0-360)
      const {beta} = event   // Front/back tilt (-180 to 180)
      const {gamma} = event  // Left/right tilt (-90 to 90)

      // Calculate circle position based on device orientation
      const xPosition = this.calculateXPosition(alpha)
      const zPosition = this.calculateZPosition(beta)

      this.updateCirclePosition(xPosition, zPosition)
      this.updateArcVisuals(xPosition, zPosition)
    }

    // Click/tap handler
    this.clickHandler = (event) => {
      event.preventDefault()
      this.handleCatchAttempt()
    }

    // Set up event listeners
    window.addEventListener('devicemotion', this.deviceMotionHandler)
    window.addEventListener('deviceorientation', this.deviceOrientationHandler)
    document.getElementById('clickButton').addEventListener('touchstart', this.clickHandler)
    document.getElementById('clickButton').addEventListener('click', this.clickHandler)
  },

  calculateXPosition(alpha) {
    return Math.max(-this.data.Xmax, Math.min(this.data.Xmax,
      (alpha > 180 && alpha < 360)
        ? ((-2 / 9) * (alpha - 360))
        : (-2 / 9) * alpha))
  },

  calculateZPosition(beta) {
    return (2 / 5) * beta - 28
  },

  updateCirclePosition(x, z) {
    this.circle.setAttribute('position', {x, y: 0.5, z})
  },

  updateArcVisuals(x, z) {
    const angle = Math.atan2(z, x) * (180 / Math.PI)
    this.arc.setAttribute('rotation', {x: 0, y: -angle - 90, z: 0})

    const distance = Math.sqrt(x * x + z * z)
    this.arc.setAttribute('scale', {x: 2.5, y: distance / 2, z: distance / 2})
  },

  updateLeaderScore(name, scoreDelta, override = true) {
    const player = leaderboard.find(p => p.name === name)

    if (player) {
      player.score = override ? scoreDelta : player.score + scoreDelta
    } else {
      leaderboard.push({name, score: scoreDelta})
    }
  },

  getSortedLeaderboard() {
    return [...leaderboard].sort((a, b) => b.score - a.score)
  },

  printSortedLeaderboard() {
    const sorted = this.getSortedLeaderboard()
    console.log('🏆 Leaderboard:')
    sorted.forEach((player, index) => {
      console.log(`${index + 1}. ${player.name} — ${player.score}`)
    })
  },

  getNameByPeerId(targetPeerId) {
    const index = sortedPlayerIds.indexOf(targetPeerId)
    return index !== -1 ? sortedPlayerNames[index] : null
  },

  handleReplay() {
    console.log('handle replay entered')

    // ----- Unload game components & hide gameplay UI -----

    // Remove catch area elements (circle and arc)
    const circleEl = document.getElementById('circle')
    if (circleEl && circleEl.parentNode) {
      circleEl.parentNode.removeChild(circleEl)
    }
    const arcEl = document.getElementById('arc')
    if (arcEl && arcEl.parentNode) {
      arcEl.parentNode.removeChild(arcEl)
    }

    // Hide catch button container and score container
    const clickButtonContainer = document.getElementById('clickButton-container')
    if (clickButtonContainer) {
      clickButtonContainer.style.display = 'none'
    }
    const scoreContainer = document.getElementById('score-container')
    if (scoreContainer) {
      scoreContainer.style.display = 'none'
    }

    // Remove event listeners for game controls
    window.removeEventListener('devicemotion', this.deviceMotionHandler)
    window.removeEventListener('deviceorientation', this.deviceOrientationHandler)
    const clickButton = document.getElementById('clickButton')
    if (clickButton) {
      clickButton.removeEventListener('touchstart', this.clickHandler)
      clickButton.removeEventListener('click', this.clickHandler)
    }

    // ----- Display the Final Leaderboard -----

    // Get the leaderboard container and clear its content
    const leaderboardContainer = document.getElementById('leaderboard-container')
    leaderboardContainer.innerHTML = '<h2>Final Leaderboard</h2>'

    // Sort the leaderboard so that the highest score comes first
    leaderboard.sort((a, b) => b.score - a.score)

    // Create and append leaderboard entries
    leaderboard.forEach((player, index) => {
      const entry = document.createElement('p')
      entry.textContent = `${index + 1}. ${player.name} — ${player.score}`
      leaderboardContainer.appendChild(entry)
    })

    // Ensure the leaderboard container is visible
    leaderboardContainer.style.display = 'block'
    leaderboardContainer.style.zIndex = 1000

    // ----- Show Play Again Button After Delay -----

    setTimeout(() => {
      const playAgainBtn = document.getElementById('play-again-btn')
      playAgainBtn.classList.remove('hidden')
      playAgainBtn.style.display = 'block'
      playAgainBtn.style.zIndex = 1001
      playAgainBtn.addEventListener('click', () => {
        window.location.reload()
      })
    }, 2000)
  },

  handleEndGame() {
    this.roomConnection.sendMessage({

      tag: 102,
      data: {
        peerID: selfPeerID,
        score: window.score,
      },

    })
  },

  // this functions handles the incoming catch requests
  handleReceivedPosition(position, catcherID) {
    console.log(`Catch attempt at x:${position.x}, z:${position.z} `)
    const catcherIDvar = catcherID
    console.log(`by ${catcherIDvar}`)

    if (window.fishList?.length) {
      window.fishList.forEach((fishData, index) => {
        if (this.isFishInCatchArea(fishData.position, position)) {
          this.removeFish(fishData.id, index)
          // sends ack of fish caught
          this.roomConnection.sendMessage({

            tag: 41,
            data: {playerCatcherID: catcherIDvar},

          })
        }
      })
    }
  },

  handleCatchAttempt() {
    if (!this.roomConnection) {
      console.error('Not connected to room')
      return
    }

    // Get current position
    const catchPosition = this.circle.getAttribute('position')

    // Send position to other players along with peerID of the sender
    this.roomConnection.sendMessage({
      tag: 40,
      data: {
        circlePosition: catchPosition,
        peerID: selfPeerID,
      },
    })

    // Check for fish collisions
    if (window.fishList?.length) {
      window.fishList.forEach((fishData, index) => {
        if (this.isFishInCatchArea(fishData.position, catchPosition)) {
          this.removeFish(fishData.id, index)
          this.updateScore()
        }
      })
    }
  },

  isFishInCatchArea(fishPos, catchPos) {
    return Math.abs(fishPos.x - catchPos.x) <= 1 &&
           Math.abs(fishPos.z - catchPos.z) <= 1
  },

  removeFish(fishId, index) {
    const fishEl = document.getElementById(fishId)
    if (fishEl) fishEl.parentNode?.removeChild(fishEl)
    window.fishList.splice(index, 1)
  },

  updateScore() {
    window.score++
    this.gameScore.innerText = `Score: ${window.score}`
    // Add pop animation
    this.gameScore.classList.add('score-pop')
    // Remove animation after 300ms
    setTimeout(() => {
      this.gameScore.classList.remove('score-pop')
    }, 300)
  },

  tick() {

  },

  remove() {
    // Cleanup event listeners
    window.removeEventListener('devicemotion', this.deviceMotionHandler)
    window.removeEventListener('deviceorientation', this.deviceOrientationHandler)

    const clickButton = document.getElementById('clickButton')
    clickButton.removeEventListener('touchstart', this.clickHandler)
    clickButton.removeEventListener('click', this.clickHandler)

    // Reset connection
    this.roomConnection = null
  },
}

export const timerDoneComponent = {

  async init() {
    const roomConnection = await getLobbyRoomConnection()
    this.el.sceneEl.addEventListener('time-done', async (event) => {
      console.log('EMITTED TIMER DONE WOO')
    })
  },

}
