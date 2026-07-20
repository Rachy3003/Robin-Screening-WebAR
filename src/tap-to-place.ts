import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'
const RESET_EVENT = 'robin-reset'
let placedRobin: bigint | null = null
let placementWorld: ecs.World | null = null

const faceActiveCamera = (world: ecs.World, eid: bigint, position: {x: number, y: number, z: number}) => {
  try {
    const cameraPosition = world.transform.getWorldPosition(world.camera.getActiveEid())
    // Keep Robin upright while using the engine's camera-facing transform. This
    // avoids device-specific yaw differences from manually calculating an angle.
    world.transform.lookAtWorld(eid, {
      x: cameraPosition.x,
      y: position.y,
      z: cameraPosition.z,
    })
  } catch (_) {}
}

window.addEventListener('robin-reposition-request', () => {
  if (!placementWorld) return
  if (placedRobin) {
    placementWorld.deleteEntity(placedRobin)
    placedRobin = null
  }
  placementWorld.events.dispatch(placementWorld.events.globalId, RESET_EVENT)
})

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid'
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    placementWorld = world
    defineState('ready').initial().listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
      if (!e.data.worldPosition) {
        window.dispatchEvent(new CustomEvent('robin-placement-missed'))
        return
      }

      const newEid = world.createEntity(schemaAttribute.get(eid).prefab)
      placedRobin = newEid
      const newEntity = world.getEntity(newEid)
      newEntity.setLocalPosition(e.data.worldPosition)
      faceActiveCamera(world, newEid, e.data.worldPosition)
      world.events.dispatch(world.events.globalId, OBJECT_PLACED_EVENT)
      world.events.dispatch(eid, OBJECT_PLACED_EVENT)
    }).onEvent(OBJECT_PLACED_EVENT, 'placed')

    defineState('placed')
      .onEvent(RESET_EVENT, 'ready', {target: world.events.globalId})
  }
})

export {
  OBJECT_PLACED_EVENT,
  RESET_EVENT,
}
