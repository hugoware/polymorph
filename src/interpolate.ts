import { interpolatePath } from './operators/interpolatePath'
import { parse, altParse } from './parse'
import { IAltLayer, IPathElement, InterpolateOptions } from './types'

/**
 * Returns a function to interpolate between the two path shapes.
 * @param left path data, CSS selector, or path element
 * @param right path data, CSS selector, or path element
 */
export function interpolate(paths: (string | IPathElement)[], options?: InterpolateOptions): (offset: number) => string {
  return interpolatePath(paths.map(parse), options || {})
}

// interpolates two alternate layers
export function altInterpolate(left: IAltLayer, right: IAltLayer, options: InterpolateOptions = { }): (offset: number) => string {
  options.renderAsAltLayer = true;
  const a = altParse(left);
  const b = altParse(right);
  return interpolatePath([a, b], options)
}
