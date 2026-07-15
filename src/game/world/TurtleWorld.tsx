import { ShellTerrain } from './shell/ShellTerrain'
import { BiolumSeams } from './shell/BiolumSeams'
import { SkyDome, Stars } from './sky/SkyDome'
import { Aurora } from './sky/Aurora'
import { Clouds } from './sky/Clouds'
import { TimeLighting } from './sky/TimeLighting'
import { Ocean } from './ocean/Ocean'
import { Turtle } from './turtle/Turtle'
import { Landmarks } from './landmarks/Landmarks'
import { Village } from '../village/Village'
import { Vegetation } from '../village/Vegetation'
import { CrownwoodForest } from '../village/forest/CrownwoodForest'
import { Rain } from '../weather/Rain'
import { AtmosphereDetails } from '../weather/AtmosphereDetails'
import { InteractionSystem } from '../interaction/InteractionSystem'
import { WorldSystems } from './WorldSystems'
import { SpatialCellProvider } from './spatial/SpatialCellProvider'
import { WildlifeWorld } from './wildlife/WildlifeWorld'
import { BiomeMosaic } from './biomes/BiomeMosaic'

/** Root of everything outside the player: sky, sea, shell, turtle, village. */
export function TurtleWorld() {
  return (
    <SpatialCellProvider>
      <TimeLighting />
      <SkyDome />
      <Stars />
      <Aurora />
      <Clouds />
      <Ocean />
      <ShellTerrain />
      <BiolumSeams />
      <Turtle />
      <Landmarks />
      <WildlifeWorld />
      <Village />
      <CrownwoodForest />
      <BiomeMosaic />
      <Vegetation />
      <Rain />
      <AtmosphereDetails />
      <InteractionSystem />
      <WorldSystems />
    </SpatialCellProvider>
  )
}
