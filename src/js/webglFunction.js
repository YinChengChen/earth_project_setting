export { createVertexShader, createFragmentShader, createVertexBuffer, createProgram, createTexture, to_radians, defineInit, draw };
// 與風場動畫相關的 functions
function createVertexShader(gl) {
    // https://developer.mozilla.org/en-US/docs/Web/API/WebGLRenderingContext
    // webgl rendering context 是一個 API，以下是他內涵的FUNCTION
    let shader = gl.createShader(gl.VERTEX_SHADER);
    gl.shaderSource(shader, `
        attribute vec2 a_vertex;
        void main(void){
            gl_Position = vec4(a_vertex, 0.0, 1.0);
        }`);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

function createFragmentShader(gl) {
    let shader = gl.createShader(gl.FRAGMENT_SHADER);
    gl.shaderSource(shader, `
        precision highp float;

        uniform sampler2D u_image;
        uniform vec2 u_translate;
        uniform float u_scale;
        uniform vec2 u_rotate;

        const float c_pi = 3.14159265358979323846264;
        const float c_halfPi = c_pi * 0.5;
        const float c_twoPi = c_pi * 2.0;

        float cosphi0 = cos(u_rotate.y);
        float sinphi0 = sin(u_rotate.y);

        void main(void) {
        float x = (gl_FragCoord.x - u_translate.x) / u_scale;
        float y = (u_translate.y - gl_FragCoord.y) / u_scale;

        // inverse orthographic projection
        float rho = sqrt(x * x + y * y);
        if (rho > 1.0) return;
        float c = asin(rho);
        float sinc = sin(c);
        float cosc = cos(c);
        float lambda = atan(x * sinc, rho * cosc);
        float phi = asin(y * sinc / rho);

        // inverse rotation
        float cosphi = cos(phi);
        float x1 = cos(lambda) * cosphi;
        float y1 = sin(lambda) * cosphi;
        float z1 = sin(phi);
        lambda = atan(y1, x1 * cosphi0 + z1 * sinphi0) + u_rotate.x;
        phi = asin(z1 * cosphi0 - x1 * sinphi0);

        gl_FragColor = texture2D(u_image, vec2((lambda + c_pi) / c_twoPi, (phi + c_halfPi) / c_pi));
        }
        `);
    gl.compileShader(shader);
    // console.log("gl:", gl_)
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
    return shader;
}

function createVertexBuffer(gl) {
    let buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.of(-1, -1, +1, -1, +1, +1, -1, +1), gl.STATIC_DRAW);
    return buffer;
}

function createProgram(gl, vertexShader, fragmentShader) {
    let program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(program));
    return program;
}

function createTexture(gl, image_object) {
    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image_object);
    return texture;
}

function to_radians(d){
    if (d < 0){
        return Math.abs(d) * Math.PI / 180;
    }
    return Math.PI + (180 - d) * Math.PI / 180;
}

function defineInit(gl, program, texture, a_vertex, u_translate, u_scale, width, height){
    gl.useProgram(program);

    gl.enableVertexAttribArray(a_vertex);
    gl.vertexAttribPointer(a_vertex, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u_translate, width / 2, height / 2);

    gl.uniform1f(u_scale, height / 2 - 1);
    // 定義視窗大小
    gl.viewport(0, 0, width, height);

    gl.bindTexture(gl.TEXTURE_2D, texture);
}

function draw(gl, init, u_rotate, rotate_angle){
    init;
    gl.uniform2fv(u_rotate, rotate_angle);
    console.log(gl.TRIANGLE_FAN);
    gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
}

// function draw(gl, program, texture, a_vertex, u_translate, u_scale, width, height, u_rotate, rotate_angle){
//     gl.useProgram(program);
//     gl.enableVertexAttribArray(a_vertex);
//     gl.vertexAttribPointer(a_vertex, 2, gl.FLOAT, false, 0, 0);
//     gl.uniform2f(u_translate, width / 2, height / 2);

//     gl.uniform1f(u_scale, height / 2 - 1);

//     gl.viewport(0, 0, width, height);

//     gl.bindTexture(gl.TEXTURE_2D, texture);
//     gl.uniform2fv(u_rotate, rotate_angle);
//     gl.drawArrays(gl.TRIANGLE_FAN, 0, 4);
// }