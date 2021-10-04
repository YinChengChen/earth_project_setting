export { createCanvas, initProgram, isPowerOf2, renderOverlay, drawScene, start_wind_animation, to_radians };
import { generate_particles, get_radius_and_center, advance_particle } from "./particles";
const vsSource = `
    attribute vec2 a_vertex;

    uniform mat4 u_matrix;

    void main(){
        gl_Position = vec4(a_vertex, 0.0, 1.0);
    }
`;

const fsSource = `
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

    void main(){
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
`;

// const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
// const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
// const program = createProgram(gl, vertexShader, fragmentShader);

function createCanvas(width, height, id) {
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.id = id;
    canvas.style = `position: absolute;`;
    // console.log(canvas);
    return canvas;
}

// 建立特定 type 的 shader，更新資源與編譯他
function loadShader(gl, type, source) {
    const shader = gl.createShader(type);
    // 將資源送入 shader 物件
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        alert('An error occurred compiling the shaders:' + gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    // 錯誤回報
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        alert('Unable to initialize the shader program:' + gl.getProgramInfoLog(program));
        return null;
    }
    return program;
}

function initProgram(gl){
    const vertexShader = loadShader(gl, gl.VERTEX_SHADER, vsSource);
    const fragmentShader = loadShader(gl, gl.FRAGMENT_SHADER, fsSource);
    const program = createProgram(gl, vertexShader, fragmentShader);

    return {
        shaderProgram: program,
        a_vertex: gl.getAttribLocation(program, "a_vertex"),
        u_translate: gl.getUniformLocation(program, "u_translate"),
        u_scale: gl.getUniformLocation(program, "u_scale"),
        u_rotate: gl.getUniformLocation(program, "u_rotate"),
    };
}

function isPowerOf2(value) {
    return (value & (value - 1)) == 0;
}

function renderOverlay(gl, image, programInfo) {
    gl.clearColor(0.0, 0.0, 0.0, 1.0); // 設定為全黑
    gl.clearDepth(1.0);                // 清除所有東西
    gl.enable(gl.DEPTH_TEST);          // 可以深度測試開啟
    gl.depthFunc(gl.LEQUAL);           // 近的事物蓋住遠的
    // 在開始前，先初始化畫布
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

    const vertexBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, Float32Array.of(-1, -1, +1, -1, +1, +1, -1, +1), gl.STATIC_DRAW);

    let texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    console.log(image.width, image.height);
    if (isPowerOf2(image.width) && isPowerOf2(image.height)) {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        // console.log("power 2");
    } else {
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    }
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);

    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.useProgram(programInfo.shaderProgram);
    gl.enableVertexAttribArray(programInfo.a_vertex);

    var size = 2;          // 2 components per iteration
    var type = gl.FLOAT;   // the data is 32bit floats
    var normalize = false; // don't normalize the data
    var stride = 0;        // 0 = move forward size * sizeof(type) each iteration to get the next position
    var offset = 0;        // start at the beginning of the buffer
    gl.vertexAttribPointer(
        programInfo.a_vertex, size, type, normalize, stride, offset
    );

    gl.uniform2f(programInfo.u_translate, gl.canvas.width / 2, gl.canvas.height / 2);
    gl.uniform1f(programInfo.u_scale, gl.canvas.height / 2 - 1);
    // let rotate = [0, 0];
    // let then = 0;
    // let selfs = this;
    // 上層球球與下層地圖一起動有困難，rotate 座標不同的樣子
    // this.earth_svg.projection.rotate(rotate);
    // drawScene(rotate);
    // requestAnimationFrame(calculateRotation);
    // function calculateRotation(now) {
    //     now *= 0.001;
    //     let deltaTime = now - then;
    //     let rotation = [deltaTime * 1000 * -0.0002 % (2 * Math.PI), Math.sin(deltaTime * 1000 * 0.0001) * 0.5];
    //     // selfs.earth_svg.projection.rotate(rotation);
    //     drawScene(rotation);

    //     requestAnimationFrame(calculateRotation);
    // }
    // function drawScene(rotate_angle) {
    //     gl.uniform2fv(programInfo.u_rotate, rotate_angle);
    //     gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    //     let primitiveType = gl.TRIANGLE_FAN;
    //     gl.drawArrays(primitiveType, 0, 4);
    // }
}

function drawScene(gl, programInfo, rotate_angle) {
    gl.uniform2fv(programInfo.u_rotate, rotate_angle);
    gl.viewport(0, 0, gl.canvas.width, gl.canvas.height);
    let primitiveType = gl.TRIANGLE_FAN;
    gl.drawArrays(primitiveType, 0, 4);
}

function start_wind_animation(selfs, vector_grid, context_wind_particles) {
    let wait_time, current_frame_rate;
    let particles = [];
    const frame_rate = 30;
    const frame_rate_time = 1000 / frame_rate;
    const radius_and_center = get_radius_and_center(selfs.earth_svg.width, selfs.earth_svg.height);
    particles = generate_particles(particles, selfs.number_of_prarticles, radius_and_center, selfs.earth_svg.width, selfs.earth_svg.height, selfs.earth_svg.projection, selfs.max_age_of_particles);
    // console.log("particles:", particles);
    selfs.animation_play = true;

    function tick(t) {
        if (!selfs.animation_play) {
            return;
        }
        context_wind_particles.beginPath();
        context_wind_particles.strokeStyle = 'rgba(210, 210, 210, 0.7)';
        particles.forEach((p) => advance_particle(p, context_wind_particles, radius_and_center, selfs.max_age_of_particles, selfs.particles_travel, selfs.earth_svg.projection, vector_grid));
        context_wind_particles.stroke();
        context_wind_particles.globalAlpha = selfs.alpha_decay;
        context_wind_particles.globalCompositeOperation = 'copy';
        context_wind_particles.drawImage(context_wind_particles.canvas, 0, 0);
        context_wind_particles.globalAlpha = 1.0;
        context_wind_particles.globalCompositeOperation = "source-over";

        wait_time = frame_rate_time - (performance.now() - t);

        animation_flag = setTimeout(() => {
            frame = requestAnimationFrame(tick);
        }, wait_time);
    }

    tick(performance.now());
}

function to_radians(d) {
    if (d < 0) {
        return Math.abs(d) * Math.PI / 180;
    }
    return Math.PI + (180 - d) * Math.PI / 180;
}