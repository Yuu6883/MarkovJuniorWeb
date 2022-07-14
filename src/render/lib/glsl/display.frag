precision highp float;

uniform vec2 resolution;
uniform sampler2D source, preview;
uniform float fraction;
uniform float complete;

varying vec2 v_rgbNW;
varying vec2 v_rgbNE;
varying vec2 v_rgbSW;
varying vec2 v_rgbSE;
varying vec2 v_rgbM;

varying vec2 vPos;

uniform bool enable_fxaa;

//import the fxaa function
#pragma glslify: fxaa = require('./fxaa.glsl')

void main() {

    if (gl_FragCoord.y > 0.99 * resolution.y && gl_FragCoord.x < complete * resolution.x) {
        gl_FragColor = vec4(0.392, 0.584, 0.929, 1);
        return;
    }

    vec4 src = texture2D(source, vPos);
    vec4 prv = texture2D(preview, vPos);

    if (enable_fxaa && fraction < 0.1) {
        prv = fxaa(preview, gl_FragCoord.xy, resolution, v_rgbNW, v_rgbNE, v_rgbSW, v_rgbSE, v_rgbM);
    } else {
        prv = texture2D(preview, vPos);
    }

    // Mix preview and traced output
    vec3 color = mix(prv.rgb, src.rgb / max(src.a, 1.0), fraction);
    color = pow(color, vec3(1.0 / 2.2));

    gl_FragColor = vec4(color, 1);
}
