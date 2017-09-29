import vtkActor                   from 'vtk.js/Sources/Rendering/Core/Actor';
import vtkFullScreenRenderWindow  from 'vtk.js/Sources/Rendering/Misc/FullScreenRenderWindow';
import vtkImageMarchingCubes      from 'vtk.js/Sources/Filters/General/ImageMarchingCubes';
import vtkMapper                  from 'vtk.js/Sources/Rendering/Core/Mapper';
import vtkSampleFunction          from 'vtk.js/Sources/Imaging/Hybrid/SampleFunction';
import vtkSphere                  from 'vtk.js/Sources/Common/DataModel/Sphere';

import controlPanel from './controller.html';

// ----------------------------------------------------------------------------
// Standard rendering code setup
// ----------------------------------------------------------------------------

const fullScreenRenderer = vtkFullScreenRenderWindow.newInstance();
const renderer = fullScreenRenderer.getRenderer();
const renderWindow = fullScreenRenderer.getRenderWindow();

// ----------------------------------------------------------------------------
// Example code
// ----------------------------------------------------------------------------
const actor = vtkActor.newInstance();
renderer.addActor(actor);

const mapper = vtkMapper.newInstance();
actor.setMapper(mapper);

// Build pipeline
const sphere = vtkSphere.newInstance({ center: [0.0, 0.0, 0.0], radius: 0.5 });
const sample = vtkSampleFunction.newInstance({ implicitFunction: sphere, sampleDimensions: [50, 50, 50], modelBounds: [-0.5, 0.5, -0.5, 0.5, -0.5, 0.5] });
const marchingCube = vtkImageMarchingCubes.newInstance({ contourValue: 0.0 });

// Connect the pipeline proper
marchingCube.setInputConnection(sample.getOutputPort());
mapper.setInputConnection(marchingCube.getOutputPort());

// ----------------------------------------------------------------------------
// UI control handling
// ----------------------------------------------------------------------------
fullScreenRenderer.addController(controlPanel);

// Define the isosurface value
document.querySelector('.isoValue').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  marchingCube.setContourValue(value);
  renderWindow.render();
});

// Define the volume resolution
document.querySelector('.volumeResolution').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  sample.setSampleDimensions(value, value, value);
  renderWindow.render();
});

// Define the sphere radius
document.querySelector('.sphereRadius').addEventListener('input', (e) => {
  const value = Number(e.target.value);
  sphere.setRadius(value);
  renderWindow.render();
});

// -----------------------------------------------------------

renderer.resetCamera();
renderWindow.render();

// -----------------------------------------------------------
// Make some variables global so that you can inspect and
// modify objects in your browser's developer console:
// -----------------------------------------------------------

global.source = sample;
global.filter = marchingCube;
global.mapper = mapper;
global.actor = actor;
