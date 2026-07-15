import { cylGeo, type BuildPlan } from '../kit/geometry'
import * as props from '../kit/props'
import { VILLAGE_STORY_CLUSTERS, validateVillageDressing, type VillageStoryCluster } from './layout'

export interface VillageStoryBuildStats {
  readonly clusters: number
  readonly districts: number
  readonly propFamilies: number
}

function offset(
  cluster: VillageStoryCluster,
  along: number,
  across: number,
): readonly [number, number] {
  const cos = Math.cos(cluster.yaw)
  const sin = Math.sin(cluster.yaw)
  return [cluster.x + along * cos + across * sin, cluster.z - along * sin + across * cos]
}

function mountWindChime(plan: BuildPlan, cluster: VillageStoryCluster, y0: number): void {
  const [postX, postZ] = offset(cluster, -0.75, 0)
  plan.box('woodDark', {
    pos: [postX, y0 + 1.45, postZ],
    size: [0.14, 2.9, 0.14],
    rot: [0, cluster.yaw, 0],
  })
  const [armX, armZ] = offset(cluster, -0.15, 0)
  plan.box('woodDark', {
    pos: [armX, y0 + 2.72, armZ],
    size: [1.25, 0.1, 0.1],
    rot: [0, cluster.yaw, 0],
  })
  const [chimeX, chimeZ] = offset(cluster, 0.35, 0)
  props.windChime(plan, chimeX, y0 + 2.58, chimeZ)
  plan.collider({ pos: [postX, y0 + 1.3, postZ], size: [0.24, 2.6, 0.24] })
}

function buildSurveyInstrument(plan: BuildPlan, cluster: VillageStoryCluster, y0: number): void {
  const [x, z] = offset(cluster, 0.72, -0.12)
  for (let index = 0; index < 3; index++) {
    const angle = cluster.yaw + (index / 3) * Math.PI * 2
    plan.box('woodDark', {
      pos: [x + Math.cos(angle) * 0.22, y0 + 0.58, z + Math.sin(angle) * 0.22],
      size: [0.07, 1.22, 0.07],
      rot: [0, angle, (index - 1) * 0.09],
    })
  }
  plan.add(cylGeo(16), 'metalBrushed', {
    pos: [x, y0 + 1.22, z],
    size: [0.72, 0.24, 0.28],
    rot: [Math.PI / 2 - 0.18, cluster.yaw, Math.PI / 2],
  })
  const [lensX, lensZ] = offset(cluster, 1.1, -0.12)
  plan.add(cylGeo(16), 'glass', {
    pos: [lensX, y0 + 1.34, lensZ],
    size: [0.24, 0.06, 0.24],
    rot: [0, 0, Math.PI / 2],
  })
}

function buildCluster(plan: BuildPlan, cluster: VillageStoryCluster, y0: number): void {
  const [leftX, leftZ] = offset(cluster, -1.1, 0.45)
  const [rightX, rightZ] = offset(cluster, 1.0, -0.35)
  props.contactPatch(plan, cluster.x, cluster.z, cluster.yaw, y0, Math.max(0.9, cluster.radius / 2))

  switch (cluster.kind) {
    case 'welcome-board':
      props.iconSignpost(
        plan,
        cluster.x,
        cluster.z,
        cluster.yaw,
        y0,
        cluster.district === 'market' ? 'fabricRust' : 'fabricTeal',
      )
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 31)
      break
    case 'fountain-care':
      props.toolRack(plan, leftX, leftZ, cluster.yaw, y0)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 32)
      props.stonePathEdge(plan, cluster.x, cluster.z, cluster.yaw, y0, 3.2)
      break
    case 'commons-gathering':
      props.workBench(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.lanternStand(plan, leftX, leftZ, cluster.yaw, y0, 2)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 33)
      break
    case 'produce-stall':
      props.marketCanopy(plan, cluster.x, cluster.z, cluster.yaw, y0, 'fabricRust')
      props.crateStack(plan, leftX, leftZ, cluster.yaw + 0.15, y0, 34)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 35)
      break
    case 'delivery-cart':
      props.handcart(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.crateStack(plan, leftX, leftZ, cluster.yaw - 0.2, y0, 36)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 37)
      break
    case 'tea-drying':
      props.dryingLine(plan, cluster.x, cluster.z, cluster.yaw, y0, ['fabricSand', 'fabricRust'])
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 38)
      break
    case 'potting-bench':
      props.workBench(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.toolRack(plan, leftX, leftZ, cluster.yaw + Math.PI / 2, y0)
      props.crateStack(plan, rightX, rightZ, cluster.yaw, y0, 39)
      break
    case 'seed-cache':
      props.crateStack(plan, leftX, leftZ, cluster.yaw, y0, 40)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 41)
      props.planterBox(plan, cluster.x, cluster.z, cluster.yaw, 1.8, y0)
      break
    case 'garden-shrine':
    case 'star-shrine':
      props.shrineGarden(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.lanternStand(
        plan,
        rightX,
        rightZ,
        cluster.yaw,
        y0,
        cluster.kind === 'star-shrine' ? 3 : 2,
      )
      break
    case 'laundry-line':
      props.dryingLine(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 42)
      break
    case 'firewood-rack':
      props.firewoodRack(plan, cluster.x, cluster.z, cluster.yaw, y0, 43)
      props.toolRack(plan, rightX, rightZ, cluster.yaw + Math.PI / 2, y0)
      break
    case 'reading-nook':
      props.iconSignpost(plan, leftX, leftZ, cluster.yaw, y0, 'fabricSand')
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 44)
      props.lanternStand(plan, cluster.x, cluster.z, cluster.yaw, y0, 2)
      break
    case 'sculptor-yard':
      props.workBench(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.toolRack(plan, leftX, leftZ, cluster.yaw + Math.PI / 2, y0)
      props.outdoorSculpture(plan, rightX, rightZ, cluster.yaw, y0, 'paint.coral', 45)
      break
    case 'gallery-install':
      props.handcart(plan, leftX, leftZ, cluster.yaw, y0)
      props.crateStack(plan, rightX, rightZ, cluster.yaw + 0.2, y0, 46)
      break
    case 'chime-garden':
      mountWindChime(plan, cluster, y0)
      props.planterBox(plan, rightX, rightZ, cluster.yaw, 1.45, y0)
      props.basketCluster(plan, leftX, leftZ, cluster.yaw, y0, 47)
      break
    case 'herb-drying':
      props.dryingLine(plan, cluster.x, cluster.z, cluster.yaw, y0, ['fabricTeal', 'fabricSand'])
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 48)
      props.planterBox(plan, leftX, leftZ, cluster.yaw, 1.4, y0)
      break
    case 'bath-baskets':
      props.basketCluster(plan, cluster.x, cluster.z, cluster.yaw, y0, 49)
      props.towelStack(plan, leftX, y0 + 0.05, leftZ)
      props.lanternStand(plan, rightX, rightZ, cluster.yaw, y0, 2)
      break
    case 'tea-cart':
      props.handcart(plan, cluster.x, cluster.z, cluster.yaw, y0)
      props.kettleSet(plan, leftX, y0 + 0.83, leftZ)
      props.basketCluster(plan, rightX, rightZ, cluster.yaw, y0, 50)
      break
    case 'survey-cart':
      props.handcart(plan, leftX, leftZ, cluster.yaw, y0)
      props.toolRack(plan, rightX, rightZ, cluster.yaw + Math.PI / 2, y0)
      buildSurveyInstrument(plan, cluster, y0)
      break
    case 'lantern-watch':
      props.lanternStand(plan, cluster.x, cluster.z, cluster.yaw, y0, 4)
      props.stonePathEdge(plan, cluster.x, cluster.z, cluster.yaw, y0, 3.4)
      break
  }
}

export function buildVillageStoryClusters(
  plan: BuildPlan,
  heightAt: (x: number, z: number) => number,
): VillageStoryBuildStats {
  const validation = validateVillageDressing()
  if (!validation.valid)
    throw new Error(`Invalid village dressing:\n${validation.errors.join('\n')}`)
  for (const cluster of VILLAGE_STORY_CLUSTERS) {
    buildCluster(plan, cluster, heightAt(cluster.x, cluster.z))
  }
  return Object.freeze({
    clusters: VILLAGE_STORY_CLUSTERS.length,
    districts: new Set(VILLAGE_STORY_CLUSTERS.map((cluster) => cluster.district)).size,
    propFamilies: new Set(VILLAGE_STORY_CLUSTERS.map((cluster) => cluster.kind)).size,
  })
}
