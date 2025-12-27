
import * as THREE from "three";

/**
 * Creates a helper group visualizing the local X, Y, Z axes of an object.
 * X = Red
 * Y = Green
 * Z = Blue
 */
export function createAxesHelper(size: number = 1): THREE.AxesHelper {
    const axesHelper = new THREE.AxesHelper(size);
    // Custom colors can be set if needed, but default is R, G, B
    return axesHelper;
}

/**
 * Creates a thick axes helper using cylinders instead of lines.
 * Useful for better visibility in AR/VR.
 * X = Red, Y = Green, Z = Blue
 */
export function createThickAxesHelper(size: number = 1, thickness: number = 0.05): THREE.Group {
    const group = new THREE.Group();

    // Materials
    const redMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
    const greenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const blueMat = new THREE.MeshBasicMaterial({ color: 0x0000ff });

    // Geometry
    const geometry = new THREE.CylinderGeometry(thickness, thickness, size, 16);
    geometry.translate(0, size / 2, 0); // Origin at base

    // X Axis
    const xAxis = new THREE.Mesh(geometry, redMat);
    xAxis.rotateZ(-Math.PI / 2);
    group.add(xAxis);

    // Y Axis
    const yAxis = new THREE.Mesh(geometry, greenMat);
    // Cylinder is already Y-up by default
    group.add(yAxis);

    // Z Axis
    const zAxis = new THREE.Mesh(geometry, blueMat);
    zAxis.rotateX(Math.PI / 2);
    group.add(zAxis);

    return group;
}

/**
 * Updates an arrow helper to visualize a specific vector.
 */
export function updateArrow(
    arrow: THREE.ArrowHelper,
    dir: THREE.Vector3,
    origin: THREE.Vector3,
    length: number = 0.05,
    color: number = 0xffff00
) {
    arrow.setDirection(dir.normalize());
    arrow.position.copy(origin);
    arrow.setLength(length);
    arrow.setColor(new THREE.Color(color));
}
