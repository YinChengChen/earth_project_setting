export { createCanvas, initProgram, isPowerOf2 };

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