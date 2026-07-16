import * as ecs from '@8thwall/ecs'

const OBJECT_PLACED_EVENT = 'object-placed'
const RESET_EVENT = 'robin-reset'

ecs.registerComponent({
  name: 'tap-to-place',
  schema: {
    prefab: 'eid'
  },
  stateMachine: ({world, eid, schemaAttribute, defineState}) => {
    defineState('ready').initial().listen(eid, ecs.input.SCREEN_TOUCH_START, (e) => {
      if (!e.data.worldPosition) return

      const newEid = world.createEntity(schemaAttribute.get(eid).prefab)
      const newEntity = world.getEntity(newEid)
      newEntity.setLocalPosition(e.data.worldPosition)
      newEntity.set(ecs.Quaternion, ecs.math.quat.yRadians(0))
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
