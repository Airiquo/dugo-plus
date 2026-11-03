import { BLOOD_TYPES, COMPONENTS } from './matching.js'

/** Component/group stock identity; legacy group-only rows have no component. */
export function inventoryKey(component, bloodType) {
  return COMPONENTS.includes(component) && BLOOD_TYPES.includes(bloodType)
    ? `${component}_${bloodType}` : null
}
