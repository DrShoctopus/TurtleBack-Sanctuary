import type { InputDevice } from '../state/gameStore'

/** Key/button glyph for a prompt action, per active device. */
export function actionGlyph(action: 'interact' | 'stand' | 'exit' | 'back' | 'menu', device: InputDevice): string {
  if (device === 'pad') {
    switch (action) {
      case 'interact':
        return 'Ⓐ'
      case 'stand':
        return 'Ⓑ'
      case 'exit':
        return 'Ⓑ'
      case 'back':
        return 'Ⓑ'
      case 'menu':
        return 'Ⓨ'
    }
  }
  switch (action) {
    case 'interact':
      return 'E'
    case 'stand':
      return 'E'
    case 'exit':
      return 'Esc'
    case 'back':
      return 'Esc'
    case 'menu':
      return 'M'
  }
}
