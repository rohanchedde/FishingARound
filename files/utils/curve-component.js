// The curve and draw-curve components are used by the along-path component for animating the spoon
// Learn more about the component here: https://github.com/protyze/aframe-curve-component

const zAxis = new THREE.Vector3(0, 0, 1)
const {degToRad} = THREE.MathUtils

AFRAME.registerComponent('curve-point', {
  schema: {},
  init() {
    this.el.addEventListener('componentchanged', this.changeHandler.bind(this))
    this.el.emit('curve-point-change')
  },
  changeHandler(event) {
    if (event.detail.name === 'position') {
      this.el.emit('curve-point-change')
    }
  },
})

AFRAME.registerComponent('curve', {
  schema: {
    type: {
      type: 'string',
      default: 'CatmullRom',
      oneOf: ['CatmullRom', 'CubicBezier', 'QuadraticBezier', 'Line'],
    },
    closed: {
      type: 'boolean',
      default: false,
    },
  },
  init() {
    this.pathPoints = null
    this.curve = null
    this.el.addEventListener('curve-point-change', this.update.bind(this))
  },
  update(oldData) {
    this.points = Array.from(this.el.querySelectorAll('a-curve-point, [curve-point]'))
    if (this.points.length <= 1) {
      console.warn('At least 2 curve-points needed to draw a curve')
      this.curve = null
    } else {
      const pointsArray = this.points.map((point) => {
        if (point.x !== undefined && point.y !== undefined && point.z !== undefined) {
          return point
        }
        return point.object3D.position
      })
      if (!AFRAME.utils.deepEqual(pointsArray, this.pathPoints) || (oldData !== 'CustomEvent' && !AFRAME.utils.deepEqual(this.data, oldData))) {
        this.curve = null
        this.pathPoints = pointsArray
        switch (this.data.type) {
          case 'CubicBezier':
            if (this.pathPoints.length !== 4) {
              throw new Error('The Three constructor of type CubicBezierCurve3 requires 4 points')
            }
            this.curve = new THREE.CubicBezierCurve3(this.pathPoints[0], this.pathPoints[1], this.pathPoints[2], this.pathPoints[3])
            break
          case 'QuadraticBezier':
            if (this.pathPoints.length !== 3) {
              throw new Error('The Three constructor of type QuadraticBezierCurve3 requires 3 points')
            }
            this.curve = new THREE.QuadraticBezierCurve3(this.pathPoints[0], this.pathPoints[1], this.pathPoints[2])
            break
          case 'Line':
            if (this.pathPoints.length !== 2) {
              throw new Error('The Three constructor of type LineCurve3 requires 2 points')
            }
            this.curve = new THREE.LineCurve3(this.pathPoints[0], this.pathPoints[1])
            break
          case 'CatmullRom':
            this.curve = new THREE.CatmullRomCurve3(this.pathPoints)
            break
          case 'Spline':
            this.curve = new THREE.SplineCurve3(this.pathPoints)
            break
          default:
            throw new Error(`No Three constructor of type (case sensitive): ${this.data.type}Curve3`)
        }
        this.curve.closed = this.data.closed
        this.el.emit('curve-updated')
      }
    }
  },
  remove() {
    this.el.removeEventListener('curve-point-change', this.update.bind(this))
  },
  closestPointInLocalSpace(point, resolution, testPoint, currentRes) {
    if (!this.curve) throw Error('Curve not instantiated yet.')
    resolution = resolution || 0.1 / this.curve.getLength()
    currentRes = currentRes || 0.5
    testPoint = testPoint || 0.5
    currentRes /= 2
    const aTest = testPoint + currentRes
    const bTest = testPoint - currentRes
    const a = this.curve.getPointAt(aTest)
    const b = this.curve.getPointAt(bTest)
    const aDistance = a.distanceTo(point)
    const bDistance = b.distanceTo(point)
    const aSmaller = aDistance < bDistance
    if (currentRes < resolution) {
      const tangent = this.curve.getTangentAt(aSmaller ? aTest : bTest)
      if (currentRes < resolution) {
        return {
          result: aSmaller ? aTest : bTest,
          location: aSmaller ? a : b,
          distance: aSmaller ? aDistance : bDistance,
          normal: normalFromTangent(tangent),
          tangent,
        }
      }
    }
    if (aDistance < bDistance) {
      return this.closestPointInLocalSpace(point, resolution, aTest, currentRes)
    } else {
      return this.closestPointInLocalSpace(point, resolution, bTest, currentRes)
    }
  },
})

const tempQuaternion = new THREE.Quaternion()

function normalFromTangent(tangent) {
  const lineEnd = new THREE.Vector3(0, 1, 0)
  tempQuaternion.setFromUnitVectors(zAxis, tangent)
  lineEnd.applyQuaternion(tempQuaternion)
  return lineEnd
}

AFRAME.registerShader('line', {
  schema: {
    color: {default: '#ff0000'},
  },
  init(data) {
    this.material = new THREE.LineBasicMaterial(data)
  },
  update(data) {
    this.material = new THREE.LineBasicMaterial(data)
  },
})

AFRAME.registerComponent('draw-curve', {
  schema: {
    curve: {type: 'selector'},
  },
  init() {
    this.data.curve.addEventListener('curve-updated', this.update.bind(this))
  },
  update() {
    if (this.data.curve) {
      this.curve = this.data.curve.components.curve
    }
    if (this.curve && this.curve.curve) {
      const lineGeometry = new THREE.BufferGeometry().setFromPoints(this.curve.curve.getPoints(this.curve.curve.getPoints().length * 10))
      const mesh = this.el.getOrCreateObject3D('mesh', THREE.Line)
      const lineMaterial = mesh.material ? mesh.material : new THREE.LineBasicMaterial({color: '#ff0000'})
      this.el.setObject3D('mesh', new THREE.Line(lineGeometry, lineMaterial))
    }
  },
  remove() {
    this.data.curve.removeEventListener('curve-updated', this.update.bind(this))
    this.el.getObject3D('mesh').geometry = new THREE.BufferGeometry()
  },
})

AFRAME.registerPrimitive('a-draw-curve', {
  defaultComponents: {
    'draw-curve': {},
  },
  mappings: {
    curveref: 'draw-curve.curve',
  },
})

AFRAME.registerPrimitive('a-curve-point', {
  defaultComponents: {
    'curve-point': {},
  },
  mappings: {},
})

AFRAME.registerPrimitive('a-curve', {
  defaultComponents: {
    'curve': {},
  },
  mappings: {
    type: 'curve.type',
  },
})
