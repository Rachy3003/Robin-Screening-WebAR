import * as ecs from '@8thwall/ecs'
import {OBJECT_PLACED_EVENT, RESET_EVENT} from './tap-to-place'

ecs.registerComponent({
  name: 'hide-on-placed',
  stateMachine: ({world, entity, defineState}) => {
    defineState('visible')
      .initial()
      .onEnter(() => entity.show())
      .onEvent(OBJECT_PLACED_EVENT, 'hidden', {target: world.events.globalId})

    defineState('hidden')
      .onEnter(() => entity.hide())
      .onEvent(RESET_EVENT, 'visible', {target: world.events.globalId})
  },
})
