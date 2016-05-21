import * as macro from '../../../macro';
import vtkBufferObject from '../BufferObject';
import { DynamicTypedArray } from '../../../Common/Core/DynamicTypedArray';
import { OBJECT_TYPE } from '../BufferObject/Constants';
import { REPRESENTATIONS } from '../../Core/Property/Constants';


// ----------------------------------------------------------------------------
// vtkOpenGLCellArrayBufferObject methods
// ----------------------------------------------------------------------------

function vtkOpenGLCellArrayBufferObject(publicAPI, model) {
  // Set our className
  model.classHierarchy.push('vtkOpenGLCellArrayBufferObject');

  const packedVBO = new DynamicTypedArray({ chunkSize: 65500, arrayType: 'Float32Array' }); // the data

  publicAPI.setType(OBJECT_TYPE.ARRAY_BUFFER);

  publicAPI.createVBO = (cellArray, inRep, outRep, points, normals, tcoords, colors) => {
    if (!cellArray.getData() || !cellArray.getData().length) {
      model.elementCount = 0;
      return;
    }

    // Figure out how big each block will be, currently 6 or 7 floats.
    model.blockSize = 3;
    model.vertexOffset = 0;
    model.normalOffset = 0;
    model.tCoordOffset = 0;
    model.tCoordComponents = 0;
    model.colorComponents = 0;
    model.colorOffset = 0;

    const pointData = points.getData();
    let normalData = null;
    let tcoordData = null;
    let colorData = null;

    const colorComponents = (colors ? colors.getNumberOfComponents() : 0);
    const textureComponents = (tcoords ? tcoords.getNumberOfComponents() : 0);

    if (normals !== null) {
      model.normalOffset = /* sizeof(float) */ 4 * model.blockSize;
      model.blockSize += 3;
      normalData = normals.getData();
    }

    if (tcoords !== null) {
      model.tCoordOffset = /* sizeof(float) */ 4 * model.blockSize;
      model.tCoordComponents = textureComponents;
      model.blockSize += textureComponents;
      tcoordData = tcoords.getData();
    }

    if (colors !== null) {
      model.colorComponents = colors.getNumberOfComponents();
      model.colorOffset = /* sizeof(float) */ 4 * model.blockSize;
      model.blockSize += 1;
      colorData = colors.getData();
    }
    model.stride = /* sizeof(float) */ 4 * model.blockSize;

    let pointIdx = 0;
    let normalIdx = 0;
    let tcoordIdx = 0;
    let colorIdx = 0;

    const colorHolder = new Uint8Array(4);

    const addAPoint = function addAPoint(i) {
      // Vertices
      pointIdx = i * 3;
      normalIdx = i * 3;
      tcoordIdx = i * textureComponents;
      colorIdx = i * colorComponents;

      packedVBO.push(pointData[pointIdx++]);
      packedVBO.push(pointData[pointIdx++]);
      packedVBO.push(pointData[pointIdx++]);

      if (normalData !== null) {
        packedVBO.push(normalData[normalIdx++]);
        packedVBO.push(normalData[normalIdx++]);
        packedVBO.push(normalData[normalIdx++]);
      }

      if (tcoordData !== null) {
        for (let j = 0; j < textureComponents; ++j) {
          packedVBO.push(tcoordData[tcoordIdx++]);
        }
      }

      if (colorData !== null) {
        colorHolder[0] = colorData[colorIdx++];
        colorHolder[1] = colorData[colorIdx++];
        colorHolder[2] = colorData[colorIdx++];

        if (colorComponents === 4) {
          colorHolder[3] = colorData[colorIdx++];
        } else {  // must be 3 color components then
          colorHolder[3] = 255;
        }

        packedVBO.push(new Float32Array(colorHolder.buffer)[0]);
      }
    };

    const cellBuilders = {
      // easy, every input point becomes an output point
      anythingToPoints(numPoints, cellPts, offset) {
        for (let i = 0; i < numPoints; ++i) {
          addAPoint(cellPts[offset + i]);
        }
      },
      linesToWireframe(numPoints, cellPts, offset) {
        // for lines we add a bunch of segments
        for (let i = 0; i < numPoints - 1; ++i) {
          addAPoint(cellPts[offset + i]);
          addAPoint(cellPts[offset + i + 1]);
        }
      },
      polysToWireframe(numPoints, cellPts, offset) {
        // for polys we add a bunch of segments and close it
        for (let i = 0; i < numPoints; ++i) {
          addAPoint(cellPts[offset + i]);
          addAPoint(cellPts[offset + (i + 1) % numPoints]);
        }
      },
      stripsToWireframe(numPoints, cellPts, offset) {
        // for strips we add a bunch of segments and close it
        for (let i = 0; i < numPoints - 1; ++i) {
          addAPoint(cellPts[offset + i]);
          addAPoint(cellPts[offset + i + 1]);
        }
        for (let i = 0; i < numPoints - 2; i++) {
          addAPoint(cellPts[offset + i]);
          addAPoint(cellPts[offset + i + 2]);
        }
      },
      polysToSurface(npts, cellPts, offset) {
        if (npts < 3) {
          // ignore degenerate triangles
          console.log('skipping degenerate triangle');
        } else {
          for (let i = 0; i < npts - 2; i++) {
            addAPoint(cellPts[offset + 0]);
            addAPoint(cellPts[offset + i + 1]);
            addAPoint(cellPts[offset + i + 2]);
          }
        }
      },
      stripsToSurface(npts, cellPts, offset) {
        for (let i = 0; i < npts - 2; i++) {
          addAPoint(cellPts[offset + i]);
          addAPoint(cellPts[offset + i + 1 + i % 2]);
          addAPoint(cellPts[offset + i + 1 + (i + 1) % 2]);
        }
      },
    };

    let func = null;
    if (outRep === REPRESENTATIONS.VTK_POINTS || inRep === 'Verts') {
      func = cellBuilders.anythingToPoints;
    } else if (outRep === REPRESENTATIONS.VTK_WIREFRAME || inRep === 'Lines') {
      func = cellBuilders[`${inRep}ToWireframe`];
    } else {
      func = cellBuilders[`${inRep}ToSurface`];
    }

    let currentIndex = 0;
    const array = cellArray.getData();
    const size = array.length;
    for (let index = 0; index < size; index++) {
      if (index === currentIndex) {
        func(array[index], array, currentIndex + 1);
        currentIndex += array[index] + 1;
      }
    }
    model.elementCount = packedVBO.getNumberOfElements() / model.blockSize;
    const vboArray = packedVBO.getFrozenArray();
    publicAPI.upload(vboArray, OBJECT_TYPE.ARRAY_BUFFER);
    packedVBO.reset();
  };

  publicAPI.setCoordShiftAndScaleMethod = shiftScaleMethod => {
    console.log('coordinate shift and scale not yet implemented');
  };

  publicAPI.setCoordShift = shiftArray => {
    console.log('coordinate shift and scale not yet implemented');
  };

  publicAPI.setCoordScale = scaleArray => {
    console.log('coordinate shift and scale not yet implemented');
  };
}

// ----------------------------------------------------------------------------
// Object factory
// ----------------------------------------------------------------------------

const DEFAULT_VALUES = {
  elementCount: 0,
  stride: 0,
  vertexOffset: 0,
  normalOffset: 0,
  tCoordOffset: 0,
  tCoordComponents: 0,
  colorOffset: 0,
  numColorComponents: 0,
};

// ----------------------------------------------------------------------------

export function extend(publicAPI, model, initialValues = {}) {
  Object.assign(model, DEFAULT_VALUES, initialValues);

  // Inheritance
  vtkBufferObject.extend(publicAPI, model);

  macro.get(publicAPI, model, [
    'elementCount',
    'stride',
    'vertexOffset',
    'normalOffset',
    'tCoordOffset',
    'tCoordComponents',
    'colorOffset',
    'numColorComponents',
  ]);

  // Object specific methods
  vtkOpenGLCellArrayBufferObject(publicAPI, model);
}

// ----------------------------------------------------------------------------

export const newInstance = macro.newInstance(extend);

// ----------------------------------------------------------------------------

export default { newInstance, extend };
