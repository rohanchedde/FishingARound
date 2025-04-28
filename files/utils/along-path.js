// The along-path component is used by attack-pattern to animate the spoon
// Learn more about the component here: https://github.com/protyze/aframe-alongpath-component

const alongPathComponent = {
  schema: {
    enabled: {default: true},
    curve: {default: ''},
    triggers: {default: 'a-curve-point'},
    triggerRadius: {type: 'number', default: 0.01},
    dur: {default: 1000},
    delay: {default: 0},
    loop: {default: false},
    rotate: {default: false},
    resetonplay: {default: true},
    bounce: {default: true},
    easing: {default: 'linear'},
  },

  init() {
    this.initialPosition = this.el.object3D.position
    this.interval = 0
    this.forward = true
  },

  update() {
    this.curve = document.querySelector(this.data.curve)
    this.triggers = this.curve.querySelectorAll(this.data.triggers)
    this.reset()
  },

  tick(time, timeDelta) {
    if (!this.data.enabled) {
      return
    }
    const curve = this.curve.components.curve ? this.curve.components.curve.curve : null

    if (curve) {
      this.updatePosition(timeDelta, curve)
      this.updateRotation(timeDelta, curve)
      this.updateActiveTrigger()
    } else {
      console.error('The entity associated with the curve property has no curve component.')
    }
  },

  play() {
    if (this.data.resetonplay) {
      this.reset()
    }
  },

  remove() {
    this.el.object3D.position.copy(this.initialPosition)
  },

  reset() {
    this.interval = 0
    this.el.removeState('endofpath')
    this.el.removeState('moveonpath')
    this.forward = true  // reset direction

    if (this.activeTrigger) {
      this.activeTrigger.removeState('alongpath-active-trigger')
      this.activeTrigger = null
    }
  },

  getI_(interval, delay, dur) {
    let i = 0

    if (interval - delay >= dur) {
      i = 1
    } else if ((interval - delay < 0)) {
      i = 0
    } else {
      i = (interval - delay) / dur
    }

    // Easing functions based on https://gist.github.com/gre/1650294
    switch (this.data.easing) {
      case 'easeInOut':
        i = i < 0.5 ? 2 * i * i : -1 + (4 - 2 * i) * i
        break
      case 'easeIn':
        i *= i
        break
      case 'easeOut':
        i *= (2 - i)
        break
      case 'linear':
      default:
        break
    }

    return i
  },

  updatePosition(timeDelta, curve) {
    if (!this.el.is('endofpath')) {
      this.interval += this.forward ? timeDelta : -timeDelta
      const i = this.getI_(this.interval, this.data.delay, this.data.dur)

      if (i >= 1) {
        if (this.data.bounce) {
          this.forward = false  // reverse direction
          this.el.emit('switched-direction')
        } else if (this.data.loop) {
          this.el.emit('movingended')
          this.interval = this.data.delay
        } else {
          this.el.setAttribute('position', curve.points[curve.points.length - 1])
          this.el.removeState('moveonpath')
          this.el.addState('endofpath')
          this.el.emit('movingended')
        }
      } else if (i <= 0) {
        if (this.data.bounce) {
          this.forward = true  // reverse direction
          this.el.emit('switched-direction')
        } else if (this.data.loop) {
          this.el.emit('movingended')
          this.interval = this.data.dur
        } else {
          this.el.setAttribute('position', curve.points[0])
          this.el.removeState('moveonpath')
          this.el.addState('endofpath')
          this.el.emit('movingended')
        }
      } else {
        if (!this.el.is('moveonpath')) {
          this.el.addState('moveonpath')
          this.el.emit('movingstarted')
        }
        const p = curve.getPoint(i)
        this.el.setAttribute('position', p)
      }
    }
  },

  updateRotation(timeDelta, curve) {
    if (this.data.rotate === true) {
      const nextInterval = this.interval + (this.forward ? timeDelta : -timeDelta)
      const nextPosition = curve.getPoint(this.getI_(nextInterval, this.data.delay, this.data.dur))
      this.el.object3D.lookAt(nextPosition)
    }
  },

  updateActiveTrigger() {
    if (!this.triggers || this.triggers.length <= 0) return

    for (let i = 0; i < this.triggers.length; i++) {
      if (this.triggers[i].object3D) {
        if (this.triggers[i].object3D.position.distanceTo(this.el.object3D.position) <= this.data.triggerRadius) {
          if (this.activeTrigger && (this.activeTrigger !== this.triggers[i])) {
            this.activeTrigger.removeState('alongpath-active-trigger')
            this.activeTrigger.emit('alongpath-trigger-deactivated')

            this.activeTrigger = this.triggers[i]
            this.activeTrigger.addState('alongpath-active-trigger')
            this.activeTrigger.emit('alongpath-trigger-activated')
          } else if (!this.activeTrigger) {
            this.activeTrigger = this.triggers[i]
            this.activeTrigger.addState('alongpath-active-trigger')
            this.activeTrigger.emit('alongpath-trigger-activated')
          }

          break
        } else if (this.activeTrigger && (this.activeTrigger === this.triggers[i])) {
          this.activeTrigger.removeState('alongpath-active-trigger')
          this.activeTrigger.emit('alongpath-trigger-deactivated')
          this.activeTrigger = null
        }
      }
    }
  },

}

export {alongPathComponent}
