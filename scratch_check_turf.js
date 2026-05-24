const turf = require('@turf/turf');
const poly1 = turf.polygon([[[0,0], [0,1], [1,1], [1,0], [0,0]]]);
const poly2 = turf.polygon([[[5,5], [5,6], [6,6], [6,5], [5,5]]]);
const res = turf.intersect(turf.featureCollection([poly1, poly2]));
console.log("No intersection result:", res);
