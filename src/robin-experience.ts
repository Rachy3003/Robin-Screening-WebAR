import * as ecs from '@8thwall/ecs'

type ExperienceState = 'ready'

type GestureState = {
  pointerId: number
  startX: number
  startY: number
  lastX: number
  lastY: number
  dragging: boolean
}

type InputListener = (event: any) => void

type ExperienceInstance = {
  tapTarget: bigint
  rotationTarget: bigint
  state: ExperienceState
  gesture?: GestureState
  startListener: InputListener
  moveListener: InputListener
  endListener: InputListener
  rotateListener: InputListener
}

const DRAG_THRESHOLD = 0.018
const ROTATION_RADIANS_PER_SCREEN = 6
const instances = new Map<bigint, ExperienceInstance>()

const findRotationTarget = (world: ecs.World, root: bigint) => {
  const pending = [...world.getChildren(root)]
  while (pending.length) {
    const eid = pending.shift()!
    if (ecs.GltfModel.has(world, eid)) return eid
    pending.push(...world.getChildren(eid))
  }
  return root
}

const makeRobotTouchTarget = (world: ecs.World, parent: bigint) => {
  const tapTarget = world.createEntity()
  world.setParent(tapTarget, parent)
  ecs.Position.set(world, tapTarget, {x: 0, y: 0.92, z: 0.2})
  ecs.Ui.set(world, tapTarget, {
    type: '3d',
    fixedSize: false,
    width: '280',
    height: '410',
    opacity: 0,
    backgroundOpacity: 0,
    text: '',
  })
  return tapTarget
}

const beginGesture = (instance: ExperienceInstance, event: ecs.ScreenTouchStartEvent) => {
  if (instance.state !== 'ready' || event.target !== instance.tapTarget) return
  instance.gesture = {
    pointerId: event.pointerId,
    startX: event.position.x,
    startY: event.position.y,
    lastX: event.position.x,
    lastY: event.position.y,
    dragging: false,
  }
}

const updateGesture = (
  world: ecs.World,
  instance: ExperienceInstance,
  event: ecs.ScreenTouchMoveEvent
) => {
  const gesture = instance.gesture
  if (!gesture || event.pointerId !== gesture.pointerId) return

  const totalX = event.position.x - gesture.startX
  const totalY = event.position.y - gesture.startY
  if (Math.hypot(totalX, totalY) >= DRAG_THRESHOLD) gesture.dragging = true
  if (!gesture.dragging) return

  const deltaX = event.position.x - gesture.lastX
  world.transform.rotateSelf(
    instance.rotationTarget,
    ecs.math.quat.yRadians(deltaX * ROTATION_RADIANS_PER_SCREEN)
  )
  gesture.lastX = event.position.x
  gesture.lastY = event.position.y
}

const endGesture = (instance: ExperienceInstance, event: ecs.ScreenTouchEndEvent) => {
  const gesture = instance.gesture
  if (!gesture || event.pointerId !== gesture.pointerId) return
  if (!gesture.dragging && event.endTarget === instance.tapTarget) {
    window.dispatchEvent(new CustomEvent('robin-open-cards'))
  }
  instance.gesture = undefined
}

ecs.registerComponent({
  name: 'robin-experience',
  add: (world, component) => {
    const tapTarget = makeRobotTouchTarget(world, component.eid)
    const instance = {
      tapTarget,
      rotationTarget: findRotationTarget(world, component.eid),
      state: 'ready',
      startListener: undefined,
      moveListener: undefined,
      endListener: undefined,
      rotateListener: undefined,
    } as unknown as ExperienceInstance

    instance.startListener = event => beginGesture(instance, event.data)
    instance.moveListener = event => updateGesture(world, instance, event.data)
    instance.endListener = event => endGesture(instance, event.data)
    instance.rotateListener = (event: CustomEvent) => {
      const direction = Number(event.detail?.direction || 0)
      world.transform.rotateSelf(
        instance.rotationTarget,
        ecs.math.quat.yRadians(direction * Math.PI / 8)
      )
    }
    instances.set(component.eid, instance)

    world.events.addListener(world.events.globalId, ecs.input.SCREEN_TOUCH_START, instance.startListener)
    world.events.addListener(world.events.globalId, ecs.input.SCREEN_TOUCH_MOVE, instance.moveListener)
    world.events.addListener(world.events.globalId, ecs.input.SCREEN_TOUCH_END, instance.endListener)
    window.addEventListener('robin-rotate', instance.rotateListener)

    const position = ecs.math.vec3.zero()
    world.transform.getLocalPosition(component.eid, position)
    ecs.PositionAnimation.set(world, component.eid, {
      autoFrom: false,
      fromX: position.x,
      fromY: position.y,
      fromZ: position.z,
      toX: position.x,
      toY: position.y + 0.045,
      toZ: position.z,
      duration: 2200,
      loop: true,
      reverse: true,
      easeIn: true,
      easeOut: true,
      easingFunction: 'Sine',
    })
    window.dispatchEvent(new CustomEvent('robin-placed'))
    window.addEventListener('robin-pulse-start', (event: Event) => {
      const bpm = Number((event as CustomEvent).detail?.bpm || 72)
      const duration = Math.max(350, Math.min(1300, 60000 / bpm))
      ecs.ScaleAnimation.set(world, component.eid, {
        autoFrom: true,
        toX: 1.035,
        toY: 1.035,
        toZ: 1.035,
        duration,
        loop: true,
        reverse: true,
        easeIn: true,
        easeOut: true,
        easingFunction: 'Sine',
      })
    }, {once: true})
  },
  remove: (world, component) => {
    const instance = instances.get(component.eid)
    if (!instance) return
    world.events.removeListener(world.events.globalId, ecs.input.SCREEN_TOUCH_START, instance.startListener)
    world.events.removeListener(world.events.globalId, ecs.input.SCREEN_TOUCH_MOVE, instance.moveListener)
    world.events.removeListener(world.events.globalId, ecs.input.SCREEN_TOUCH_END, instance.endListener)
    window.removeEventListener('robin-rotate', instance.rotateListener)
    world.deleteEntity(instance.tapTarget)
    instances.delete(component.eid)
  },
})
