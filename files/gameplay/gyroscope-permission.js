// .js function to Checks and requests permission to use the gyroscope.
// - On iOS devices, the user must give explicit permission to access the gyroscope.
//   Important! This permission must be requested through a direct user action,
//   such as a click, tap, or other explicit interaction. This is required for privacy and security reasons.
// - On other devices, the gyroscope may be available automatically without needing explicit permission.
const requestGyroscopePermission = () => {
  if (typeof DeviceOrientationEvent !== 'undefined') {
    // Check if explicit user permission is needed (iOS)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
      DeviceOrientationEvent.requestPermission()
        .then((permissionStatus) => {
          if (permissionStatus === 'granted') {
            console.log('Gyroscope access granted.')
          } else {
            console.log('Gyroscope access denied by the user.')
          }
        })
        .catch((error) => {
          console.error('Error occurred while requesting gyroscope permission:', error)
        })
    } else {
      console.log('Gyroscope access is supported and does not require explicit permission.')
    }
  } else {
    console.log('Gyroscope is not supported on this device.')
  }
}

export {
  requestGyroscopePermission,
}
