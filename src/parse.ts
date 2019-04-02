import { parsePath } from './operators/parsePath'
import { getPath } from './getPath';
import { IPathElement, IPath, IAltLayer, IPathSegment } from './types'
import { perimeterPoints } from './operators/perimeterPoints';

/**
 * Parses the path data and returns a model describing it
 * @param d Path Data, A path element, or a selector for a path element
 */
export function parse(d: string | IPathElement): IPath {
    return parsePath(getPath(d))
}

// converts an alt layer to a polymorph path
export function altParse(layer: IAltLayer): IPath {
    const { id, path } = layer;
    const xValues = [];
    const yValues = [];
    const points = [];

    // create each point value
    for (let i = 0, total = path.length; i < total; i++) {
        const command = path[i];
        const isMove = command[0] === 1 /* Alt Path CLOSE command */;

        // check if this is closing
        if (command[0] === 7 /* Alt Path CLOSE command */) {
            break;
        }

        // gather each point
        const x1 = command[1];
        const y1 = command[2];
        const x2 = isNaN(command[3]) ? x1 : command[3];
        const y2 = isNaN(command[4]) ? y1 : command[4];
        const x3 = isNaN(command[5]) ? x1 : command[5];
        const y3 = isNaN(command[6]) ? y1 : command[6];

        // append the points
        if (isMove) {
            points.push(x1, y1);

            // save for checking x/y min/max
            xValues.push(x1);
            yValues.push(y1);
        }
        else {
            points.push(x1, y1, x2, y2, x3, y3);

            // save for checking x/y min/max
            xValues.push(x1, x2, x3);
            yValues.push(y1, y2, y3);
        }

    }

    // create some required values
    let xMin = 0;
    let yMin = 0;
    let xMax = 0;
    let yMax = 0;

    // only perform min/max when points were found
    if (points.length > 0) {
        xMin = Math.min.apply(null, xValues);
        yMin = Math.min.apply(null, yValues);
        xMax = Math.max.apply(null, xValues);
        yMax = Math.max.apply(null, yValues);
    }

    // create the final data
    const data = [{
        d: points,
        x: xMin,
        y: yMin,
        w: xMax - xMin,
        h: yMax - yMin,
        p: perimeterPoints(points)
    }] as IPathSegment[];

    return { path: id, data };
}
