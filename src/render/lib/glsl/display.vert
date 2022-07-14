precision highp float;

uniform vec2 resolution;

attribute vec2 position;

// texcoords computed in vertex step
// to avoid dependent texture reads
varying vec2 v_rgbNW;
varying vec2 v_rgbNE;
varying vec2 v_rgbSW;
varying vec2 v_rgbSE;
varying vec2 v_rgbM;

varying vec2 vPos;

#pragma glslify: texcoords = require('./texcoords.glsl')

void main() {
    gl_Position = vec4(position, 0, 1);
    vPos = 0.5 * position + 0.5;

    vec2 fragCoord = vPos * resolution;
    texcoords(fragCoord, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);
}
